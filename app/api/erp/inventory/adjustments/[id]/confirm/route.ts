import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockAdjustments, stockAdjustmentLines, stockLevels, warehouseLocations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql, desc } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// Auto-generate bin position and rack number
async function generatePositionForLocation(locationId: string, productId: string) {
  const location = await erpDb.query.warehouseLocations.findFirst({
    where: eq(warehouseLocations.id, locationId),
  });
  if (!location) return { binPosition: null, rackNumber: null };
  
  const existingStock = await erpDb.query.stockLevels.findMany({
    where: eq(stockLevels.locationId, locationId),
    orderBy: desc(stockLevels.updatedAt),
  });
  
  const locationType = location.locationType?.toLowerCase();
  const locationCode = location.code || 'LOC';
  const itemCount = existingStock.length + 1;
  
  let binPosition = null;
  let rackNumber = null;
  
  switch (locationType) {
    case 'bin':
      binPosition = `BIN-${locationCode}-${String(itemCount).padStart(3, '0')}`;
      break;
    case 'rack':
      const rackRow = Math.ceil(itemCount / 30); // 30 items per rack (10 columns x 3 items)
      const posInRack = ((itemCount - 1) % 30) + 1;
      const col = Math.ceil(posInRack / 3);
      const row = ((posInRack - 1) % 3) + 1;
      rackNumber = `RACK-${locationCode}-R${rackRow}`;
      binPosition = `C${col}R${row}`;
      break;
    case 'shelf':
      const level = Math.ceil(itemCount / 20);
      const shelfPos = itemCount % 20 || 20;
      binPosition = `SHELF-${locationCode}-L${level}-P${String(shelfPos).padStart(2, '0')}`;
      break;
    case 'aisle':
      binPosition = `AISLE-${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;
    default:
      binPosition = `${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;
  }
  
  return { binPosition, rackNumber };
}

// POST /api/erp/inventory/adjustments/[id]/confirm
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to confirm stock adjustments' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const id = params.id;

    // Get adjustment with lines
    const adjustment = await erpDb.query.stockAdjustments.findFirst({
      where: and(
        eq(stockAdjustments.id, id),
        eq(stockAdjustments.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: true,
      },
    });

    if (!adjustment) {
      return NextResponse.json(
        { error: 'Stock adjustment not found' },
        { status: 404 }
      );
    }

    if (adjustment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft adjustments can be confirmed' },
        { status: 400 }
      );
    }

    // Update stock levels for each line
    for (const line of adjustment.lines) {
      const difference = parseFloat(line.countedQuantity) - parseFloat(line.systemQuantity);
      
      if (difference !== 0) {
        // Check if stock level exists
        const existingStock = await erpDb.query.stockLevels.findFirst({
          where: and(
            eq(stockLevels.productId, line.productId),
            eq(stockLevels.warehouseId, adjustment.warehouseId),
            line.warehouseLocationId 
              ? eq(stockLevels.locationId, line.warehouseLocationId)
              : sql`location_id IS NULL`
          ),
        });

        if (existingStock) {
          // Update existing stock level
          await erpDb
            .update(stockLevels)
            .set({
              quantityOnHand: sql`quantity_on_hand + ${difference}`,
              lastCountedAt: new Date(),
              lastCountedBy: user.id,
              updatedAt: new Date(),
            })
            .where(eq(stockLevels.id, existingStock.id));
        } else {
          // Create new stock level with auto-generated position
          let binPosition: string | null = null;
          let rackNumber: string | null = null;
          
          if (line.warehouseLocationId) {
            const autoPosition = await generatePositionForLocation(line.warehouseLocationId, line.productId);
            binPosition = autoPosition.binPosition;
            rackNumber = autoPosition.rackNumber;
          }
          
          await erpDb.insert(stockLevels).values({
            productId: line.productId,
            productVariantId: line.productVariantId || null,
            warehouseId: adjustment.warehouseId,
            locationId: line.warehouseLocationId || null,
            quantityOnHand: line.countedQuantity,
            quantityReserved: '0',
            binPosition,
            rackNumber,
            lastCountedAt: new Date(),
            lastCountedBy: user.id,
          });
        }
      }
    }

    // Update adjustment status
    const [updated] = await erpDb
      .update(stockAdjustments)
      .set({
        status: 'confirmed',
        approvedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(stockAdjustments.id, id))
      .returning();

    return NextResponse.json({ adjustment: updated });
  } catch (err: any) {
    console.error('Error confirming stock adjustment:', err);
    logDatabaseError('Confirming stock adjustment', err);
    const dbError = handleDatabaseError(err);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
