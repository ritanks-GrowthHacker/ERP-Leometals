import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { routings, products, routingOperations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';

// GET /api/erp/manufacturing/routing - List all Routings
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view routings' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;

    const routingList = await db
      .select({
        id: routings.id,
        routingCode: routings.routingCode,
        name: routings.name,
        productId: routings.productId,
        productName: products.name,
        productSku: products.sku,
        status: routings.status,
        notes: routings.notes,
        createdAt: routings.createdAt,
      })
      .from(routings)
      .leftJoin(products, eq(routings.productId, products.id))
      .where(eq(routings.erpOrganizationId, erpOrganizationId))
      .orderBy(desc(routings.createdAt));

    return NextResponse.json({ routings: routingList });
  } catch (error) {
    console.error('Error fetching routings:', error);
    return NextResponse.json({ error: 'Failed to fetch routings' }, { status: 500 });
  }
}

// POST /api/erp/manufacturing/routing - Create new Routing
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'create')) {
    return NextResponse.json({ error: 'No permission to create routings' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { operations, ...routingData } = body;
    const erpOrganizationId = user.erpOrganizationId;

    const [newRouting] = await db
      .insert(routings)
      .values({
        erpOrganizationId,
        ...routingData,
      })
      .returning();

    // Insert operations if provided
    if (operations && operations.length > 0) {
      await db.insert(routingOperations).values(
        operations.map((op: any) => ({
          routingId: newRouting.id,
          sequence: op.sequence,
          operationName: op.operationName,
          workCenterId: op.workCenterId,
          setupTime: op.setupTime,
          runTimePerUnit: op.runTimePerUnit,
          description: op.description,
        }))
      );
    }

    return NextResponse.json(newRouting, { status: 201 });
  } catch (error) {
    console.error('Error creating routing:', error);
    return NextResponse.json({ error: 'Failed to create routing' }, { status: 500 });
  }
}
