import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { routings, routingOperations, workCenters } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// GET /api/erp/manufacturing/routing/[id] - Get Routing details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view routings' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [routingDetails] = await erpDb
      .select()
      .from(routings)
      .where(eq(routings.id, id));

    if (!routingDetails) {
      return NextResponse.json({ error: 'Routing not found' }, { status: 404 });
    }

    // Get routing operations with work center ID
    const operations = await erpDb
      .select({
        id: routingOperations.id,
        sequence: routingOperations.sequence,
        operationName: routingOperations.operationName,
        workCenterId: routingOperations.workCenterId,
        workCenter: {
          name: workCenters.name,
          code: workCenters.code,
        },
        setupTime: routingOperations.setupTime,
        runTimePerUnit: routingOperations.runTimePerUnit,
        description: routingOperations.description,
      })
      .from(routingOperations)
      .leftJoin(workCenters, eq(routingOperations.workCenterId, workCenters.id))
      .where(eq(routingOperations.routingId, id))
      .orderBy(routingOperations.sequence);

    return NextResponse.json({
      routing: {
        ...routingDetails,
        operations: operations.map(op => ({
          ...op,
          workCenter: op.workCenter,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching routing details:', error);
    return NextResponse.json({ error: 'Failed to fetch routing details' }, { status: 500 });
  }
}

// PUT /api/erp/manufacturing/routing/[id] - Update Routing
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit routings' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { operations, ...routingData } = body;

    const [updatedRouting] = await erpDb
      .update(routings)
      .set({
        ...routingData,
        updatedAt: new Date(),
      })
      .where(eq(routings.id, id))
      .returning();

    // Update operations if provided
    if (operations) {
      // Delete existing operations
      await erpDb.delete(routingOperations).where(eq(routingOperations.routingId, id));

      // Insert new operations
      if (operations.length > 0) {
        await erpDb.insert(routingOperations).values(
          operations.map((op: any) => ({
            routingId: id,
            sequence: op.sequence,
            operationName: op.operationName,
            workCenterId: op.workCenterId,
            setupTime: op.setupTime,
            runTimePerUnit: op.runTimePerUnit,
            description: op.description,
          }))
        );
      }
    }

    return NextResponse.json(updatedRouting);
  } catch (error) {
    console.error('Error updating routing:', error);
    return NextResponse.json({ error: 'Failed to update routing' }, { status: 500 });
  }
}

// DELETE /api/erp/manufacturing/routing/[id] - Delete Routing
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete routings' }, { status: 403 });
  }

  try {
    const { id } = await params;

    await erpDb.delete(routings).where(eq(routings.id, id));

    return NextResponse.json({ message: 'Routing deleted successfully' });
  } catch (error) {
    console.error('Error deleting routing:', error);
    return NextResponse.json({ error: 'Failed to delete routing' }, { status: 500 });
  }
}
