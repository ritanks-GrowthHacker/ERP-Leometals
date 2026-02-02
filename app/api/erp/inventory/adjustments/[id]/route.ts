import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockAdjustments } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// GET /api/erp/inventory/adjustments/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const adjustment = await erpDb.query.stockAdjustments.findFirst({
      where: and(
        eq(stockAdjustments.id, id),
        eq(stockAdjustments.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!adjustment) {
      return NextResponse.json(
        { error: 'Stock adjustment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ adjustment });
  } catch (err: any) {
    console.error('Error fetching stock adjustment:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stock adjustment' },
      { status: 500 }
    );
  }
}

// DELETE /api/erp/inventory/adjustments/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete stock adjustments' },
      { status: 403 }
    );
  }

  try {
    const existing = await erpDb.query.stockAdjustments.findFirst({
      where: and(
        eq(stockAdjustments.id, id),
        eq(stockAdjustments.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock adjustment not found' },
        { status: 404 }
      );
    }

    // Can only delete draft adjustments
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete draft adjustments' },
        { status: 400 }
      );
    }

    await erpDb
      .delete(stockAdjustments)
      .where(eq(stockAdjustments.id, id));

    return NextResponse.json({ message: 'Stock adjustment deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting stock adjustment:', err);
    return NextResponse.json(
      { error: 'Failed to delete stock adjustment' },
      { status: 500 }
    );
  }
}