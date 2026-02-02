import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { manufacturingOrders, products, boms, routings, warehouses } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/manufacturing/orders - List all Manufacturing Orders
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view manufacturing orders' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;

    const orderList = await db
      .select({
        id: manufacturingOrders.id,
        moNumber: manufacturingOrders.moNumber,
        productId: manufacturingOrders.productId,
        productName: products.name,
        productSku: products.sku,
        bomId: manufacturingOrders.bomId,
        bomVersion: boms.version,
        plannedQuantity: manufacturingOrders.plannedQuantity,
        producedQuantity: manufacturingOrders.producedQuantity,
        uom: products.uomId,
        status: manufacturingOrders.status,
        priority: manufacturingOrders.priority,
        scheduledStart: manufacturingOrders.scheduledStart,
        scheduledEnd: manufacturingOrders.scheduledEnd,
        actualStart: manufacturingOrders.actualStart,
        actualEnd: manufacturingOrders.actualEnd,
        createdAt: manufacturingOrders.createdAt,
      })
      .from(manufacturingOrders)
      .leftJoin(products, eq(manufacturingOrders.productId, products.id))
      .leftJoin(boms, eq(manufacturingOrders.bomId, boms.id))
      .where(eq(manufacturingOrders.erpOrganizationId, erpOrganizationId))
      .orderBy(desc(manufacturingOrders.createdAt));

    return NextResponse.json(orderList);
  } catch (error) {
    console.error('Error fetching manufacturing orders:', error);
    return NextResponse.json({ error: 'Failed to fetch manufacturing orders' }, { status: 500 });
  }
}

// POST /api/erp/manufacturing/orders - Create new Manufacturing Order
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'create')) {
    return NextResponse.json({ error: 'No permission to create manufacturing orders' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      moNumber,
      productId,
      bomId,
      routingId,
      plannedQuantity,
      status,
      priority,
      scheduledStart,
      scheduledEnd,
      sourceWarehouseId,
      destinationWarehouseId,
      notes,
    } = body;

    const erpOrganizationId = user.erpOrganizationId;
    const createdBy = user.id;

    const [newOrder] = await db
      .insert(manufacturingOrders)
      .values({
        erpOrganizationId,
        moNumber,
        productId,
        bomId: sanitizeUuid(bomId),
        routingId: sanitizeUuid(routingId),
        plannedQuantity,
        status: status || 'draft',
        priority: priority || 'medium',
        scheduledStart: scheduledStart,
        scheduledEnd: scheduledEnd,
        sourceWarehouseId: sanitizeUuid(sourceWarehouseId),
        destinationWarehouseId: sanitizeUuid(destinationWarehouseId),
        notes,
        createdBy: createdBy || null,
      })
      .returning();

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating manufacturing order:', error);
    return NextResponse.json({ error: 'Failed to create manufacturing order' }, { status: 500 });
  }
}
