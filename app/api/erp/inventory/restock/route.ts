import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockMovements, stockMovementLines, stockLevels, products, warehouses } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { notifyRestock } from '@/lib/warehouseNotifications';

// POST /api/erp/inventory/restock
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to restock inventory' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { productId, warehouseId, quantity: rawQuantity, notes } = body;

    // Parse quantity to ensure it's a number
    const quantity = typeof rawQuantity === 'string' ? parseFloat(rawQuantity) : rawQuantity;

    if (!productId || !warehouseId || !quantity || quantity <= 0 || isNaN(quantity)) {
      return NextResponse.json(
        { error: 'Product ID, warehouse ID, and valid quantity are required' },
        { status: 400 }
      );
    }

    // Get product to check reorder rules
    const product = await erpDb.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if product has reorder point set (reorder rule)
    const reorderPoint = parseFloat(product.reorderPoint || '0');
    if (reorderPoint <= 0) {
      return NextResponse.json(
        { error: 'Please add restock rule for this product. Set a reorder point in product settings first.' },
        { status: 400 }
      );
    }

    // Check if stock level exists for this product-warehouse combination
    let existingStockLevel = await erpDb.query.stockLevels.findFirst({
      where: and(
        eq(stockLevels.productId, productId),
        eq(stockLevels.warehouseId, warehouseId)
      ),
    });

    if (!existingStockLevel) {
      // Create new stock level entry
      try {
        await erpDb.execute(sql`
          INSERT INTO stock_levels (product_id, warehouse_id, quantity_on_hand, quantity_reserved)
          VALUES (${productId}, ${warehouseId}, ${quantity}, 0)
        `);
      } catch (err: any) {
        console.log('Stock level insert error:', err.message);
        return NextResponse.json(
          { error: 'Failed to create stock level: ' + err.message },
          { status: 500 }
        );
      }
    } else {
      // Update existing stock level
      await erpDb.execute(sql`
        UPDATE stock_levels 
        SET 
          quantity_on_hand = COALESCE(quantity_on_hand, 0) + ${quantity},
          updated_at = NOW()
        WHERE product_id = ${productId}
          AND warehouse_id = ${warehouseId}
      `);
    }

    // Create stock movement for restock
    const [movement] = await erpDb
      .insert(stockMovements)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        movementType: 'receipt',
        referenceType: 'restock',
        destinationWarehouseId: warehouseId,
        status: 'completed',
        scheduledDate: new Date(),
        completedDate: new Date(),
        notes: notes || 'Manual restock',
        createdBy: user.id,
      })
      .returning();

    // Create stock movement line
    await erpDb.insert(stockMovementLines).values({
      stockMovementId: movement.id,
      productId: productId,
      quantityOrdered: quantity.toString(),
      quantityProcessed: quantity.toString(),
      notes: notes || 'Manual restock',
    });

    // Send email notification to warehouse
    try {
      await notifyRestock(warehouseId, product.name, quantity);
    } catch (emailError) {
      console.error('Error sending restock notification:', emailError);
      // Don't fail the API call if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Product restocked successfully',
      movement: {
        id: movement.id,
        quantity,
      },
    });
  } catch (error: any) {
    console.error('Error restocking product:', error);
    logDatabaseError('Restock product', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
