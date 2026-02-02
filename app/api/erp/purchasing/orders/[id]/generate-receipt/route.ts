import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  const { id: orderId } = await params;

  try {
    // Fetch the purchase order details
    const poResult = await erpDb.execute(sql`
      SELECT 
        po.id,
        po.po_number,
        po.supplier_id,
        po.warehouse_id,
        po.status
      FROM purchase_orders po
      WHERE po.id = ${orderId}
        AND po.erp_organization_id = ${user.erpOrganizationId}
    `);

    const po = Array.from(poResult)[0] as any;
    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if PO is in a valid status to generate receipt
    if (!['draft', 'confirmed', 'sent', 'partially_received'].includes(po.status)) {
      return NextResponse.json(
        { error: `Cannot generate receipt for PO with status: ${po.status}. PO must be draft, confirmed, sent, or partially received.` },
        { status: 400 }
      );
    }

    // Generate receipt number
    const receiptCountResult = await erpDb.execute(sql`
      SELECT COUNT(*) as count
      FROM po_goods_receipts
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);
    const receiptCount = parseInt((Array.from(receiptCountResult)[0] as any).count || '0');
    const receiptNumber = `POGR-${String(receiptCount + 1).padStart(6, '0')}`;

    // Create PO goods receipt (allow NULL warehouse and supplier for draft POs)
    const receiptResult = await erpDb.execute(sql`
      INSERT INTO po_goods_receipts (
        erp_organization_id,
        purchase_order_id,
        warehouse_id,
        receipt_number,
        receipt_date,
        supplier_id,
        status,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${user.erpOrganizationId},
        ${orderId},
        ${po.warehouse_id || null},
        ${receiptNumber},
        CURRENT_DATE,
        ${po.supplier_id || null},
        'pending',
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING id, receipt_number
    `);

    const receipt = Array.from(receiptResult)[0] as any;

    // Fetch PO lines to create receipt lines
    const polResult = await erpDb.execute(sql`
      SELECT 
        pol.id,
        pol.product_id,
        pol.quantity_ordered,
        COALESCE(pol.quantity_received, 0) as quantity_received
      FROM purchase_order_lines pol
      WHERE pol.purchase_order_id = ${orderId}
    `);

    const poLines = Array.from(polResult) as any[];

    // Create receipt lines
    for (const line of poLines) {
      const quantityPending = parseFloat(line.quantity_ordered) - parseFloat(line.quantity_received);
      
      if (quantityPending > 0) {
        await erpDb.execute(sql`
          INSERT INTO po_goods_receipt_lines (
            po_goods_receipt_id,
            purchase_order_line_id,
            product_id,
            quantity_ordered,
            quantity_pending,
            quantity_received,
            created_at,
            updated_at
          ) VALUES (
            ${receipt.id},
            ${line.id},
            ${line.product_id},
            ${line.quantity_ordered},
            ${quantityPending},
            0,
            NOW(),
            NOW()
          )
        `);
      }
    }

    // Note: PO status will be updated when goods are actually received
    // Don't auto-change to partially_received just by generating the receipt

    return NextResponse.json({
      message: 'PO receipt generated successfully',
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receipt_number,
      },
    });
  } catch (err: any) {
    console.error('Error generating PO receipt:', err);
    return NextResponse.json(
      { error: 'Failed to generate PO receipt', details: err.message },
      { status: 500 }
    );
  }
}