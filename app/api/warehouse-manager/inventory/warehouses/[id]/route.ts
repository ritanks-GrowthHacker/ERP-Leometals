import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouses } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = params;

    // Verify warehouse belongs to manager
    if (id !== user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const warehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, id),
        eq(warehouses.erpOrganizationId, user.organizationId)
      ),
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    return NextResponse.json({ warehouse });
  } catch (error: any) {
    console.error('Error fetching warehouse:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouse', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = params;

    // Verify warehouse belongs to manager
    if (id !== user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { isActive } = await req.json();

    // Update warehouse status
    const [updated] = await erpDb
      .update(warehouses)
      .set({ 
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    return NextResponse.json({ warehouse: updated });
  } catch (error: any) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json(
      { error: 'Failed to update warehouse', details: error.message },
      { status: 500 }
    );
  }
}
