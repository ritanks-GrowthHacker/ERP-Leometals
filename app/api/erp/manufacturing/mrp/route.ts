import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { products, boms, bomComponents, manufacturingOrders, warehouses, stockLevels } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

// GET /api/erp/manufacturing/mrp - MRP Analysis with Pagination
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view MRP data' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 10;
    const offset = (page - 1) * limit;

    // Get pending MOs (confirmed or in_progress)
    const pendingMOs = await db
      .select({
        id: manufacturingOrders.id,
        moNumber: manufacturingOrders.moNumber,
        productId: manufacturingOrders.productId,
        productName: products.name,
        productSku: products.sku,
        plannedQuantity: manufacturingOrders.plannedQuantity,
        producedQuantity: manufacturingOrders.producedQuantity,
        scheduledStart: manufacturingOrders.scheduledStart,
        scheduledEnd: manufacturingOrders.scheduledEnd,
        status: manufacturingOrders.status,
      })
      .from(manufacturingOrders)
      .leftJoin(products, eq(manufacturingOrders.productId, products.id))
      .where(
        and(
          eq(manufacturingOrders.erpOrganizationId, erpOrganizationId),
          sql`${manufacturingOrders.status} IN ('confirmed', 'in_progress')`
        )
      )
      .limit(limit)
      .offset(offset);

    // Get products with low stock (below reorder point)
    const lowStockProducts = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        availableQuantity: sql<number>`COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`,
        reorderPoint: products.reorderPoint,
        reorderQuantity: products.reorderQuantity,
      })
      .from(products)
      .leftJoin(stockLevels, eq(products.id, stockLevels.productId))
      .where(eq(products.erpOrganizationId, erpOrganizationId))
      .groupBy(products.id)
      .having(sql`COALESCE(SUM(${stockLevels.quantityOnHand}), 0) <= ${products.reorderPoint}`)
      .limit(limit)
      .offset(offset);

    // Get material shortages for pending MOs
    // Fixed: Move aggregate condition from WHERE to HAVING
    const materialShortages = await db
      .select({
        id: bomComponents.id,
        moNumber: manufacturingOrders.moNumber,
        componentName: products.name,
        componentSku: products.sku,
        requiredQty: sql<number>`${bomComponents.quantity} * ${manufacturingOrders.plannedQuantity}`,
        availableQty: sql<number>`COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`,
        shortageQty: sql<number>`(${bomComponents.quantity} * ${manufacturingOrders.plannedQuantity}) - COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`,
      })
      .from(bomComponents)
      .innerJoin(boms, eq(bomComponents.bomId, boms.id))
      .innerJoin(manufacturingOrders, eq(boms.id, manufacturingOrders.bomId))
      .innerJoin(products, eq(bomComponents.componentProductId, products.id))
      .leftJoin(stockLevels, eq(products.id, stockLevels.productId))
      .where(
        and(
          eq(manufacturingOrders.erpOrganizationId, erpOrganizationId),
          sql`${manufacturingOrders.status} IN ('confirmed', 'in_progress')`
        )
      )
      .groupBy(bomComponents.id, manufacturingOrders.moNumber, products.name, products.sku, bomComponents.quantity, manufacturingOrders.plannedQuantity)
      .having(sql`(${bomComponents.quantity} * ${manufacturingOrders.plannedQuantity}) > COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`)
      .limit(limit)
      .offset(offset);

    // Get summary stats
    const [totalMOs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(manufacturingOrders)
      .where(
        and(
          eq(manufacturingOrders.erpOrganizationId, erpOrganizationId),
          sql`${manufacturingOrders.status} IN ('confirmed', 'in_progress')`
        )
      );

    const [totalLowStock] = await db
      .select({ count: sql<number>`count(DISTINCT ${products.id})` })
      .from(products)
      .leftJoin(stockLevels, eq(products.id, stockLevels.productId))
      .where(eq(products.erpOrganizationId, erpOrganizationId))
      .groupBy(products.id)
      .having(sql`COALESCE(SUM(${stockLevels.quantityOnHand}), 0) <= ${products.reorderPoint}`);

    const [totalShortages] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bomComponents)
      .innerJoin(boms, eq(bomComponents.bomId, boms.id))
      .innerJoin(manufacturingOrders, eq(boms.id, manufacturingOrders.bomId))
      .innerJoin(products, eq(bomComponents.componentProductId, products.id))
      .leftJoin(stockLevels, eq(products.id, stockLevels.productId))
      .where(
        and(
          eq(manufacturingOrders.erpOrganizationId, erpOrganizationId),
          sql`${manufacturingOrders.status} IN ('confirmed', 'in_progress')`
        )
      )
      .groupBy(bomComponents.id, manufacturingOrders.moNumber, products.name, products.sku, bomComponents.quantity, manufacturingOrders.plannedQuantity)
      .having(sql`(${bomComponents.quantity} * ${manufacturingOrders.plannedQuantity}) > COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`);

    return NextResponse.json({
      pendingMOs: {
        data: pendingMOs,
        total: totalMOs?.count || 0,
        page,
        limit,
      },
      lowStockProducts: {
        data: lowStockProducts,
        total: totalLowStock?.count || 0,
        page,
        limit,
      },
      materialShortages: {
        data: materialShortages,
        total: totalShortages?.count || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching MRP data:', error);
    return NextResponse.json({ error: 'Failed to fetch MRP data' }, { status: 500 });
  }
}