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

    // Get RFQ details
    const rfqQuery = sql`
      SELECT rfq.*, 
        (SELECT COUNT(*) FROM rfq_suppliers WHERE rfq_id = rfq.id) as supplier_count
      FROM request_for_quotations rfq
      WHERE rfq.id = ${id} 
        AND rfq.erp_organization_id = ${user.organizationId}
    `;
    const rfqResult = await erpDb.execute(rfqQuery);
    const rfq = (rfqResult as any)[0];

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    // Get suppliers
    const suppliersQuery = sql`
      SELECT s.id, s.name, s.email, rs.id as rfq_supplier_id
      FROM rfq_suppliers rs
      JOIN suppliers s ON rs.supplier_id = s.id
      WHERE rs.rfq_id = ${id}
    `;
    const suppliers = await erpDb.execute(suppliersQuery);

    if ((suppliers as any[]).length === 0) {
      return NextResponse.json({ error: 'No suppliers found for this RFQ' }, { status: 400 });
    }

    // Get RFQ lines
    const linesQuery = sql`
      SELECT rl.*, p.name as product_name, p.sku
      FROM rfq_lines rl
      JOIN products p ON rl.product_id = p.id
      WHERE rl.rfq_id = ${id}
    `;
    const lines = await erpDb.execute(linesQuery);

    // Send emails to all suppliers
    let sentCount = 0;
    for (const supplier of suppliers as any[]) {
      if (!supplier.email) continue;

      try {
        const emailResult = await sendEmail({
          to: supplier.email,
          subject: `RFQ ${rfq.rfq_number}: ${rfq.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Request for Quotation</h2>
              <p>Dear ${supplier.name},</p>
              <p>We would like to request a quotation for the following items:</p>
              
              <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p><strong>RFQ Number:</strong> ${rfq.rfq_number}</p>
                <p><strong>Title:</strong> ${rfq.title}</p>
                <p><strong>Deadline:</strong> ${rfq.deadline_date || 'Not specified'}</p>
              </div>

              <h3 style="color: #555;">Items Requested:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #e0e0e0;">
                    <th style="padding: 10px; text-align: left; border: 1px solid #ccc;">Product</th>
                    <th style="padding: 10px; text-align: left; border: 1px solid #ccc;">SKU</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #ccc;">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  ${(lines as any[]).map(line => `
                    <tr>
                      <td style="padding: 10px; border: 1px solid #ccc;">${line.product_name}</td>
                      <td style="padding: 10px; border: 1px solid #ccc;">${line.sku || '-'}</td>
                      <td style="padding: 10px; text-align: right; border: 1px solid #ccc;">${line.quantity_requested}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              ${rfq.notes ? `<p style="margin-top: 20px;"><strong>Notes:</strong><br>${rfq.notes}</p>` : ''}

              <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 5px; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #333;">Submit Your Quotation</p>
                <a href="http://localhost:3000/supplier-portal" style="display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Supplier Portal</a>
              </div>

              <p style="margin-top: 20px;">Please submit your quotation by the deadline date.</p>
              <p>Best regards,<br>Purchasing Department</p>
            </div>
          `,
        });

        if (emailResult.success) {
          // Mark as sent
          await erpDb.execute(sql`
            UPDATE rfq_suppliers 
            SET responded = false, response_date = NULL
            WHERE id = ${supplier.rfq_supplier_id}
          `);
          sentCount++;
        } else {
          console.error(`Failed to send email to ${supplier.email}:`, emailResult.error);
        }
      } catch (emailError) {
        console.error(`Failed to send email to ${supplier.email}:`, emailError);
      }
    }

    // Update RFQ status to sent
    await erpDb.execute(sql`
      UPDATE request_for_quotations
      SET status = 'sent', updated_at = NOW()
      WHERE id = ${id}
    `);

    return NextResponse.json({ 
      success: true, 
      message: `RFQ sent to ${sentCount} supplier(s)`,
      sentCount 
    });
  } catch (error: any) {
    console.error('Error sending RFQ:', error);
    return NextResponse.json(
      { error: 'Failed to send RFQ', details: error.message },
      { status: 500 }
    );
  }
}
