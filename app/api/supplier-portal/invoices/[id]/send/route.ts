import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { jwtVerify } from 'jose';
import { sendWarehouseNotification } from '@/lib/warehouseNotifications';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifySupplierToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.type !== 'supplier') {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supplier = await verifySupplierToken(req);
  
  if (!supplier) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { id: invoiceId } = await params;

    // Verify invoice belongs to supplier using raw query
    const result = await erpDb.execute(sql`
      SELECT * FROM supplier_invoices WHERE id = ${invoiceId}
    `);

    const invoice = Array.from(result)[0] as any;

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.supplier_id !== supplier.supplierId) {
      return NextResponse.json(
        { error: 'Unauthorized access to this invoice' },
        { status: 403 }
      );
    }

    // Update invoice status to sent
    await erpDb.execute(sql`
      UPDATE supplier_invoices 
      SET payment_status = 'sent', updated_at = NOW() 
      WHERE id = ${invoiceId}
    `);

    // Send email notification to warehouse
    console.log('🔔 Sending invoice send notification to warehouse...');
    try {
      // Get full invoice and warehouse details
      const detailsResult = await erpDb.execute(sql`
        SELECT 
          si.invoice_number,
          si.total_amount,
          si.due_date,
          sq.submission_number,
          po.warehouse_id as po_warehouse_id,
          po.po_number,
          rfq.warehouse_id as rfq_warehouse_id,
          rfq.rfq_number,
          s.name as supplier_name
        FROM supplier_invoices si
        LEFT JOIN supplier_quotation_submissions sq ON si.quotation_id = sq.id
        LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
        LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = ${invoiceId}
      `);
      
      const details = Array.from(detailsResult)[0] as any;
      const warehouseId = details?.po_warehouse_id || details?.rfq_warehouse_id;
      
      console.log('Invoice send details:', {
        invoiceNumber: details?.invoice_number,
        warehouseId,
        supplier_name: details?.supplier_name,
        total_amount: details?.total_amount,
      });
      
      if (warehouseId && details) {
        await sendWarehouseNotification({
          warehouseId,
          subject: 'Supplier Invoice - Payment Required',
          message: `
            <p><strong>A supplier invoice is awaiting payment.</strong></p>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
                <td style="padding: 8px 0; font-weight: 600;">${details.invoice_number || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
                <td style="padding: 8px 0; font-weight: 600;">${details.supplier_name || 'Unknown'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${details.due_date ? new Date(details.due_date).toLocaleDateString('en-IN') : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #dc2626; font-size: 18px;">₹${parseFloat(details.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
            <p style="margin-top: 20px;">⚠️ This invoice requires immediate attention for payment processing.</p>
          `,
          eventType: '🧾 Invoice Payment Required',
        });
        console.log('✅ Warehouse notification sent successfully');
      } else {
        console.warn('⚠️ No warehouse_id found for invoice send notification');
      }
    } catch (emailError) {
      console.error('❌ Failed to send invoice send email:', emailError);
      // Don't fail the API call if email fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invoice sent successfully' 
    });
  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
