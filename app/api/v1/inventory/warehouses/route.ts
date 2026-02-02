import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/inventory/warehouses
 * List all warehouses
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
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('is_active');

    let conditions = sql`w.erp_organization_id = ${user.erpOrganizationId}`;

    if (search) {
      conditions = sql`${conditions} AND (
        LOWER(w.name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(w.code) LIKE LOWER(${'%' + search + '%'})
      )`;
    }

    if (isActive === 'true') {
      conditions = sql`${conditions} AND w.is_active = true`;
    } else if (isActive === 'false') {
      conditions = sql`${conditions} AND w.is_active = false`;
    }

    const result = await erpDb.execute(sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        w.address,
        w.city,
        w.state,
        w.postal_code,
        w.country,
        w.phone,
        w.email,
        w.manager_user_id,
        w.is_active,
        w.created_at,
        w.updated_at,
        wm.id as manager_id,
        wm.name as manager_name,
        wm.address as manager_address,
        wm.mobile_number as manager_mobile,
        wm.gender as manager_gender
      FROM warehouses w
      LEFT JOIN warehouse_managers wm ON w.id = wm.warehouse_id
      WHERE ${conditions}
      ORDER BY w.name ASC
    `);

    const warehouses = result.map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      address: row.address,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      phone: row.phone,
      email: row.email,
      managerUserId: row.manager_user_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      manager: row.manager_id ? {
        id: row.manager_id,
        name: row.manager_name,
        address: row.manager_address,
        mobileNumber: row.manager_mobile,
        gender: row.manager_gender
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: warehouses
    });

  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch warehouses', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/inventory/warehouses
 * Create a new warehouse
 * Requires: JWT token with 'write' scope
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { 
      name, 
      code, 
      address, 
      city, 
      state, 
      postalCode, 
      country,
      phone,
      email,
      manager
    } = body;

    // Helper function to convert empty strings to null
    const sanitizeValue = (value: any) => {
      if (value === '' || value === undefined || value === null) return null;
      return value;
    };

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Warehouse name and code are required' },
        { status: 400 }
      );
    }

    // Check if warehouse code already exists
    const existingWarehouse = await erpDb.execute(sql`
      SELECT id FROM warehouses
      WHERE code = ${code} AND erp_organization_id = ${user.erpOrganizationId}
    `);

    if (existingWarehouse && existingWarehouse.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A warehouse with this code already exists' },
        { status: 409 }
      );
    }

    // Validate manager gender if provided
    if (manager?.gender && sanitizeValue(manager.gender)) {
      const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
      if (!validGenders.includes(manager.gender)) {
        return NextResponse.json(
          { success: false, error: `Invalid gender. Must be one of: ${validGenders.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Create warehouse
    const warehouseResult = await erpDb.execute(sql`
      INSERT INTO warehouses (
        erp_organization_id,
        name, 
        code, 
        address, 
        city, 
        state, 
        postal_code, 
        country,
        phone,
        email
      )
      VALUES (
        ${user.erpOrganizationId},
        ${name}, 
        ${code}, 
        ${sanitizeValue(address)}, 
        ${sanitizeValue(city)}, 
        ${sanitizeValue(state)}, 
        ${sanitizeValue(postalCode)}, 
        ${sanitizeValue(country)},
        ${sanitizeValue(phone)},
        ${sanitizeValue(email)}
      )
      RETURNING *
    `);

    const warehouse = warehouseResult[0] as any;

    // Create warehouse manager if details provided
    let managerData = null;
    if (manager && sanitizeValue(manager.name)) {
      const managerResult = await erpDb.execute(sql`
        INSERT INTO warehouse_managers (
          warehouse_id,
          name,
          address,
          mobile_number,
          gender
        )
        VALUES (
          ${warehouse.id},
          ${manager.name},
          ${sanitizeValue(manager.address)},
          ${sanitizeValue(manager.mobileNumber)},
          ${sanitizeValue(manager.gender)}
        )
        RETURNING *
      `);
      
      const mgr = managerResult[0] as any;
      managerData = {
        id: mgr.id,
        name: mgr.name,
        address: mgr.address,
        mobileNumber: mgr.mobile_number,
        gender: mgr.gender,
        createdAt: mgr.created_at,
        updatedAt: mgr.updated_at
      };
    }

    return NextResponse.json({
      success: true,
      message: 'Warehouse created successfully',
      data: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address,
        city: warehouse.city,
        state: warehouse.state,
        postalCode: warehouse.postal_code,
        country: warehouse.country,
        phone: warehouse.phone,
        email: warehouse.email,
        isActive: warehouse.is_active,
        createdAt: warehouse.created_at,
        updatedAt: warehouse.updated_at,
        manager: managerData
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create warehouse', details: error.message },
      { status: 500 }
    );
  }
}
