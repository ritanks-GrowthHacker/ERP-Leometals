import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockMovements, stockMovementLines, stockLevels, warehouseLocations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';
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

// POST /api/erp/inventory/movements/[id]/confirm
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to confirm stock movements' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const movementId = params.id;

    // Get the movement with its lines
    const movement = await erpDb.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.id, movementId),
        eq(stockMovements.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: true,
      },
    });

    if (!movement) {
      return NextResponse.json(
        { error: 'Stock movement not found' },
        { status: 404 }
      );
    }

    if (movement.status === 'completed') {
      return NextResponse.json(
        { error: 'Movement is already completed' },
        { status: 400 }
      );
    }

    // Process based on movement type
    if (movement.movementType === 'internal_transfer') {
      // For internal transfers, reduce from source and add to destination
      for (const line of movement.lines) {
        // Reduce from source warehouse
        if (movement.sourceWarehouseId) {
          const sourceStock = await erpDb.query.stockLevels.findFirst({
            where: and(
              eq(stockLevels.productId, line.productId),
              eq(stockLevels.warehouseId, movement.sourceWarehouseId)
            ),
          });

          if (sourceStock) {
            const currentQty = parseFloat(sourceStock.quantityOnHand || '0');
            const orderedQty = parseFloat(line.quantityOrdered || '0');
            await erpDb
              .update(stockLevels)
              .set({
                quantityOnHand: (currentQty - orderedQty).toString(),
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, sourceStock.id));
          }
        }

        // Add to destination warehouse
        if (movement.destinationWarehouseId) {
          const destStock = await erpDb.query.stockLevels.findFirst({
            where: and(
              eq(stockLevels.productId, line.productId),
              eq(stockLevels.warehouseId, movement.destinationWarehouseId)
            ),
          });

          if (destStock) {
            const currentQty = parseFloat(destStock.quantityOnHand || '0');
            const orderedQty = parseFloat(line.quantityOrdered || '0');
            await erpDb
              .update(stockLevels)
              .set({
                quantityOnHand: (currentQty + orderedQty).toString(),
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, destStock.id));
          } else {
            // Create new stock level with auto-generated position
            let binPosition: string | null = null;
            let rackNumber: string | null = null;
            
            if (movement.destinationLocationId) {
              const autoPosition = await generatePositionForLocation(movement.destinationLocationId, line.productId);
              binPosition = autoPosition.binPosition;
              rackNumber = autoPosition.rackNumber;
            }
            
            await erpDb.insert(stockLevels).values({
              productId: line.productId,
              productVariantId: line.productVariantId,
              warehouseId: movement.destinationWarehouseId,
              locationId: movement.destinationLocationId,
              quantityOnHand: line.quantityOrdered || '0',
              quantityReserved: '0',
              binPosition,
              rackNumber,
            });
          }
        }

        // Update line quantity processed
        await erpDb
          .update(stockMovementLines)
          .set({
            quantityProcessed: line.quantityOrdered,
            updatedAt: new Date(),
          })
          .where(eq(stockMovementLines.id, line.id));
      }
    }

    // Update movement status
    const [updatedMovement] = await erpDb
      .update(stockMovements)
      .set({
        status: 'completed',
        completedDate: new Date(),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(stockMovements.id, movementId))
      .returning();

    return NextResponse.json({
      movement: updatedMovement,
      message: 'Stock movement completed successfully',
    });
  } catch (error: any) {
    logDatabaseError('Confirming stock movement', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
