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

    // Get sales orders for this warehouse
    const query = sql`
      SELECT 
        so.id,
        so.so_number as order_number,
        so.so_date as order_date,
        so.expected_delivery_date as delivery_date,
        so.status,
        so.total_amount,
        so.currency_code,
        so.created_at,
        c.name as customer_name,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM sales_order_lines WHERE sales_order_id = so.id) as line_count
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.warehouse_id = ${user.warehouseId}
      ORDER BY so.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const salesOrders = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM sales_orders
      WHERE warehouse_id = ${user.warehouseId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      salesOrders: Array.from(salesOrders),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching warehouse sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders', details: error.message },
      { status: 500 }
    );
  }
}
