import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockMovements, stockMovementLines, warehouseLocations } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
import { eq, or, desc, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const movements = await erpDb.query.stockMovements.findMany({
      where: or(
        eq(stockMovements.sourceWarehouseId, user.warehouseId),
        eq(stockMovements.destinationWarehouseId, user.warehouseId)
      ),
      with: {
        lines: {
          with: {
            product: true,
          },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
      limit,
      offset,
      orderBy: [desc(stockMovements.createdAt)],
    });

    const allMovements = await erpDb.query.stockMovements.findMany({
      where: or(
        eq(stockMovements.sourceWarehouseId, user.warehouseId),
        eq(stockMovements.destinationWarehouseId, user.warehouseId)
      ),
    });
    const total = allMovements.length;

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movements', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/warehouse-manager/inventory/movements
// Create internal movement within warehouse manager's warehouse
export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const {
      sourceLocationId,
      destinationLocationId,
      scheduledDate,
      notes,
      lines, // Array of { productId, productVariantId, quantityOrdered, unitCost }
    } = body;

    if (!sourceLocationId || !destinationLocationId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceLocationId, destinationLocationId, lines' },
        { status: 400 }
      );
    }

    // Validate both source and destination locations belong to manager's warehouse
    const sourceLocation = await erpDb.query.warehouseLocations.findFirst({
      where: and(
        eq(warehouseLocations.id, sourceLocationId),
        eq(warehouseLocations.warehouseId, user.warehouseId)
      ),
    });

    if (!sourceLocation) {
      return NextResponse.json(
        { error: 'Source location not found or does not belong to your warehouse' },
        { status: 404 }
      );
    }

    const destinationLocation = await erpDb.query.warehouseLocations.findFirst({
      where: and(
        eq(warehouseLocations.id, destinationLocationId),
        eq(warehouseLocations.warehouseId, user.warehouseId)
      ),
    });

    if (!destinationLocation) {
      return NextResponse.json(
        { error: 'Destination location not found or does not belong to your warehouse' },
        { status: 404 }
      );
    }

    // Create movement (internal transfer within same warehouse)
    const [newMovement] = await erpDb
      .insert(stockMovements)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        movementType: 'internal_transfer',
        sourceWarehouseId: user.warehouseId,
        sourceLocationId,
        destinationWarehouseId: user.warehouseId,
        destinationLocationId,
        status: 'draft',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes,
        createdBy: user.id,
      })
      .returning();

    // Create movement lines
    const movementLines = await erpDb
      .insert(stockMovementLines)
      .values(
        lines.map((line: any) => ({
          stockMovementId: newMovement.id,
          productId: line.productId,
          productVariantId: line.productVariantId || null,
          serialLotId: line.serialLotId || null,
          quantityOrdered: line.quantityOrdered,
          quantityProcessed: '0',
          uomId: line.uomId || null,
          unitCost: line.unitCost || null,
          notes: line.notes || null,
        }))
      )
      .returning();

    return NextResponse.json({
      movement: newMovement,
      lines: movementLines,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock movement:', error);
    return NextResponse.json(
      { error: 'Failed to create stock movement', details: error.message },
      { status: 500 }
    );
  }
}
