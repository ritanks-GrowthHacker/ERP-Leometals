import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { erpDb as db } from '@/lib/db';

interface Params {
  token: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { token: deliveryToken } = await context.params;
    const body = await request.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json(
        { message: 'OTP is required' },
        { status: 400 }
      );
    }

    // Get delivery assignment by token
    const deliveryQuery = await db.execute(sql`
      SELECT 
        da.id,
        da.sales_order_id,
        da.erp_organization_id,
        da.status,
        da.delivery_otp,
        da.otp_expires_at,
        da.otp_verified_at,
        da.token_expires_at,
        da.token_used,
        so.so_number
       FROM delivery_assignments da
       JOIN sales_orders so ON da.sales_order_id = so.id
       WHERE da.delivery_token = ${deliveryToken}
    `);

    const deliveryResult = Array.from(deliveryQuery);
    if (deliveryResult.length === 0) {
      return NextResponse.json(
        { message: 'Invalid delivery link' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult[0] as any;

    // Check if token is expired
    const now = new Date();
    const tokenExpiry = new Date(delivery.token_expires_at);
    
    if (now > tokenExpiry) {
      return NextResponse.json(
        { message: 'Delivery link has expired' },
        { status: 410 }
      );
    }

    // Check if token is already used
    if (delivery.token_used) {
      return NextResponse.json(
        { message: 'This delivery has been completed' },
        { status: 400 }
      );
    }

    // Check if order is picked up
    if (delivery.status !== 'picked_up') {
      return NextResponse.json(
        { message: 'Order must be picked up before delivery' },
        { status: 400 }
      );
    }

    // Check if OTP is already verified
    if (delivery.otp_verified_at) {
      return NextResponse.json(
        { message: 'OTP has already been verified' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    const otpExpiry = new Date(delivery.otp_expires_at);
    if (now > otpExpiry) {
      return NextResponse.json(
        { message: 'OTP has expired' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (otp.trim() !== delivery.delivery_otp.trim()) {
      return NextResponse.json(
        { message: 'Invalid OTP' },
        { status: 400 }
      );
    }

    // Update delivery assignment status to delivered and related data
    try {
      // Update delivery assignment status to delivered
      await db.execute(sql`
        UPDATE delivery_assignments 
         SET status = 'delivered',
             delivered_at = NOW(),
             otp_verified_at = NOW(),
             token_used = true,
             updated_at = NOW()
         WHERE id = ${delivery.id}
      `);

      // Update sales order status to delivered
      await db.execute(sql`
        UPDATE sales_orders 
         SET status = 'delivered',
             updated_at = NOW()
         WHERE id = ${delivery.sales_order_id}
      `);

      // Log status change
      await db.execute(sql`
        INSERT INTO delivery_status_logs (
          delivery_assignment_id,
          old_status,
          new_status,
          changed_by,
          notes
        ) VALUES (${delivery.id}, 'picked_up', 'delivered', 'delivery_partner', 'Order delivered successfully with OTP verification')
      `);

      // Get sales order details for invoice generation
      const salesOrderQuery = await db.execute(sql`
        SELECT 
          so.*,
          c.name as customer_name,
          c.email as customer_email
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE so.id = ${delivery.sales_order_id}
      `);

      const salesOrderResult = Array.from(salesOrderQuery);
      const salesOrder = salesOrderResult[0] as any;

      // Check if invoice already exists
      const existingInvoiceQuery = await db.execute(sql`
        SELECT id FROM sales_invoices WHERE sales_order_id = ${delivery.sales_order_id}
      `);

      const existingInvoiceResult = Array.from(existingInvoiceQuery);
      let invoiceId = null;

      if (existingInvoiceResult.length === 0) {
        // Generate invoice number
        const invoiceNumber = `INV-${delivery.so_number}-${Date.now()}`;
        const invoiceDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Get sales order lines with product details
        const linesQuery = await db.execute(sql`
          SELECT 
            sol.*,
            p.name as product_name,
            (sol.quantity_ordered::numeric * sol.unit_price::numeric) as subtotal,
            (sol.quantity_ordered::numeric * sol.unit_price::numeric * COALESCE(sol.tax_rate, 0)::numeric / 100) as tax_amount,
            (sol.quantity_ordered::numeric * sol.unit_price::numeric * (1 + COALESCE(sol.tax_rate, 0)::numeric / 100)) as total_price
          FROM sales_order_lines sol
          JOIN products p ON sol.product_id = p.id
          WHERE sol.sales_order_id = ${delivery.sales_order_id}
        `);

        const linesResult = Array.from(linesQuery);

        // Create invoice
        const invoiceInsertQuery = await db.execute(sql`
          INSERT INTO sales_invoices (
            erp_organization_id,
            invoice_number,
            sales_order_id,
            customer_id,
            invoice_date,
            due_date,
            subtotal,
            tax_amount,
            total_amount,
            status,
            currency_code,
            created_by,
            created_at
          ) VALUES (
            ${delivery.erp_organization_id},
            ${invoiceNumber},
            ${delivery.sales_order_id},
            ${salesOrder.customer_id},
            ${invoiceDate},
            ${dueDateStr},
            ${salesOrder.subtotal || salesOrder.total_amount},
            ${salesOrder.tax_amount || 0},
            ${salesOrder.total_amount},
            'draft',
            ${salesOrder.currency_code || 'INR'},
            ${salesOrder.created_by},
            NOW()
          )
          RETURNING id
        `);

        const invoiceInsertResult = Array.from(invoiceInsertQuery);
        invoiceId = (invoiceInsertResult[0] as any).id;

        // Create invoice line items
        for (const line of linesResult) {
          const lineData = line as any;
          await db.execute(sql`
            INSERT INTO sales_invoice_lines (
              sales_invoice_id,
              product_id,
              description,
              quantity,
              unit_price,
              tax_rate
            ) VALUES (
              ${invoiceId},
              ${lineData.product_id},
              ${lineData.product_name || lineData.description || ''},
              ${lineData.quantity_ordered},
              ${lineData.unit_price},
              ${lineData.tax_rate || 0}
            )
          `);
        }
      } else {
        invoiceId = (existingInvoiceResult[0] as any).id;
      }

      return NextResponse.json({
        success: true,
        message: 'Delivery completed successfully! Invoice has been generated.',
        invoiceId,
      });
    } catch (error) {
      console.error('Error in delivery completion:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
