import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb as db } from '@/lib/db';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { id: receiptId } = await context.params;

    // Verify ERP authentication
    const { user, error } = await requireErpAccess(request);
    if (error) return error;

    if (!hasPermission(user, 'purchasing', 'view')) {
      return NextResponse.json(
        { error: 'No permission to view receipts' },
        { status: 403 }
      );
    }

    // First, try to fetch from supplier_invoice_receipts
    const invoiceReceiptResult = await db.execute(sql`
      SELECT 
        r.*,
        si.invoice_number,
        si.invoice_date,
        si.due_date,
        si.total_amount as invoice_amount,
        si.payment_status,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        s.city,
        s.state,
        s.country,
        s.postal_code,
        'supplier_invoice' as receipt_type
      FROM supplier_invoice_receipts r
      JOIN supplier_invoices si ON r.invoice_id = si.id
      JOIN suppliers s ON r.supplier_id = s.id
      WHERE r.id = ${receiptId}
        AND r.erp_organization_id = ${user.erpOrganizationId}
    `);

    if (invoiceReceiptResult && Array.from(invoiceReceiptResult).length > 0) {
      const receipt = Array.from(invoiceReceiptResult)[0] as any;

      // Update download tracking
      await db.execute(sql`
        UPDATE supplier_invoice_receipts 
        SET 
          status = 'downloaded',
          downloaded_at = NOW(),
          updated_at = NOW()
        WHERE id = ${receiptId}
          AND erp_organization_id = ${user.erpOrganizationId}
      `);

      // Generate HTML receipt for supplier invoice
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receipt.receipt_number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; background: #f8f9fa; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 0 30px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 50px; border-bottom: 4px solid #10b981; padding-bottom: 30px; }
    .header h1 { color: #10b981; margin: 0; font-size: 40px; font-weight: bold; letter-spacing: 2px; }
    .header .receipt-number { font-size: 24px; font-weight: bold; color: #059669; margin: 15px 0; }
    .header p { margin: 8px 0; color: #6b7280; font-size: 16px; }
    .info-section { margin: 40px 0; }
    .info-row { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 40px; }
    .info-box { flex: 1; background: #f9fafb; padding: 25px; border-radius: 12px; border-left: 4px solid #10b981; }
    .info-box h3 { color: #10b981; margin: 0 0 15px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
    .info-box p { margin: 8px 0; line-height: 1.8; color: #374151; font-size: 15px; }
    .info-box strong { color: #111827; font-weight: 600; }
    .details-table { width: 100%; border-collapse: collapse; margin: 40px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .details-table th { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px; text-align: left; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .details-table td { padding: 18px; border-bottom: 1px solid #e5e7eb; font-size: 15px; color: #374151; }
    .details-table tr:hover { background: #f9fafb; }
    .total-section { margin-top: 50px; background: #f0fdf4; padding: 30px; border-radius: 12px; border: 2px solid #10b981; }
    .total-row { display: flex; justify-content: flex-end; align-items: center; margin: 15px 0; }
    .total-label { font-weight: 600; margin-right: 30px; min-width: 200px; text-align: right; font-size: 16px; color: #374151; }
    .total-value { min-width: 180px; text-align: right; font-size: 16px; color: #059669; font-weight: 500; }
    .grand-total { font-size: 28px; color: #10b981; padding-top: 20px; border-top: 3px solid #10b981; margin-top: 15px; }
    .grand-total .total-label { font-size: 20px; color: #047857; }
    .grand-total .total-value { font-size: 32px; font-weight: bold; }
    .footer { margin-top: 60px; padding-top: 30px; border-top: 3px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .footer p { margin: 10px 0; }
    .stamp { margin-top: 50px; text-align: right; }
    .stamp-box { display: inline-block; border: 3px solid #10b981; padding: 25px 50px; border-radius: 8px; background: #f0fdf4; }
    .stamp-box p { margin: 0; font-weight: bold; color: #047857; font-size: 16px; }
    .stamp-box .note { margin: 15px 0 0 0; color: #6b7280; font-size: 13px; font-weight: normal; }
    .status-badge { display: inline-block; padding: 8px 20px; border-radius: 25px; font-weight: bold; font-size: 13px; letter-spacing: 0.5px; }
    .status-paid { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PAYMENT RECEIPT</h1>
      <div class="receipt-number">${receipt.receipt_number}</div>
      <p style="font-size: 16px; margin-top: 10px;">Date: ${new Date(receipt.receipt_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="info-section">
      <div class="info-row">
        <div class="info-box">
          <h3>From (Customer/Buyer)</h3>
          <p><strong>Your Organization</strong></p>
          <p>Payment Receipt</p>
        </div>
        <div class="info-box">
          <h3>To (Supplier)</h3>
          <p><strong>${receipt.supplier_name}</strong></p>
          <p>${receipt.supplier_address || 'N/A'}</p>
          ${receipt.city ? `<p>${receipt.city}${receipt.state ? ', ' + receipt.state : ''}${receipt.postal_code ? ' - ' + receipt.postal_code : ''}</p>` : ''}
          ${receipt.country ? `<p>${receipt.country}</p>` : ''}
          <p>Email: ${receipt.supplier_email || 'N/A'}</p>
          <p>Phone: ${receipt.supplier_phone || 'N/A'}</p>
        </div>
      </div>
    </div>

    <table class="details-table">
      <thead>
        <tr>
          <th>Invoice Number</th>
          <th>Invoice Date</th>
          <th>Due Date</th>
          <th>Payment Status</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${receipt.invoice_number}</strong></td>
          <td>${new Date(receipt.invoice_date).toLocaleDateString()}</td>
          <td>${new Date(receipt.due_date).toLocaleDateString()}</td>
          <td><span class="status-badge status-paid">PAID</span></td>
          <td><strong>₹${parseFloat(receipt.invoice_amount).toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>

    <table class="details-table">
      <thead>
        <tr>
          <th>Payment Details</th>
          <th>Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Payment Method</strong></td>
          <td>${receipt.payment_method?.replace('_', ' ').toUpperCase() || 'N/A'}</td>
        </tr>
        ${receipt.payment_reference ? `
        <tr>
          <td><strong>Payment Reference</strong></td>
          <td>${receipt.payment_reference}</td>
        </tr>
        ` : ''}
        ${receipt.notes ? `
        <tr>
          <td><strong>Notes</strong></td>
          <td>${receipt.notes}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row grand-total">
        <div class="total-label">TOTAL AMOUNT PAID:</div>
        <div class="total-value">₹${parseFloat(receipt.amount).toFixed(2)}</div>
      </div>
    </div>

    <div class="stamp">
      <div class="stamp-box">
        <p style="margin: 0; font-weight: bold;">Authorized Signature</p>
        <p style="margin: 20px 0 0 0; color: #666; font-size: 12px;">This is a computer-generated receipt</p>
      </div>
    </div>

    <div class="footer">
      <p style="font-size: 16px; font-weight: 600; color: #10b981;">Thank you for your business!</p>
      <p style="margin-top: 15px;">This receipt confirms payment for invoice ${receipt.invoice_number}</p>
      <p style="color: #9ca3af; margin-top: 8px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
    `;

      // Return HTML response
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="Receipt_${receipt.receipt_number}.html"`,
        },
      });
    }

    // If not found in supplier_invoice_receipts, try goods_receipts (PO receipts)
    const poReceiptResult = await db.execute(sql`
      SELECT 
        gr.id,
        gr.receipt_number,
        gr.receipt_date,
        gr.status,
        po.po_number,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        w.name as warehouse_name,
        w.address as warehouse_address,
        'purchase_order' as receipt_type
      FROM goods_receipts gr
      JOIN purchase_orders po ON gr.purchase_order_id = po.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN warehouses w ON gr.warehouse_id = w.id
      WHERE gr.id = ${receiptId}
        AND gr.erp_organization_id = ${user.erpOrganizationId}
    `);

    if (!poReceiptResult || Array.from(poReceiptResult).length === 0) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const poReceipt = Array.from(poReceiptResult)[0] as any;

    // Fetch receipt lines
    const linesResult = await db.execute(sql`
      SELECT 
        grl.*,
        p.name as product_name,
        p.sku as product_sku,
        pol.quantity_ordered,
        pol.unit_price
      FROM goods_receipt_lines grl
      JOIN products p ON grl.product_id = p.id
      JOIN purchase_order_lines pol ON grl.purchase_order_line_id = pol.id
      WHERE grl.goods_receipt_id = ${receiptId}
    `);

    const lines = Array.from(linesResult);

    // Generate HTML receipt for PO goods receipt
    const poHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Goods Receipt ${poReceipt.receipt_number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; background: #f8f9fa; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 0 30px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 50px; border-bottom: 4px solid #3b82f6; padding-bottom: 30px; }
    .header h1 { color: #3b82f6; margin: 0; font-size: 40px; font-weight: bold; letter-spacing: 2px; }
    .header .receipt-number { font-size: 24px; font-weight: bold; color: #2563eb; margin: 15px 0; }
    .header p { margin: 8px 0; color: #6b7280; font-size: 16px; }
    .info-section { margin: 40px 0; }
    .info-row { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 40px; }
    .info-box { flex: 1; background: #f9fafb; padding: 25px; border-radius: 12px; border-left: 4px solid #3b82f6; }
    .info-box h3 { color: #3b82f6; margin: 0 0 15px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
    .info-box p { margin: 8px 0; line-height: 1.8; color: #374151; font-size: 15px; }
    .info-box strong { color: #111827; font-weight: 600; }
    .details-table { width: 100%; border-collapse: collapse; margin: 40px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .details-table th { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 18px; text-align: left; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .details-table td { padding: 18px; border-bottom: 1px solid #e5e7eb; font-size: 15px; color: #374151; }
    .details-table tr:hover { background: #f9fafb; }
    .footer { margin-top: 60px; padding-top: 30px; border-top: 3px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .stamp { margin-top: 50px; text-align: right; }
    .stamp-box { display: inline-block; border: 3px solid #3b82f6; padding: 25px 50px; border-radius: 8px; background: #eff6ff; }
    .stamp-box p { margin: 0; font-weight: bold; color: #1e40af; font-size: 16px; }
    @media print {
      body { margin: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GOODS RECEIPT</h1>
      <div class="receipt-number">${poReceipt.receipt_number}</div>
      <p style="font-size: 16px; margin-top: 10px;">Date: ${new Date(poReceipt.receipt_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="info-section">
      <div class="info-row">
        <div class="info-box">
          <h3>Supplier</h3>
          <p><strong>${poReceipt.supplier_name}</strong></p>
          ${poReceipt.supplier_address ? `<p>${poReceipt.supplier_address}</p>` : ''}
          <p>Email: ${poReceipt.supplier_email || 'N/A'}</p>
          <p>Phone: ${poReceipt.supplier_phone || 'N/A'}</p>
        </div>
        <div class="info-box">
          <h3>Warehouse</h3>
          <p><strong>${poReceipt.warehouse_name}</strong></p>
          ${poReceipt.warehouse_address ? `<p>${poReceipt.warehouse_address}</p>` : ''}
          <p><strong>PO Number:</strong> ${poReceipt.po_number}</p>
          <p><strong>Status:</strong> ${poReceipt.status.toUpperCase()}</p>
        </div>
      </div>
    </div>

    <table class="details-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product</th>
          <th>Ordered</th>
          <th>Received</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((line: any) => `
        <tr>
          <td>${line.product_sku}</td>
          <td><strong>${line.product_name}</strong></td>
          <td>${line.quantity_ordered}</td>
          <td>${line.quantity_received}</td>
          <td>₹${parseFloat(line.unit_price).toFixed(2)}</td>
          <td>₹${(parseFloat(line.quantity_received) * parseFloat(line.unit_price)).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="stamp">
      <div class="stamp-box">
        <p style="margin: 0; font-weight: bold;">Authorized Signature</p>
        <p style="margin: 20px 0 0 0; color: #666; font-size: 12px;">This is a computer-generated receipt</p>
      </div>
    </div>

    <div class="footer">
      <p style="font-size: 16px; font-weight: 600; color: #3b82f6;">Goods Received Successfully</p>
      <p style="margin-top: 15px;">This receipt confirms goods received for PO ${poReceipt.po_number}</p>
      <p style="color: #9ca3af; margin-top: 8px;">Generated on ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
    `;

    // Return HTML response
    return new NextResponse(poHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="GoodsReceipt_${poReceipt.receipt_number}.html"`,
      },
    });

  } catch (error) {
    console.error('Error downloading receipt:', error);
    return NextResponse.json(
      { error: 'Failed to download receipt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
