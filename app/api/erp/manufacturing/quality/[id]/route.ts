import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { qualityChecks, qcCheckpoints, qcDefects } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// GET /api/erp/manufacturing/quality/[id] - Get Quality Check details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view quality checks' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [qcDetails] = await db
      .select()
      .from(qualityChecks)
      .where(eq(qualityChecks.id, id));

    if (!qcDetails) {
      return NextResponse.json({ error: 'Quality check not found' }, { status: 404 });
    }

    // Get checkpoints
    const checkpoints = await db
      .select()
      .from(qcCheckpoints)
      .where(eq(qcCheckpoints.qcId, id));

    // Get defects
    const defects = await db
      .select()
      .from(qcDefects)
      .where(eq(qcDefects.qcId, id));

    return NextResponse.json({
      ...qcDetails,
      checkpoints,
      defects,
    });
  } catch (error) {
    console.error('Error fetching QC details:', error);
    return NextResponse.json({ error: 'Failed to fetch QC details' }, { status: 500 });
  }
}

// PUT /api/erp/manufacturing/quality/[id] - Update Quality Check
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit quality checks' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const [updatedQC] = await db
      .update(qualityChecks)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(qualityChecks.id, id))
      .returning();

    return NextResponse.json(updatedQC);
  } catch (error) {
    console.error('Error updating QC:', error);
    return NextResponse.json({ error: 'Failed to update QC' }, { status: 500 });
  }
}

// DELETE /api/erp/manufacturing/quality/[id] - Delete Quality Check
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete quality checks' }, { status: 403 });
  }

  try {
    const { id } = await params;

    await db.delete(qualityChecks).where(eq(qualityChecks.id, id));

    return NextResponse.json({ message: 'Quality check deleted successfully' });
  } catch (error) {
    console.error('Error deleting QC:', error);
    return NextResponse.json({ error: 'Failed to delete QC' }, { status: 500 });
  }
}
