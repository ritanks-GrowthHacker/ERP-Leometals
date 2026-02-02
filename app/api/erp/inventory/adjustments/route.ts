import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockAdjustments, stockAdjustmentLines, stockLevels } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/inventory/adjustments
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stock adjustments' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const status = searchParams.get('status');
    const adjustmentType = searchParams.get('adjustmentType');

    const conditions = [eq(stockAdjustments.erpOrganizationId, user.erpOrganizationId)];
    
    if (warehouseId) {
      conditions.push(eq(stockAdjustments.warehouseId, warehouseId));
    }
    
    if (status) {
      conditions.push(eq(stockAdjustments.status, status));
    }
    
    if (adjustmentType) {
      conditions.push(eq(stockAdjustments.adjustmentType, adjustmentType));
    }

    const adjustments = await erpDb.query.stockAdjustments.findMany({
      where: and(...conditions),
      with: {
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(stockAdjustments.createdAt)],
    });

    return NextResponse.json({ adjustments });
  } catch (error: any) {
    logDatabaseError('Fetching stock adjustments', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/inventory/adjustments
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create stock adjustments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      warehouseId,
      adjustmentType,
      referenceNumber,
      adjustmentDate,
      notes,
      lines, // Array of { productId, warehouseLocationId, countedQuantity, systemQuantity, reason }
    } = body;

    if (!warehouseId || !adjustmentType || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: warehouseId, adjustmentType, lines' },
        { status: 400 }
      );
    }

    // Create adjustment
    const [newAdjustment] = await erpDb
      .insert(stockAdjustments)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        warehouseId,
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
    logDatabaseError('Creating stock adjustment', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
