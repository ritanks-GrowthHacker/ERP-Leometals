import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { sql } from 'drizzle-orm';
import { sendWarehouseNotification } from '@/lib/warehouseNotifications';

// GET /api/supplier-portal/invoices - Get supplier's invoices
export async function GET(req: NextRequest) {
  const { supplier, error } = await verifySupplierAuth(req);
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query;
    if (status) {
      query = sql`
        SELECT 
          si.*,
          sq.submission_number as quotation_number,
          po.po_number
        FROM supplier_invoices si
        LEFT JOIN supplier_quotation_submissions sq ON si.quotation_id = sq.id
        LEFT JOIN purchase_orders po ON si.purchase_order_id = po.id
        WHERE si.supplier_id = ${supplier.id}
        AND si.payment_status = ${status}
        ORDER BY si.created_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          si.*,
          sq.submission_number as quotation_number,
          po.po_number
        FROM supplier_invoices si
        LEFT JOIN supplier_quotation_submissions sq ON si.quotation_id = sq.id
        LEFT JOIN purchase_orders po ON si.purchase_order_id = po.id
        WHERE si.supplier_id = ${supplier.id}
        ORDER BY si.created_at DESC
      `;
    }

    const result = await erpDb.execute(query);
    const invoices = Array.from(result);

    return NextResponse.json({
      invoices: invoices,
      total: invoices.length,
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/supplier-portal/invoices - Create invoice
export async function POST(req: NextRequest) {
  const { supplier, error } = await verifySupplierAuth(req);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      quotationId,
      dueDate,
      subtotal,
      taxAmount,
      shippingCharges,
      discountAmount,
      totalAmount,
      paymentTerms,
      invoiceFile,
      invoiceFileName,
      notes,
    } = body;

    if (!quotationId || !dueDate || !totalAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify quotation belongs to supplier and is accepted
    const quotationCheck = await erpDb.execute(sql`
      SELECT id, status, erp_organization_id
      FROM supplier_quotation_submissions
      WHERE id = ${quotationId} AND supplier_id = ${supplier.id} AND status = 'accepted'
    `);

    const quotations = Array.from(quotationCheck);

    if (quotations.length === 0) {
      return NextResponse.json(
        { error: 'Quotation not found or not accepted' },
        { status: 404 }
      );
    }

    const quotation = quotations[0];

    // Create invoice
    const insertResult = await erpDb.execute(sql`
      INSERT INTO supplier_invoices (
        erp_organization_id,
        quotation_id,
        supplier_id,
        due_date,
        subtotal,
        tax_amount,
        shipping_charges,
        discount_amount,
        total_amount,
        invoice_file_url,
        invoice_file_name,
        notes,
        status
      ) VALUES (
        ${quotation.erp_organization_id},
        ${quotationId},
        ${supplier.id},
        ${dueDate},
        ${subtotal},
        ${taxAmount || 0},
        ${shippingCharges || 0},
        ${discountAmount || 0},
        ${totalAmount},
        ${invoiceFile},
        ${invoiceFileName},
        ${notes || (paymentTerms ? `Payment Terms: ${paymentTerms}` : null)},
        'sent'
      )
      RETURNING *
    `);

    const invoiceResult = Array.from(insertResult);

    // Create notification for customer
    await erpDb.execute(sql`
      INSERT INTO supplier_portal_notifications (
        supplier_id,
        notification_type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        ${supplier.id},
        'invoice_created',
        'Invoice Created',
        'You have created a new invoice',
        'invoice',
        ${invoiceResult[0].id}
      )
    `);

    // Send email notification to warehouse
    console.log('🔔 Sending invoice creation email to warehouse...');
    try {
      // Get warehouse and supplier details
      const detailsResult = await erpDb.execute(sql`
        SELECT 
          sq.purchase_order_id,
          sq.rfq_id,
          sq.submission_number,
          po.warehouse_id as po_warehouse_id,
          po.po_number,
          rfq.warehouse_id as rfq_warehouse_id,
          rfq.rfq_number,
          s.name as supplier_name
        FROM supplier_quotation_submissions sq
        LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
        LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        WHERE sq.id = ${quotationId}
      `);
      
      const details = Array.from(detailsResult)[0] as any;
      const warehouseId = details?.po_warehouse_id || details?.rfq_warehouse_id;
      const invoiceData = invoiceResult[0] as any;
      const invoiceNumber = invoiceData?.invoice_number || `INV-${invoiceData?.id?.substring(0, 8)}`;
      
      console.log('Invoice details:', {
        invoiceNumber,
        warehouseId,
        supplier_name: details?.supplier_name,
        total_amount: totalAmount,
      });
      
      if (warehouseId) {
        await sendWarehouseNotification({
          warehouseId,
          subject: 'Supplier Invoice Received',
          message: `
            <p><strong>A supplier has submitted an invoice for payment.</strong></p>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
                <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
                <td style="padding: 8px 0; font-weight: 600;">${details?.supplier_name || 'Unknown'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Quotation:</td>
                <td style="padding: 8px 0; font-weight: 600;">${details?.submission_number || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
                <td style="padding: 8px 0; font-weight: 600;">${new Date(dueDate).toLocaleDateString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #dc2626; font-size: 18px;">₹${parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
            <p style="margin-top: 20px;">Please review and process this invoice for payment.</p>
          `,
          eventType: '🧾 Supplier Invoice Received',
        });
        console.log('✅ Warehouse notification sent successfully');
      } else {
        console.warn('⚠️ No warehouse_id found for invoice notification');
      }
    } catch (emailError) {
      console.error('❌ Failed to send invoice creation email:', emailError);
      // Don't fail the API call if email fails
    }

    return NextResponse.json({
      message: 'Invoice created successfully',
      invoice: invoiceResult[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/supplier-portal/invoices - Mark payment received
export async function PUT(req: NextRequest) {
  const { supplier, error } = await verifySupplierAuth(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { invoiceId, action, paymentProof, paymentProofName } = body;

    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'mark_received') {
      await erpDb.execute(sql`
        UPDATE supplier_invoices
        SET payment_marked_received = true,
            payment_marked_at = NOW(),
            payment_proof_url = ${paymentProof},
            payment_proof_name = ${paymentProofName},
            updated_at = NOW()
        WHERE id = ${invoiceId} AND supplier_id = ${supplier.id}
      `);

      return NextResponse.json({ message: 'Payment marked as received' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/supplier-portal/invoices - Delete invoice
export async function DELETE(req: NextRequest) {
  const { supplier, error } = await verifySupplierAuth(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('id');

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Verify invoice belongs to supplier
    const checkResult = await erpDb.execute(sql`
      SELECT id FROM supplier_invoices
      WHERE id = ${invoiceId} AND supplier_id = ${supplier.id}
    `);

    if (Array.from(checkResult).length === 0) {
      return NextResponse.json({ error: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    // Delete invoice
    await erpDb.execute(sql`
      DELETE FROM supplier_invoices
      WHERE id = ${invoiceId} AND supplier_id = ${supplier.id}
    `);

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
