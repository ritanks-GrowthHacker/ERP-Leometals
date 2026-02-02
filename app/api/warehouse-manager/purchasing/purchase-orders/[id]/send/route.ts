import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';
import { sendEmail } from '@/lib/emailServices';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id } = params;

    // Get PO details
    const poQuery = sql`
      SELECT po.*, s.name as supplier_name, s.email as supplier_email,
        w.name as warehouse_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      WHERE po.id = ${id} 
        AND po.warehouse_id = ${user.warehouseId}
    `;
    const poResult = await erpDb.execute(poQuery);
    const po = (poResult as any)[0];

    if (!po) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    }

    if (!po.supplier_email) {
      return NextResponse.json({ error: 'Supplier email not found' }, { status: 400 });
    }

    // Get PO lines
    const linesQuery = sql`
      SELECT pol.*, p.name as product_name, p.sku
      FROM purchase_order_lines pol
      JOIN products p ON pol.product_id = p.id
      WHERE pol.purchase_order_id = ${id}
    `;
    const lines = await erpDb.execute(linesQuery);

    // Send email
    const emailResult = await sendEmail({
      to: po.supplier_email,
      subject: `Purchase Order ${po.po_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Purchase Order</h2>
          <p>Dear ${po.supplier_name},</p>
          <p>Please find our purchase order details below:</p>
          
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>PO Number:</strong> ${po.po_number}</p>
            <p><strong>Date:</strong> ${po.po_date}</p>
            <p><strong>Delivery Date:</strong> ${po.expected_delivery_date || 'TBD'}</p>
            <p><strong>Warehouse:</strong> ${po.warehouse_name}</p>
          </div>

          <h3 style="color: #555;">Items Ordered:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #e0e0e0;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ccc;">Product</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ccc;">SKU</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ccc;">Quantity</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ccc;">Price</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ccc;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(lines as any[]).map(line => `
                <tr>
                  <td style="padding: 10px; border: 1px solid #ccc;">${line.product_name}</td>
                  <td style="padding: 10px; border: 1px solid #ccc;">${line.sku || '-'}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ccc;">${line.quantity_ordered}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ccc;">₹${line.unit_price}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ccc;">₹${line.line_total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
            <p style="font-size: 18px; font-weight: bold; text-align: right; margin: 0;">
              Total: ₹${po.total_amount}
            </p>
          </div>

          ${po.notes ? `<p style="margin-top: 20px;"><strong>Notes:</strong><br>${po.notes}</p>` : ''}

          <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 5px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #333;">Respond to this Purchase Order</p>
            <a href="http://localhost:3000/supplier-portal" style="display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Supplier Portal</a>
          </div>

          <p style="margin-top: 20px;">Please confirm receipt and expected delivery date.</p>
          <p>Best regards,<br>Purchasing Department</p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send email', details: emailResult.error }, { status: 500 });
    }

    // Update PO status
    await erpDb.execute(sql`
      UPDATE purchase_orders
      SET status = 'confirmed', updated_at = NOW()
      WHERE id = ${id}
    `);

    return NextResponse.json({ 
      success: true, 
      message: 'Purchase order sent successfully' 
    });
  } catch (error: any) {
    console.error('Error sending PO:', error);
    return NextResponse.json(
      { error: 'Failed to send PO', details: error.message },
      { status: 500 }
    );
  }
}
