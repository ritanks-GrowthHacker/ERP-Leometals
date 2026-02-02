import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouseLocations, warehouses } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// GET /api/erp/inventory/warehouses/[id]/locations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view warehouse locations' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    
    // Verify warehouse belongs to user's organization
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, id),
        eq(warehouses.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    const locations = await erpDb.query.warehouseLocations.findMany({
      where: eq(warehouseLocations.warehouseId, id),
      with: {
        parentLocation: true,
      },
    });

    return NextResponse.json({ locations });
  } catch (err: any) {
    console.error('Error fetching warehouse locations:', err);
    return NextResponse.json(
      { error: 'Failed to fetch warehouse locations' },
      { status: 500 }
    );
  }
}

// POST /api/erp/inventory/warehouses/[id]/locations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create warehouse locations' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { 
      name, 
      code, 
      locationType, 
      parentLocationId, 
      capacity,
      address,
      managerName,
      managerEmail,
      managerMobile,
      managerGender
    } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code' },
        { status: 400 }
      );
    }

    // Verify warehouse belongs to user's organization
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, id),
        eq(warehouses.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Check if code already exists in this warehouse
    const existing = await erpDb.query.warehouseLocations.findFirst({
      where: and(
        eq(warehouseLocations.warehouseId, id),
        eq(warehouseLocations.code, code)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Location with this code already exists in this warehouse' },
        { status: 409 }
      );
    }

    const [newLocation] = await erpDb
      .insert(warehouseLocations)
      .values({
        warehouseId: id,
        name,
        code,
        locationType: locationType || null,
        parentLocationId: parentLocationId || null,
        capacity: capacity || null,
        currentUtilization: '0',
        address: address || null,
        managerName: managerName || null,
        managerEmail: managerEmail || null,
        managerMobile: managerMobile || null,
        managerGender: managerGender || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ location: newLocation }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating warehouse location:', err);
    return NextResponse.json(
      { error: 'Failed to create warehouse location' },
      { status: 500 }
    );
  }
}
