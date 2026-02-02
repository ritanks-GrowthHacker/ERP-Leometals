import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id: locationId } = await params;

    // Get location details (ensure it belongs to the user's warehouse)
    const locationQuery = sql`
      SELECT 
        wl.*,
        w.name as warehouse_name
      FROM warehouse_locations wl
      INNER JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE wl.id = ${locationId}
        AND wl.warehouse_id = ${user.warehouseId}
    `;

    const location = await erpDb.execute(locationQuery);
    const locationData = (location as any)[0];

    if (!locationData) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get stock levels for this location
    const stockQuery = sql`
      SELECT 
        sl.id,
        sl.product_id,
        p.name as product_name,
        p.sku as product_sku,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.quantity_on_hand as quantity_available
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE sl.location_id = ${locationId}
        AND sl.warehouse_id = ${user.warehouseId}
      ORDER BY p.name ASC
    `;

    const stockLevels = await erpDb.execute(stockQuery);

    return NextResponse.json({
      location: locationData,
      stockLevels: Array.from(stockLevels).map((s: any) => ({
        id: s.id,
        product_id: s.product_id,
        product_name: s.product_name,
        product_sku: s.product_sku,
        quantity_on_hand: Number(s.quantity_on_hand) || 0,
        quantity_reserved: Number(s.quantity_reserved) || 0,
        quantity_available: Number(s.quantity_available) || 0,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching location details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id: locationId } = await params;
    const { isActive } = await req.json();

    // Verify location belongs to manager's warehouse
    const checkQuery = sql`
      SELECT id FROM warehouse_locations
      WHERE id = ${locationId} AND warehouse_id = ${user.warehouseId}
    `;

    const locationCheck = await erpDb.execute(checkQuery);
    if (!locationCheck || (locationCheck as any).length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Update location status
    const updateQuery = sql`
      UPDATE warehouse_locations
      SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = ${locationId}
      RETURNING *
    `;

    const result = await erpDb.execute(updateQuery);

    return NextResponse.json({ location: (result as any)[0] });
  } catch (error: any) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location', details: error.message },
      { status: 500 }
    );
  }
}
