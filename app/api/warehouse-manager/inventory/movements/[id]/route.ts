import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockMovements } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
import { eq, and, or } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id } = params;

    if (!id || id.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid movement ID' },
        { status: 400 }
      );
    }

    const movement = await erpDb.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.id, id),
        eq(stockMovements.erpOrganizationId, user.organizationId),
        or(
          eq(stockMovements.sourceWarehouseId, user.warehouseId),
          eq(stockMovements.destinationWarehouseId, user.warehouseId)
        )
      ),
      with: {
        lines: {
          with: {
            product: true,
            productVariant: true,
          },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
    });

    if (!movement) {
      return NextResponse.json(
        { error: 'Stock movement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ movement });
  } catch (error: any) {
    console.error('Error fetching stock movement:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movement', details: error.message },
      { status: 500 }
    );
  }
}
