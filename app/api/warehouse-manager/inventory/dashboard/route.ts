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

    // Get inventory metrics for this warehouse
    const metricsQuery = sql`
      SELECT 
        COUNT(DISTINCT sl.product_id) as total_products,
        COALESCE(SUM(sl.quantity_on_hand), 0) as total_stock,
        COALESCE(SUM(sl.quantity_on_hand * p.cost_price), 0) as total_value,
        COUNT(DISTINCT CASE WHEN sl.quantity_on_hand <= p.reorder_point THEN sl.product_id END) as low_stock_count
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE sl.warehouse_id = ${user.warehouseId}
    `;

    const metrics = await erpDb.execute(metricsQuery);
    const metricsData = (metrics as any)[0] || {
      total_products: 0,
      total_stock: 0,
      total_value: 0,
      low_stock_count: 0
    };

    // Get recent stock movements
    const movementsQuery = sql`
      SELECT 
        sm.id,
        sm.movement_type,
        sm.status,
        sm.created_at,
        COUNT(sml.id) as line_count
      FROM stock_movements sm
      LEFT JOIN stock_movement_lines sml ON sm.id = sml.stock_movement_id
      WHERE (sm.source_warehouse_id = ${user.warehouseId} OR sm.destination_warehouse_id = ${user.warehouseId})
      GROUP BY sm.id, sm.movement_type, sm.status, sm.created_at
      ORDER BY sm.created_at DESC
      LIMIT 5
    `;

    const movements = await erpDb.execute(movementsQuery);

    // Get low stock products
    const lowStockQuery = sql`
      SELECT 
        p.id,
        p.name,
        p.sku,
        sl.quantity_on_hand,
        p.reorder_point
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE sl.warehouse_id = ${user.warehouseId}
        AND sl.quantity_on_hand <= p.reorder_point
      ORDER BY (sl.quantity_on_hand - p.reorder_point) ASC
      LIMIT 10
    `;

    const lowStock = await erpDb.execute(lowStockQuery);

    return NextResponse.json({
      total_products: Number(metricsData.total_products) || 0,
      total_stock: Number(metricsData.total_stock) || 0,
      total_value: Number(metricsData.total_value) || 0,
      low_stock_count: Number(metricsData.low_stock_count) || 0,
      recent_movements: Array.from(movements).map((m: any) => ({
        id: m.id,
        movement_type: m.movement_type,
        quantity: m.line_count || 0,
        product_name: m.movement_type,
        movement_date: m.created_at,
      })),
      low_stock_products: Array.from(lowStock).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: Number(p.quantity_on_hand) || 0,
        reorder_point: Number(p.reorder_point) || 0,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching warehouse metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    );
  }
}
