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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Purchase analytics for this warehouse
    const purchaseAnalytics = await erpDb.execute(sql`
      SELECT 
        COUNT(*) as total_pos,
        SUM(total_amount) as total_purchase_value,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_pos,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_pos,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as received_pos
      FROM purchase_orders
      WHERE warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND po_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND po_date <= ${endDate}` : sql``}
    `);

    // Goods receipts for this warehouse
    const goodsReceiptAnalytics = await erpDb.execute(sql`
      SELECT 
        COUNT(*) as total_receipts,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_receipts,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as completed_receipts
      FROM goods_receipts
      WHERE warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND receipt_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND receipt_date <= ${endDate}` : sql``}
    `);

    // Top suppliers by PO count
    const topSuppliers = await erpDb.execute(sql`
      SELECT 
        s.name as supplier_name,
        COUNT(po.id) as po_count,
        SUM(po.total_amount) as total_value
      FROM suppliers s
      INNER JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE po.warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND po.po_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND po.po_date <= ${endDate}` : sql``}
      GROUP BY s.id, s.name
      ORDER BY po_count DESC
      LIMIT 10
    `);

    return NextResponse.json({
      purchaseAnalytics: (purchaseAnalytics as any)[0],
      goodsReceiptAnalytics: (goodsReceiptAnalytics as any)[0],
      topSuppliers: Array.from(topSuppliers),
    });
  } catch (error: any) {
    console.error('Error fetching purchase analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase analytics', details: error.message },
      { status: 500 }
    );
  }
}
