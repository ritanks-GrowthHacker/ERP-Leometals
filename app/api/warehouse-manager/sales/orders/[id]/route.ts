import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getErpUserFromToken(req);
    if (!user || user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    const orderResult = await erpDb.execute<any>(sql`
      SELECT so.*, c.name as "customerName", w.name as "warehouseName"
      FROM sales_orders so
      INNER JOIN customers c ON so.customer_id = c.id
      INNER JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.id = ${id} AND so.warehouse_id = ${user.warehouseId}
    `);

    if (!orderResult || orderResult.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const linesResult = await erpDb.execute<any>(sql`
      SELECT sol.*, p.name as "productName"
      FROM sales_order_lines sol
      INNER JOIN products p ON sol.product_id = p.id
      WHERE sol.sales_order_id = ${id}
    `);

    const order = { ...orderResult[0], lines: linesResult };

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
