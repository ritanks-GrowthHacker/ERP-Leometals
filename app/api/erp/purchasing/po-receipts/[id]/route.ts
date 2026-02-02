import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';

// GET /api/erp/purchasing/po-receipts/[id] - Get receipt details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  const { id: receiptId } = await params;

  try {
    // Fetch receipt details
    const receiptResult = await erpDb.execute(sql`
      SELECT 
        pgr.id,
        pgr.receipt_number,
        pgr.receipt_date,
        pgr.status,
        pgr.supplier_attached,
        pgr.notes,
        pgr.created_at,
        po.po_number,
        po.id as purchase_order_id,
        po.po_date,
        po.total_amount as po_total_amount,
        s.name as supplier_name,
        s.id as supplier_id,
        s.email as supplier_email,
        s.phone as supplier_phone,
        w.name as warehouse_name,
        w.id as warehouse_id
      FROM po_goods_receipts pgr
      JOIN purchase_orders po ON pgr.purchase_order_id = po.id
      LEFT JOIN suppliers s ON pgr.supplier_id = s.id
      LEFT JOIN warehouses w ON pgr.warehouse_id = w.id
      WHERE pgr.id = ${receiptId}
        AND pgr.erp_organization_id = ${user.erpOrganizationId}
    `);

    const receipt = Array.from(receiptResult)[0] as any;
    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Fetch receipt lines
    const linesResult = await erpDb.execute(sql`
      SELECT 
        pgrl.id,
        pgrl.quantity_ordered,
        pgrl.quantity_pending,
        pgrl.quantity_received,
        pgrl.notes,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        pol.unit_price
      FROM po_goods_receipt_lines pgrl
      JOIN products p ON pgrl.product_id = p.id
      JOIN purchase_order_lines pol ON pgrl.purchase_order_line_id = pol.id
      WHERE pgrl.po_goods_receipt_id = ${receiptId}
      ORDER BY p.name
    `);

    receipt.lines = Array.from(linesResult);

    return NextResponse.json({ receipt });
  } catch (err: any) {
    console.error('Error fetching receipt details:', err);
    return NextResponse.json(
      { error: 'Failed to fetch receipt details', details: err.message },
      { status: 500 }
    );
  }
}

// PATCH /api/erp/purchasing/po-receipts/[id] - Update receipt (attach supplier, update quantities, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  const { id: receiptId } = await params;
  const body = await req.json();

  try {
    // If attaching supplier
    if (body.action === 'attach_supplier') {
      const { supplierId, warehouseId } = body;

      if (!supplierId || !warehouseId) {
        return NextResponse.json(
          { error: 'Supplier and warehouse are required' },
          { status: 400 }
        );
      }

      try {
        // Get the receipt details to find the purchase order
        const receiptResult = await erpDb.execute(sql`
          SELECT purchase_order_id, status
          FROM po_goods_receipts
          WHERE id = ${receiptId}
            AND erp_organization_id = ${user.erpOrganizationId}
        `);
        
        const receipt = Array.from(receiptResult)[0] as any;
        if (!receipt) {
          return NextResponse.json(
            { error: 'Receipt not found' },
            { status: 404 }
          );
        }

        // Update receipt to mark supplier attached, add supplier/warehouse
        await erpDb.execute(sql`
          UPDATE po_goods_receipts
          SET 
            supplier_id = ${supplierId},
            warehouse_id = ${warehouseId},
            supplier_attached = true,
            updated_at = NOW()
          WHERE id = ${receiptId}
            AND erp_organization_id = ${user.erpOrganizationId}
        `);

        // Update the purchase order to add supplier/warehouse (don't change status yet)
        await erpDb.execute(sql`
          UPDATE purchase_orders
          SET 
            supplier_id = ${supplierId},
            warehouse_id = ${warehouseId},
            updated_at = NOW()
          WHERE id = ${receipt.purchase_order_id}
            AND erp_organization_id = ${user.erpOrganizationId}
        `);

        return NextResponse.json({
          message: 'Supplier and warehouse attached successfully. You can now send the PO from the Orders page.',
        });
      } catch (error: any) {
        console.error('Error in attach_supplier:', error);
        return NextResponse.json(
          { error: 'Failed to attach supplier', details: error.message },
          { status: 500 }
        );
      }
    }

    // If updating quantities received
    if (body.action === 'update_quantities' && body.lines) {
      for (const line of body.lines) {
        await erpDb.execute(sql`
          UPDATE po_goods_receipt_lines
          SET 
            quantity_received = ${line.quantityReceived},
            notes = ${line.notes || ''},
            updated_at = NOW()
          WHERE id = ${line.id}
        `);
      }

      // Update receipt status to received
      await erpDb.execute(sql`
        UPDATE po_goods_receipts
        SET 
          status = 'received',
          updated_at = NOW()
        WHERE id = ${receiptId}
          AND erp_organization_id = ${user.erpOrganizationId}
      `);

      // Update purchase order quantities and status
      const receiptResult = await erpDb.execute(sql`
        SELECT purchase_order_id FROM po_goods_receipts
        WHERE id = ${receiptId}
      `);
      const poId = (Array.from(receiptResult)[0] as any).purchase_order_id;

      // Update PO line quantities
      for (const line of body.lines) {
        await erpDb.execute(sql`
          UPDATE purchase_order_lines
          SET quantity_received = COALESCE(quantity_received, 0) + ${line.quantityReceived}
          WHERE id = (
            SELECT purchase_order_line_id 
            FROM po_goods_receipt_lines 
            WHERE id = ${line.id}
          )
        `);
      }

      // Check if all items are received and update PO status
      const checkResult = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_lines,
          COUNT(CASE WHEN quantity_received >= quantity_ordered THEN 1 END) as received_lines
        FROM purchase_order_lines
        WHERE purchase_order_id = ${poId}
      `);
      
      const check = Array.from(checkResult)[0] as any;
      if (check.total_lines === check.received_lines) {
        await erpDb.execute(sql`
          UPDATE purchase_orders
          SET status = 'received', updated_at = NOW()
          WHERE id = ${poId}
        `);
      } else {
        await erpDb.execute(sql`
          UPDATE purchase_orders
          SET status = 'partially_received', updated_at = NOW()
          WHERE id = ${poId}
        `);
      }

      return NextResponse.json({
        message: 'Receipt quantities updated successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error updating receipt:', err);
    return NextResponse.json(
      { error: 'Failed to update receipt', details: err.message },
      { status: 500 }
    );
  }
}
