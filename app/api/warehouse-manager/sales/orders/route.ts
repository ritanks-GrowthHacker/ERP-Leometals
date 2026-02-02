import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    if (!user || user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await erpDb.execute<any>(sql`
      SELECT 
        so.id,
        so.so_number as "soNumber",
        so.so_date as "soDate",
        so.status,
        so.total_amount as "totalAmount",
        c.name as customer,
        w.name as warehouse
      FROM sales_orders so
      INNER JOIN customers c ON so.customer_id = c.id
      INNER JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.warehouse_id = ${user.warehouseId}
      ORDER BY so.so_date DESC
    `);

    const salesOrders = (result as any[]).map((row: any) => ({
      ...row,
      customer: { name: row.customer },
      warehouse: { name: row.warehouse },
    }));

    return NextResponse.json({ salesOrders });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
  }
}
