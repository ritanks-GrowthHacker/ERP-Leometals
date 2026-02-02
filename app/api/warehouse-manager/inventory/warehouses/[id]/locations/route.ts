import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { getErpUserFromToken } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(
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

    const { id: warehouseId } = await params;

    // Verify warehouse belongs to manager
    if (warehouseId !== user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all locations for this warehouse
    const query = sql`
      SELECT 
        id,
        name,
        code,
        location_type,
        address,
        capacity,
        manager_name,
        manager_email,
        manager_mobile,
        is_active,
        warehouse_id,
        created_at
      FROM warehouse_locations
      WHERE warehouse_id = ${warehouseId}
      ORDER BY name ASC
    `;

    const locations = await erpDb.execute(query);

    return NextResponse.json({ locations: Array.from(locations) });
  } catch (error: any) {
    console.error('Error fetching warehouse locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const { id: warehouseId } = await params;

    // Verify warehouse belongs to manager
    if (warehouseId !== user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, locationType, address, capacity, managerName, managerEmail, managerMobile } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Create location
    const insertQuery = sql`
      INSERT INTO warehouse_locations (
        warehouse_id, name, code, location_type, address, capacity,
        manager_name, manager_email, manager_mobile, is_active
      )
      VALUES (
        ${warehouseId}, ${name}, ${code}, ${locationType || null}, ${address || null},
        ${capacity || null}, ${managerName || null}, ${managerEmail || null},
        ${managerMobile || null}, true
      )
      RETURNING *
    `;

    const result = await erpDb.execute(insertQuery);
    const location = Array.from(result)[0];

    return NextResponse.json({ location }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating warehouse location:', error);
    return NextResponse.json(
      { error: 'Failed to create location', details: error.message },
      { status: 500 }
    );
  }
}
