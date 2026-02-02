import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/purchasing/po-receipts - Fetch all PO receipts
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const receipts = await erpDb.execute(sql`
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
        s.name as supplier_name,
        s.id as supplier_id,
        w.name as warehouse_name,
        w.id as warehouse_id,
        COUNT(pgrl.id) as line_count
      FROM po_goods_receipts pgr
      JOIN purchase_orders po ON pgr.purchase_order_id = po.id
      LEFT JOIN suppliers s ON pgr.supplier_id = s.id
      LEFT JOIN warehouses w ON pgr.warehouse_id = w.id
      LEFT JOIN po_goods_receipt_lines pgrl ON pgr.id = pgrl.po_goods_receipt_id
      WHERE pgr.erp_organization_id = ${user.erpOrganizationId}
      GROUP BY pgr.id, po.po_number, po.id, s.name, s.id, w.name, w.id
      ORDER BY pgr.created_at DESC
    `);

    return NextResponse.json({
      receipts: Array.from(receipts),
    });
  } catch (err: any) {
    console.error('Error fetching PO receipts:', err);
    return NextResponse.json(
      { error: 'Failed to fetch PO receipts', details: err.message },
      { status: 500 }
    );
  }
}
