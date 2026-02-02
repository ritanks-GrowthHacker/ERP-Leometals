import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/inventory/stock-levels
 * Get current stock levels for products across warehouses
 * Requires: JWT token with 'read' scope
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const warehouseId = searchParams.get('warehouse_id');
    const lowStock = searchParams.get('low_stock');

    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validate UUIDs if provided
    if (productId && !uuidRegex.test(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product_id format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    if (warehouseId && !uuidRegex.test(warehouseId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid warehouse_id format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    let conditions = sql`p.erp_organization_id = ${user.erpOrganizationId}`;

    if (productId) {
      conditions = sql`${conditions} AND sl.product_id = ${productId}`;
    }

    if (warehouseId) {
      conditions = sql`${conditions} AND sl.warehouse_id = ${warehouseId}`;
    }

    const result = await erpDb.execute(sql`
      SELECT 
        sl.id,
        sl.product_id,
        p.name as product_name,
        p.sku,
        sl.warehouse_id,
        w.name as warehouse_name,
        sl.location_id,
        wl.name as location_name,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.quantity_available,
        sl.last_counted_at,
        sl.updated_at
      FROM stock_levels sl
      LEFT JOIN products p ON sl.product_id = p.id
      LEFT JOIN warehouses w ON sl.warehouse_id = w.id
      LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
      WHERE ${conditions}
      ORDER BY p.name, w.name, wl.name
    `);

    const stockLevels = result.map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      locationId: row.location_id,
      locationName: row.location_name,
      quantityOnHand: row.quantity_on_hand ? parseFloat(row.quantity_on_hand) : 0,
      quantityReserved: row.quantity_reserved ? parseFloat(row.quantity_reserved) : 0,
      quantityAvailable: row.quantity_available ? parseFloat(row.quantity_available) : 0,
      lastCountedAt: row.last_counted_at,
      updatedAt: row.updated_at
    }));

    // Filter low stock if requested
    let filteredStockLevels = stockLevels;
    if (lowStock === 'true') {
      filteredStockLevels = stockLevels.filter(s => s.quantityAvailable < 10);
    }

    return NextResponse.json({
      success: true,
      data: filteredStockLevels,
      count: filteredStockLevels.length
    });

  } catch (error: any) {
    console.error('Error fetching stock levels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock levels', details: error.message },
      { status: 500 }
    );
  }
}
