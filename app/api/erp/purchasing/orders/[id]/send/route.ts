import { NextRequest, NextResponse } from 'next/server';
import { erpDb, mainDb } from '@/lib/db';
import { purchaseOrders, purchaseOrderLines, suppliers } from '@/lib/db/schema/purchasing-sales';
import { products } from '@/lib/db/schema/inventory';
import { eq, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';
import { getPurchaseOrderEmailTemplate } from '@/lib/emailTemplates';
import { requireErpAccess } from '@/lib/auth';

// POST /api/erp/purchasing/orders/[id]/send
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    const { id: poId } = await params;

    // Fetch PO with details
    const [po] = await erpDb
      .select({
        po: purchaseOrders,
        supplier: suppliers,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, poId));

    if (!po || !po.supplier) {
      return NextResponse.json({ error: 'Purchase order or supplier not found' }, { status: 404 });
    }

    if (!po.supplier.email) {
      return NextResponse.json({ error: 'Supplier email not found' }, { status: 400 });
    }

    // Fetch PO lines with product details
    const lines = await erpDb
      .select({
        line: purchaseOrderLines,
        product: products,
      })
      .from(purchaseOrderLines)
      .leftJoin(products, eq(purchaseOrderLines.productId, products.id))
      .where(eq(purchaseOrderLines.purchaseOrderId, poId));

    // Fetch organization details from main DB
    const [org] = await mainDb.execute(
      sql`SELECT name, logo_url FROM organizations WHERE id = ${user.organizationId} LIMIT 1`
    );

    const organizationName = (org as any)?.name || 'Organization';
    const organizationLogo = (org as any)?.logo_url;

    // Prepare email data
    const emailData = {
      poNumber: po.po.poNumber,
      poDate: new Date(po.po.poDate).toLocaleDateString('en-IN'),
      expectedDeliveryDate: po.po.expectedDeliveryDate
        ? new Date(po.po.expectedDeliveryDate).toLocaleDateString('en-IN')
        : undefined,
      supplierName: po.supplier.name,
      supplierEmail: po.supplier.email,
      totalAmount: po.po.totalAmount || '0',
      currencyCode: po.po.currencyCode || 'INR',
      lines: lines.map(l => ({
        productName: l.product?.name || 'Unknown Product',
        description: l.line.description || undefined,
        quantity: l.line.quantityOrdered,
        unitPrice: l.line.unitPrice,
        total: (parseFloat(l.line.quantityOrdered) * parseFloat(l.line.unitPrice)).toString(),
      })),
    };

    // Generate and send email
    const emailHtml = getPurchaseOrderEmailTemplate(emailData, organizationName, organizationLogo);
    const emailResult = await sendEmail({
      to: po.supplier.email,
      subject: `Purchase Order ${po.po.poNumber} from ${organizationName}`,
      html: emailHtml,
    });

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send email: ' + emailResult.error }, { status: 500 });
    }

    // Update PO status to 'sent'
    await erpDb
      .update(purchaseOrders)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(purchaseOrders.id, poId));

    // Update ALL associated receipts to 'sent' status first
    await erpDb.execute(sql`
      UPDATE po_goods_receipts
      SET status = 'sent', updated_at = NOW()
      WHERE purchase_order_id = ${poId}
        AND erp_organization_id = ${user.erpOrganizationId}
        AND status IN ('pending', 'draft')
    `);

    // Then fetch receipts to send emails
    try {
      const receiptsResult = await erpDb.execute(sql`
        SELECT 
          pgr.id,
          pgr.receipt_number,
          pgr.receipt_date,
          pgr.status,
          po.po_number,
          s.name as supplier_name,
          s.email as supplier_email,
          w.name as warehouse_name,
          w.manager_id
        FROM po_goods_receipts pgr
        JOIN purchase_orders po ON pgr.purchase_order_id = po.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN warehouses w ON po.warehouse_id = w.id
        WHERE pgr.purchase_order_id = ${poId}
          AND pgr.erp_organization_id = ${user.erpOrganizationId}
      `);

      const receipts = Array.from(receiptsResult);

      // Send receipt emails to supplier and warehouse manager
      for (const receipt of receipts) {
          const typedReceipt = receipt as any;
          // Get warehouse manager email
          let warehouseManagerEmail = null;
          if (typedReceipt.manager_id) {
            const managerResult = await erpDb.execute(sql`
              SELECT email FROM users WHERE id = ${typedReceipt.manager_id}
            `);
            const manager = Array.from(managerResult)[0] as any;
            if (manager) {
              warehouseManagerEmail = manager.email;
            }
          }

          // Fetch receipt lines
          const linesResult = await erpDb.execute(sql`
            SELECT 
              p.name as product_name,
              pgrl.quantity_pending
            FROM po_goods_receipt_lines pgrl
            JOIN products p ON pgrl.product_id = p.id
            WHERE pgrl.po_goods_receipt_id = ${typedReceipt.id}
          `);
          const receiptLines = Array.from(linesResult);

          // Email HTML template
          const receiptEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Goods Receipt</title>
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
              <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0;">📦 Goods Receipt</h1>
                  <p style="color: #e9d5ff; margin: 10px 0 0 0;">Receipt #${typedReceipt.receipt_number}</p>
                </div>
                <div style="padding: 30px;">
                  <h3 style="color: #1f2937;">Hello ${typedReceipt.supplier_name},</h3>
                  <p style="color: #4b5563; line-height: 1.6;">
                    A goods receipt has been generated for your purchase order. Please review the details below:
                  </p>
                  <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Receipt Number:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${typedReceipt.receipt_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">PO Number:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${typedReceipt.po_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Receipt Date:</td>
                        <td style="padding: 8px 0; color: #1f2937; text-align: right;">${typedReceipt.receipt_date ? new Date(typedReceipt.receipt_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Warehouse:</td>
                        <td style="padding: 8px 0; color: #1f2937; text-align: right;">${typedReceipt.warehouse_name || 'N/A'}</td>
                      </tr>
                    </table>
                  </div>
                  <h4 style="color: #1f2937; margin: 20px 0 10px 0;">Items:</h4>
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                      <tr style="background-color: #f3f4f6;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${receiptLines.map((line: any) => `
                        <tr>
                          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${line.product_name}</td>
                          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">${line.quantity_pending}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                  <p style="color: #4b5563; line-height: 1.6;">
                    Please prepare the goods for delivery to ${typedReceipt.warehouse_name || 'the warehouse'}.
                  </p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">This is an automated email. Please do not reply.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          // Send to supplier
          if (typedReceipt.supplier_email) {
            await sendEmail({
              to: typedReceipt.supplier_email,
              subject: `Goods Receipt ${typedReceipt.receipt_number} - PO ${typedReceipt.po_number}`,
              html: receiptEmailHtml,
            });
          }

          // Send to warehouse manager
          if (warehouseManagerEmail) {
            const warehouseEmailHtml = receiptEmailHtml
              .replace(`Hello ${typedReceipt.supplier_name}`, 'Hello Warehouse Manager')
              .replace('A goods receipt has been generated for your purchase order', 'A goods receipt has been assigned to your warehouse')
              .replace(`Please prepare the goods for delivery to ${typedReceipt.warehouse_name || 'the warehouse'}.`, 'Please prepare to receive these goods.');

            await sendEmail({
              to: warehouseManagerEmail,
              subject: `Incoming Goods Receipt ${typedReceipt.receipt_number}`,
              html: warehouseEmailHtml,
            });
          }
        }
    } catch (receiptError) {
      console.error('Error sending receipt emails:', receiptError);
      // Don't fail the whole request if receipt emails fail
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase order sent successfully',
      messageId: emailResult.messageId,
    });
  } catch (error: any) {
    console.error('Error sending PO:', error);
    return NextResponse.json({ error: error.message || 'Failed to send purchase order' }, { status: 500 });
  }
}
