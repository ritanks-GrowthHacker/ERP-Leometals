import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockAdjustments, stockAdjustmentLines, warehouseLocations } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';

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

    const adjustments = await erpDb.query.stockAdjustments.findMany({
      where: eq(stockAdjustments.warehouseId, user.warehouseId),
      with: {
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      limit,
      offset,
      orderBy: [desc(stockAdjustments.createdAt)],
    });

    const allAdjustments = await erpDb.query.stockAdjustments.findMany({
      where: eq(stockAdjustments.warehouseId, user.warehouseId),
    });
    const total = allAdjustments.length;

    return NextResponse.json({
      adjustments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock adjustments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock adjustments', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/warehouse-manager/inventory/adjustments
// Create stock adjustment for warehouse manager's warehouse
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
      adjustmentType,
      referenceNumber,
      adjustmentDate,
      notes,
      lines, // Array of { productId, warehouseLocationId, countedQuantity, systemQuantity, reason }
    } = body;

    if (!adjustmentType || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: adjustmentType, lines' },
        { status: 400 }
      );
    }

    // If location is specified in any line, validate it belongs to manager's warehouse
    for (const line of lines) {
      if (line.warehouseLocationId) {
        const location = await erpDb.query.warehouseLocations.findFirst({
          where: and(
            eq(warehouseLocations.id, line.warehouseLocationId),
            eq(warehouseLocations.warehouseId, user.warehouseId)
          ),
        });

        if (!location) {
          return NextResponse.json(
            { error: 'Location does not belong to your warehouse' },
            { status: 404 }
          );
        }
      }
    }

    // Create adjustment
    const [newAdjustment] = await erpDb
      .insert(stockAdjustments)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        warehouseId: user.warehouseId,
        adjustmentType,
        referenceNumber,
        adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : new Date(),
        status: 'draft',
        notes,
        createdBy: user.id,
      })
      .returning();

    // Create adjustment lines
    const adjustmentLines = await erpDb
      .insert(stockAdjustmentLines)
      .values(
        lines.map((line: any) => ({
          stockAdjustmentId: newAdjustment.id,
          productId: line.productId,
          productVariantId: line.productVariantId || null,
          warehouseLocationId: line.warehouseLocationId || null,
          countedQuantity: line.countedQuantity,
          systemQuantity: line.systemQuantity,
          reason: line.reason,
        }))
      )
      .returning();

    return NextResponse.json({
      adjustment: newAdjustment,
      lines: adjustmentLines,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock adjustment:', error);
    return NextResponse.json(
      { error: 'Failed to create stock adjustment', details: error.message },
      { status: 500 }
    );
  }
}
