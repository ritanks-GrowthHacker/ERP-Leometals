import { NextRequest, NextResponse } from 'next/server';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb } from '@/lib/db';
import { salesOrders, stockLevels } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  console.log('🔥🔥🔥 POST /api/erp/sales/orders/[id]/reduce-items CALLED 🔥🔥🔥');
  
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to reduce items' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    
    console.log(`📦 Reducing items for sales order: ${id}`);

    // Get sales order with lines
    const order = await erpDb.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: {
          with: {
            product: true,
          },
        },
        warehouse: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found order: ${order.soNumber}`);
    console.log(`📋 Order has ${order.lines.length} line items`);
    console.log(`🏭 Warehouse ID: ${order.warehouseId}`);

    // Reduce stock for each line item
    const reductionResults = [];
    
    for (const line of order.lines) {
      const quantityToReduce = parseFloat(line.quantityOrdered);
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Processing line item:`);
      console.log(`   Product: ${line.product.name} (${line.productId})`);
      console.log(`   Quantity to reduce: ${quantityToReduce}`);
      console.log(`   Warehouse Location ID: ${line.warehouseLocationId || 'NOT SET'}`);

      // Build query conditions
      const stockQueryConditions = [
        eq(stockLevels.productId, line.productId),
        eq(stockLevels.warehouseId, order.warehouseId)
      ];
      
      // If line has a specific location, use it
      if (line.warehouseLocationId) {
        stockQueryConditions.push(eq(stockLevels.locationId, line.warehouseLocationId));
        console.log(`   ✅ Using specific location: ${line.warehouseLocationId}`);
      } else {
        console.log(`   ⚠️ No warehouse location ID - will search all locations`);
      }
      
      // Find stock level records
      const stockRecords = await erpDb.query.stockLevels.findMany({
        where: and(...stockQueryConditions),
      });

      console.log(`   🔍 Found ${stockRecords.length} stock level record(s)`);
      
      if (stockRecords.length === 0) {
        console.error(`   ❌ ERROR: No stock level found!`);
        reductionResults.push({
          productId: line.productId,
          productName: line.product.name,
          success: false,
          error: 'No stock level found',
        });
        continue;
      }

      // Reduce stock
      let remainingToReduce = quantityToReduce;
      const reductions = [];
      
      for (const stockRecord of stockRecords) {
        if (remainingToReduce <= 0) break;
        
        const currentQty = parseFloat(stockRecord.quantityOnHand || '0');
        const reductionAmount = Math.min(remainingToReduce, currentQty);
        const newQty = currentQty - reductionAmount;
        
        console.log(`   🔻 Reducing from stock_level ID: ${stockRecord.id}`);
        console.log(`      Location: ${stockRecord.locationId || 'NO LOCATION'}`);
        console.log(`      Current qty: ${currentQty}`);
        console.log(`      Reducing by: ${reductionAmount}`);
        console.log(`      New qty: ${newQty}`);
        
        // Perform the update
        const [updated] = await erpDb
          .update(stockLevels)
          .set({
            quantityOnHand: newQty.toString(),
            updatedAt: new Date(),
          })
          .where(eq(stockLevels.id, stockRecord.id))
          .returning();
        
        console.log(`      ✅ UPDATED! New quantityOnHand: ${updated.quantityOnHand}`);
        
        reductions.push({
          locationId: stockRecord.locationId,
          previousQty: currentQty,
          reducedBy: reductionAmount,
          newQty: parseFloat(updated.quantityOnHand || '0'),
        });
        
        remainingToReduce -= reductionAmount;
      }
      
      if (remainingToReduce > 0) {
        console.warn(`   ⚠️ WARNING: Could not reduce all quantity. Remaining: ${remainingToReduce}`);
      } else {
        console.log(`   ✅ SUCCESS: Fully reduced ${quantityToReduce} units`);
      }
      
      reductionResults.push({
        productId: line.productId,
        productName: line.product.name,
        quantityReduced: quantityToReduce - remainingToReduce,
        success: remainingToReduce === 0,
        reductions,
      });
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎉 STOCK REDUCTION COMPLETE!`);
    console.log(`   Total line items processed: ${order.lines.length}`);
    console.log(`   Successful reductions: ${reductionResults.filter(r => r.success).length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return NextResponse.json({
      success: true,
      message: 'Stock reduced successfully',
      reductions: reductionResults,
    });
  } catch (error: any) {
    console.error('❌ ERROR in reduce-items:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reduce items' },
      { status: 500 }
    );
  }
}
