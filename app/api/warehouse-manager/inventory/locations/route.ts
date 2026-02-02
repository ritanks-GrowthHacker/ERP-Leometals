import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, capacity, manager_email, manager_phone } = body;

    // Insert new location for this warehouse
    const insertQuery = sql`
      INSERT INTO warehouse_locations (
        warehouse_id,
        name,
        address,
        capacity,
        manager_email,
        manager_phone,
        status,
        erp_organization_id,
        created_at,
        updated_at
      ) VALUES (
        ${user.warehouseId},
        ${name},
        ${address || null},
        ${capacity || null},
        ${manager_email || null},
        ${manager_phone || null},
        'active',
        ${user.organizationId},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const result = await erpDb.execute(insertQuery);
    const location = (result as any)[0];

    return NextResponse.json({
      success: true,
      location,
    });
  } catch (error: any) {
    console.error('Error creating warehouse location:', error);
    return NextResponse.json(
      { error: 'Failed to create warehouse location', details: error.message },
      { status: 500 }
    );
  }
}
