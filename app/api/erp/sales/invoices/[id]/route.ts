import { NextRequest, NextResponse } from 'next/server';
import { sql, eq } from 'drizzle-orm';
import { erpDb, mainDb } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { salesInvoices, customers } from '@/lib/db/schema';
import { sendEmail } from '@/lib/emailServices';
import { notifyCustomerInvoiceSent } from '@/lib/customerNotifications';
import { notifySalesInvoiceSent } from '@/lib/warehouseNotifications';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const params = await context.params;
    const invoiceId = params.id;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Fetch invoice with customer details and line items
    const invoiceQuery = await erpDb.execute(sql`
      SELECT 
        si.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.billing_address,
        c.shipping_address
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ${invoiceId}
      AND si.erp_organization_id = ${decoded.organizationId}
    `);

    const invoiceResult = Array.from(invoiceQuery);
    
    if (!invoiceResult || invoiceResult.length === 0) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoiceResult[0] as any;

    // Fetch invoice line items
    const linesQuery = await erpDb.execute(sql`
      SELECT 
        sil.*,
        p.name as product_name
      FROM sales_invoice_lines sil
      LEFT JOIN products p ON sil.product_id = p.id
      WHERE sil.sales_invoice_id = ${invoiceId}
      ORDER BY sil.created_at
    `);

    const lines = Array.from(linesQuery);

    // Handle PDF download
    if (action === 'download') {
      const [org] = await mainDb.execute(
        sql`SELECT name, logo_url FROM organizations WHERE id = ${decoded.organizationId} LIMIT 1`
      );
      const organizationName = (org as any)?.name || 'Organization';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; background: #f8f9fa; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 0 30px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 50px; border-bottom: 4px solid #2563eb; padding-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 40px; font-weight: bold; letter-spacing: 2px; }
    .header .invoice-number { font-size: 24px; font-weight: bold; color: #1e40af; margin: 15px 0; }
    .header p { margin: 8px 0; color: #6b7280; font-size: 16px; }
    .info-section { margin: 40px 0; }
    .info-row { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 40px; }
    .info-box { flex: 1; background: #f9fafb; padding: 25px; border-radius: 12px; border-left: 4px solid #2563eb; }
    .info-box h3 { color: #2563eb; margin: 0 0 15px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
    .info-box p { margin: 8px 0; line-height: 1.8; color: #374151; font-size: 15px; }
    .info-box strong { color: #111827; font-weight: 600; }
    .details-table { width: 100%; border-collapse: collapse; margin: 40px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .details-table th { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 18px; text-align: left; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .details-table td { padding: 18px; border-bottom: 1px solid #e5e7eb; font-size: 15px; color: #374151; }
    .details-table tr:hover { background: #f9fafb; }
    .total-section { margin-top: 50px; background: #eff6ff; padding: 30px; border-radius: 12px; border: 2px solid #2563eb; }
    .total-row { display: flex; justify-content: flex-end; align-items: center; margin: 15px 0; }
    .total-label { font-weight: 600; margin-right: 30px; min-width: 200px; text-align: right; font-size: 16px; color: #374151; }
    .total-value { min-width: 180px; text-align: right; font-size: 16px; color: #1e40af; font-weight: 500; }
    .grand-total { font-size: 28px; color: #2563eb; padding-top: 20px; border-top: 3px solid #2563eb; margin-top: 15px; }
    .grand-total .total-label { font-size: 20px; color: #1e3a8a; }
    .grand-total .total-value { font-size: 32px; font-weight: bold; }
    .footer { margin-top: 60px; padding-top: 30px; border-top: 3px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .status-badge { display: inline-block; padding: 8px 20px; border-radius: 25px; font-weight: bold; font-size: 13px; letter-spacing: 0.5px; }
    .status-draft { background: #fef3c7; color: #92400e; border: 2px solid #f59e0b; }
    .status-sent { background: #dbeafe; color: #1e3a8a; border: 2px solid #2563eb; }
    .status-paid { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
    @media print { body { margin: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SALES INVOICE</h1>
      <div class="invoice-number">${invoice.invoice_number}</div>
      <p style="font-size: 16px; margin-top: 10px;">Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <span class="status-badge status-${invoice.status}">${invoice.status.toUpperCase()}</span>
    </div>

    <div class="info-section">
      <div class="info-row">
        <div class="info-box">
          <h3>From (Organization)</h3>
          <p><strong>${organizationName}</strong></p>
        </div>
        <div class="info-box">
          <h3>Bill To (Customer)</h3>
          <p><strong>${invoice.customer_name}</strong></p>
          ${invoice.customer_email ? `<p>Email: ${invoice.customer_email}</p>` : ''}
          ${invoice.customer_phone ? `<p>Phone: ${invoice.customer_phone}</p>` : ''}
          ${invoice.billing_address ? `<p>${invoice.billing_address}</p>` : ''}
        </div>
      </div>
    </div>

    <table class="details-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Tax Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((line: any) => {
          const qty = parseFloat(line.quantity);
          const price = parseFloat(line.unit_price);
          const taxRate = parseFloat(line.tax_rate || 0);
          const lineTotal = qty * price * (1 + taxRate / 100);
          return `
            <tr>
              <td><strong>${line.product_name || '-'}</strong></td>
              <td>${line.description || '-'}</td>
              <td>${qty}</td>
              <td>₹${price.toFixed(2)}</td>
              <td>${taxRate}%</td>
              <td><strong>₹${lineTotal.toFixed(2)}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <div class="total-label">Subtotal:</div>
        <div class="total-value">₹${parseFloat(invoice.subtotal || 0).toFixed(2)}</div>
      </div>
      <div class="total-row">
        <div class="total-label">Tax Amount:</div>
        <div class="total-value">₹${parseFloat(invoice.tax_amount || 0).toFixed(2)}</div>
      </div>
      <div class="total-row grand-total">
        <div class="total-label">TOTAL AMOUNT:</div>
        <div class="total-value">₹${parseFloat(invoice.total_amount || 0).toFixed(2)}</div>
      </div>
      ${invoice.paid_amount && parseFloat(invoice.paid_amount) > 0 ? `
      <div class="total-row" style="margin-top: 20px; color: #10b981;">
        <div class="total-label">Amount Paid:</div>
        <div class="total-value">₹${parseFloat(invoice.paid_amount).toFixed(2)}</div>
      </div>
      <div class="total-row" style="color: #ef4444;">
        <div class="total-label">Balance Due:</div>
        <div class="total-value">₹${(parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount)).toFixed(2)}</div>
      </div>
      ` : ''}
    </div>

    ${invoice.notes ? `<div style="margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px;"><strong style="color: #374151;">Notes:</strong><p style="margin: 10px 0 0 0; color: #6b7280;">${invoice.notes}</p></div>` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>
</body>
</html>
      `;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.html"`,
        },
      });
    }

    // Format response
    const response = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      totalAmount: invoice.total_amount,
      paidAmount: invoice.paid_amount || '0',
      balanceAmount: invoice.balance_amount || invoice.total_amount,
      subtotal: invoice.subtotal,
      taxAmount: invoice.tax_amount,
      currencyCode: invoice.currency_code,
      paymentTerms: invoice.payment_terms,
      notes: invoice.notes,
      customer: {
        name: invoice.customer_name,
        email: invoice.customer_email,
        phone: invoice.customer_phone,
      },
      lines: lines.map((line: any) => ({
        id: line.id,
        productId: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        taxRate: line.tax_rate,
        product: {
          name: line.product_name,
        },
      })),
      salesOrderId: invoice.sales_order_id,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { message: 'Failed to fetch invoice', error: error.message },
      { status: 500 }
    );
  }
}
// PUT /api/erp/sales/invoices/[id] - Handle send action
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const params = await context.params;
    const invoiceId = params.id;
    const body = await request.json();

    if (body.action === 'send') {
      // Fetch invoice with customer
      const [invoice] = await erpDb
        .select({
          invoice: salesInvoices,
          customer: customers,
        })
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.id, invoiceId));

      if (!invoice?.customer?.email) {
        return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
      }

      // Fetch lines
      const linesResult = await erpDb.execute(sql`
        SELECT sil.*, p.name as product_name
        FROM sales_invoice_lines sil
        LEFT JOIN products p ON sil.product_id = p.id
        WHERE sil.sales_invoice_id = ${invoiceId}
      `);
      const lines = Array.from(linesResult);

      // Fetch organization
      const [org] = await mainDb.execute(
        sql`SELECT name, logo_url FROM organizations WHERE id = ${decoded.organizationId} LIMIT 1`
      );
      const organizationName = (org as any)?.name || 'Organization';

      // Send email (simplified HTML)
      const emailHtml = `
        <h2>Invoice ${invoice.invoice.invoiceNumber}</h2>
        <p>Dear ${invoice.customer.name},</p>
        <p>Please find your invoice details below:</p>
        <p><strong>Total Amount:</strong> ₹${invoice.invoice.totalAmount}</p>
        <p><strong>Due Date:</strong> ${invoice.invoice.dueDate}</p>
      `;

      await sendEmail({
        to: invoice.customer.email,
        subject: `Invoice ${invoice.invoice.invoiceNumber} from ${organizationName}`,
        html: emailHtml,
      });

      // Update status to sent
      await erpDb
        .update(salesInvoices)
        .set({ status: 'sent', updatedAt: new Date() })
        .where(eq(salesInvoices.id, invoiceId));

      // Send proper email notifications
      console.log('🔔 Sending invoice sent notifications...');
      try {
        // Get warehouse details from sales order
        const warehouseResult = await erpDb.execute(sql`
          SELECT so.warehouse_id
          FROM sales_invoices si
          LEFT JOIN sales_orders so ON si.sales_order_id = so.id
          WHERE si.id = ${invoiceId}
        `);
        
        const warehouseData = Array.from(warehouseResult)[0] as any;
        
        // Email to customer with payment link
        await notifyCustomerInvoiceSent(
          invoice.customer.id,
          invoice.invoice.invoiceNumber,
          parseFloat(invoice.invoice.totalAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          invoice.invoice.dueDate || undefined,
          invoiceId // Pass invoice ID for payment link
        );
        console.log('✅ Customer notification sent for invoice send');

        // Email to warehouse
        if (warehouseData?.warehouse_id) {
          await notifySalesInvoiceSent(
            warehouseData.warehouse_id,
            invoice.invoice.invoiceNumber,
            invoice.customer.name,
            parseFloat(invoice.invoice.totalAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            invoice.invoice.dueDate || undefined
          );
          console.log('✅ Warehouse notification sent for invoice send');
        }
      } catch (emailError) {
        console.error('❌ Failed to send invoice sent notifications:', emailError);
        // Don't fail the API call if email fails
      }

      return NextResponse.json({ success: true, message: 'Invoice sent successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}