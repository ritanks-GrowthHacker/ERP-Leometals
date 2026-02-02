import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouses, warehouseManagers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/inventory/warehouses
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view warehouses' },
      { status: 403 }
    );
  }

  try {
    const warehousesList = await erpDb.query.warehouses.findMany({
      where: eq(warehouses.erpOrganizationId, user.erpOrganizationId),
      with: {
        locations: true,
        manager: true,
      },
    });

    return NextResponse.json({ warehouses: warehousesList });
  } catch (error: any) {
    logDatabaseError('Fetching warehouses', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/inventory/warehouses
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create warehouses' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      name,
      code,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      email,
      managerUserId,
      managerName,
      managerEmail,
      managerAddress,
      managerMobile,
      managerGender,
    } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.erpOrganizationId, user.erpOrganizationId),
        eq(warehouses.code, code)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Warehouse with this code already exists' },
        { status: 409 }
      );
    }

    const [newWarehouse] = await erpDb
      .insert(warehouses)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        name,
        code,
        address,
        city,
        state,
        country,
        postalCode,
        phone,
        email,
        managerUserId: sanitizeUuid(managerUserId),
        isActive: true,
      })
      .returning();

    // Create manager record if manager details provided
    let manager = null;
    if (managerName) {
      const [newManager] = await erpDb
        .insert(warehouseManagers)
        .values({
          warehouseId: newWarehouse.id,
          name: managerName,
          email: managerEmail,
          address: managerAddress,
          mobileNumber: managerMobile,
          gender: managerGender,
        })
        .returning();
      manager = newManager;
    }

    return NextResponse.json({ warehouse: newWarehouse, manager }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating warehouse', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/inventory/warehouses
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update warehouses' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      id,
      name,
      code,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      email,
      managerUserId,
      isActive,
      managerName,
      managerEmail,
      managerAddress,
      managerMobile,
      managerGender,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Check if warehouse exists and belongs to user's organization
    const existingWarehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, id),
        eq(warehouses.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existingWarehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Update warehouse
    const [updatedWarehouse] = await erpDb
      .update(warehouses)
      .set({
        name,
        code,
        address,
        city,
        state,
        country,
        postalCode,
        phone,
        email,
        managerUserId,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    // Handle manager details if provided
    let manager = null;
    if (managerName) {
      // Check if manager already exists
      const existingManager = await erpDb.query.warehouseManagers.findFirst({
        where: eq(warehouseManagers.warehouseId, id),
      });

      if (existingManager) {
        // Update existing manager
        const [updatedManager] = await erpDb
          .update(warehouseManagers)
          .set({
            name: managerName,
            email: managerEmail,
            address: managerAddress,
            mobileNumber: managerMobile,
            gender: managerGender,
            updatedAt: new Date(),
          })
          .where(eq(warehouseManagers.id, existingManager.id))
          .returning();
        manager = updatedManager;
      } else {
        // Create new manager
        const [newManager] = await erpDb
          .insert(warehouseManagers)
          .values({
            warehouseId: id,
            name: managerName,
            email: managerEmail,
            address: managerAddress,
            mobileNumber: managerMobile,
            gender: managerGender,
          })
          .returning();
        manager = newManager;
      }
    }

    return NextResponse.json({ warehouse: updatedWarehouse, manager });
  } catch (error: any) {
    logDatabaseError('Updating warehouse', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
