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

    // Get warehouse with its locations
    const warehouseQuery = sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        w.address,
        w.city,
        w.state,
        w.country,
        w.postal_code,
        w.phone,
        w.email,
        w.is_active,
        (SELECT COUNT(*) FROM warehouse_locations WHERE warehouse_id = w.id) as location_count
      FROM warehouses w
      WHERE w.id = ${user.warehouseId}
    `;

    const warehouse = await erpDb.execute(warehouseQuery);
    const warehouseData = (warehouse as any)[0];

    if (!warehouseData) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // Get locations for this warehouse
    const locationsQuery = sql`
      SELECT 
        wl.id,
        wl.warehouse_id,
        wl.name,
        wl.code,
        wl.location_type,
        wl.address,
        wl.manager_name,
        wl.manager_email,
        wl.manager_mobile,
        wl.is_active,
        (SELECT COUNT(*) FROM stock_levels WHERE location_id = wl.id) as product_count
      FROM warehouse_locations wl
      WHERE wl.warehouse_id = ${user.warehouseId}
      ORDER BY wl.name ASC
    `;

    const locations = await erpDb.execute(locationsQuery);

    return NextResponse.json({
      warehouse: warehouseData,
      locations: Array.from(locations),
    });
  } catch (error: any) {
    console.error('Error fetching warehouse details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouse', details: error.message },
      { status: 500 }
    );
  }
}
