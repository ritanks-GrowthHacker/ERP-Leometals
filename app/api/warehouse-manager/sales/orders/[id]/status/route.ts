import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Verify order belongs to warehouse
    const orderCheck = sql`
      SELECT id FROM sales_orders
      WHERE id = ${orderId} AND warehouse_id = ${user.warehouseId}
    `;
    
    const orderExists = await erpDb.execute(orderCheck);
    
    if (!orderExists || (orderExists as any).length === 0) {
      return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
    }

    // Update order status
    const updateQuery = sql`
      UPDATE sales_orders
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${orderId}
      RETURNING id, so_number, status
    `;

    const result = await erpDb.execute(updateQuery);

    if (!result || (result as any).length === 0) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Order status updated successfully',
      order: (result as any)[0],
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: 'Failed to update order status', details: error.message },
      { status: 500 }
    );
  }
}
