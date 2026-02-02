import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get goods receipts for organization
    const query = sql`
      SELECT 
        gr.id,
        gr.receipt_number,
        gr.receipt_date,
        gr.received_by,
        gr.status,
        po.po_number,
        s.name as supplier_name,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM goods_receipt_lines WHERE goods_receipt_id = gr.id) as line_count
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
      LEFT JOIN suppliers s ON gr.supplier_id = s.id
      LEFT JOIN warehouses w ON gr.warehouse_id = w.id
      WHERE gr.erp_organization_id = ${user.organizationId}
      ORDER BY gr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const goodsReceipts = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM goods_receipts
      WHERE erp_organization_id = ${user.organizationId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      goodsReceipts: Array.from(goodsReceipts),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching goods receipts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goods receipts', details: error.message },
      { status: 500 }
    );
  }
}
