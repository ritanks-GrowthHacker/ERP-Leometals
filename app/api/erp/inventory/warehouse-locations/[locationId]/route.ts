import { NextRequest, NextResponse } from 'next/server';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb } from '@/lib/db';
import { warehouseLocations, warehouses, stockLevels } from '@/lib/db/schema';
import { eq, and, sum, sql } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ locationId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view warehouse locations' },
      { status: 403 }
    );
  }

  try {
    const { locationId } = await params;

    // Fetch location details with warehouse info
    const location = await erpDb.query.warehouseLocations.findFirst({
      where: eq(warehouseLocations.id, locationId),
      with: {
        warehouse: true,
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Warehouse location not found' },
        { status: 404 }
      );
    }

    // Calculate total stock quantity in this location
    const stockResult = await erpDb
      .select({
        totalQuantity: sql<string>`COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`,
      })
      .from(stockLevels)
      .where(eq(stockLevels.locationId, locationId));

    const totalQuantity = parseFloat(stockResult[0]?.totalQuantity || '0');
    const capacity = parseFloat(location.capacity || '0');
    
    // Calculate utilization percentage
    const calculatedUtilization = capacity > 0 
      ? ((totalQuantity / capacity) * 100).toFixed(2)
      : '0.00';

    // Format response
    const formattedLocation = {
      id: location.id,
      name: location.name,
      code: location.code,
      locationType: location.locationType,
      warehouseId: location.warehouseId,
      warehouseName: (location.warehouse as any)?.name || '',
      address: location.address,
      managerName: location.managerName,
      managerEmail: location.managerEmail,
      managerMobile: location.managerMobile,
      managerGender: location.managerGender,
      capacity: location.capacity,
      currentUtilization: calculatedUtilization,
      totalStockQuantity: totalQuantity.toString(),
      isActive: location.isActive,
    };

    return NextResponse.json({ location: formattedLocation });
  } catch (error: any) {
    console.error('Error fetching warehouse location:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch warehouse location' },
      { status: 500 }
    );
  }
}

// PATCH /api/erp/inventory/warehouse-locations/[locationId]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit warehouse locations' },
      { status: 403 }
    );
  }

  try {
    const { locationId } = await params;
    const body = await req.json();
    const { isActive } = body;

    const [updated] = await erpDb
      .update(warehouseLocations)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(warehouseLocations.id, locationId))
      .returning();

    return NextResponse.json({ location: updated });
  } catch (error: any) {
    console.error('Error updating warehouse location:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update warehouse location' },
      { status: 500 }
    );
  }
}

// PUT /api/erp/inventory/warehouse-locations/[locationId]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit warehouse locations' },
      { status: 403 }
    );
  }

  try {
    const { locationId } = await params;
    const body = await req.json();
    const { name, address, managerName, managerEmail, managerMobile, managerGender } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      );
    }

    const [updated] = await erpDb
      .update(warehouseLocations)
      .set({
        name,
        address: address || null,
        managerName: managerName || null,
        managerEmail: managerEmail || null,
        managerMobile: managerMobile || null,
        managerGender: managerGender || null,
        updatedAt: new Date(),
      })
      .where(eq(warehouseLocations.id, locationId))
      .returning();

    return NextResponse.json({ location: updated });
  } catch (error: any) {
    console.error('Error updating warehouse location:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update warehouse location' },
      { status: 500 }
    );
  }
}
