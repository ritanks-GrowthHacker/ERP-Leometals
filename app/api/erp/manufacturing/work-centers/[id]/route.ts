import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { workCenters, moOperations, downtimeLog, manufacturingOrders } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';

// GET /api/erp/manufacturing/work-centers/[id] - Get Work Center details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view work centers' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [centerDetails] = await db
      .select()
      .from(workCenters)
      .where(eq(workCenters.id, id));

    if (!centerDetails) {
      return NextResponse.json({ error: 'Work center not found' }, { status: 404 });
    }

    // Get scheduled operations
    const scheduledOps = await db
      .select({
        id: moOperations.id,
        moNumber: manufacturingOrders.moNumber,
        operation: moOperations.operationName,
        productName: manufacturingOrders.productId,
        scheduledDate: manufacturingOrders.scheduledStart,
        duration: moOperations.runTime,
      })
      .from(moOperations)
      .leftJoin(manufacturingOrders, eq(moOperations.moId, manufacturingOrders.id))
      .where(eq(moOperations.workCenterId, id))
      .orderBy(manufacturingOrders.scheduledStart)
      .limit(10);

    // Get downtime log
    const downtime = await db
      .select({
        id: downtimeLog.id,
        workCenterId: downtimeLog.workCenterId,
        startDate: downtimeLog.startDate,
        endDate: downtimeLog.endDate,
        reason: downtimeLog.reason,
        createdAt: downtimeLog.createdAt,
      })
      .from(downtimeLog)
      .where(eq(downtimeLog.workCenterId, id))
      .orderBy(desc(downtimeLog.startDate))
      .limit(10);

    return NextResponse.json({
      workCenter: centerDetails,
      scheduledOperations: scheduledOps || [],
      downtimeLog: downtime || [],
    });
  } catch (error) {
    console.error('Error fetching work center details:', error);
    return NextResponse.json({ error: 'Failed to fetch work center details' }, { status: 500 });
  }
}

// PUT /api/erp/manufacturing/work-centers/[id] - Update Work Center
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit work centers' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const [updatedCenter] = await db
      .update(workCenters)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(workCenters.id, id))
      .returning();

    return NextResponse.json(updatedCenter);
  } catch (error) {
    console.error('Error updating work center:', error);
    return NextResponse.json({ error: 'Failed to update work center' }, { status: 500 });
  }
}

// DELETE /api/erp/manufacturing/work-centers/[id] - Delete Work Center
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete work centers' }, { status: 403 });
  }

  try {
    const { id } = await params;

    await db.delete(workCenters).where(eq(workCenters.id, id));

    return NextResponse.json({ message: 'Work center deleted successfully' });
  } catch (error) {
    console.error('Error deleting work center:', error);
    return NextResponse.json({ error: 'Failed to delete work center' }, { status: 500 });
  }
}
