import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockMovements, stockMovementLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// GET /api/erp/inventory/movements/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stock movements' },
      { status: 403 }
    );
  }

  try {
    const movement = await erpDb.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.id, id),
        eq(stockMovements.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: {
          with: {
            product: true,
            productVariant: true,
          },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
    });

    if (!movement) {
      return NextResponse.json(
        { error: 'Stock movement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ movement });
  } catch (err: any) {
    console.error('Error fetching stock movement:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stock movement' },
      { status: 500 }
    );
  }
}

// PUT /api/erp/inventory/movements/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit stock movements' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { status, scheduledDate, completedDate, notes, quantityProcessed } = body;

    // Check if movement exists
    const existing = await erpDb.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.id, id),
        eq(stockMovements.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock movement not found' },
        { status: 404 }
      );
    }

    // Can't edit completed or cancelled movements
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot edit completed or cancelled movements' },
        { status: 400 }
      );
    }

    const [updated] = await erpDb
      .update(stockMovements)
      .set({
        status: status ?? existing.status,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : existing.scheduledDate,
        completedDate: completedDate ? new Date(completedDate) : existing.completedDate,
        notes: notes ?? existing.notes,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(stockMovements.id, id))
      .returning();

    // If status changed to completed, update quantity processed if provided
    if (status === 'completed' && quantityProcessed) {
      for (const line of quantityProcessed) {
        await erpDb
          .update(stockMovementLines)
          .set({
            quantityProcessed: line.quantity,
            updatedAt: new Date(),
          })
          .where(eq(stockMovementLines.id, line.lineId));
      }
    }

    return NextResponse.json({ movement: updated });
  } catch (err: any) {
    console.error('Error updating stock movement:', err);
    return NextResponse.json(
      { error: 'Failed to update stock movement' },
      { status: 500 }
    );
  }
}

// DELETE /api/erp/inventory/movements/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete stock movements' },
      { status: 403 }
    );
  }

  try {
    const existing = await erpDb.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.id, id),
        eq(stockMovements.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock movement not found' },
        { status: 404 }
      );
    }

    // Can only delete draft movements
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete draft movements' },
        { status: 400 }
      );
    }

    await erpDb
      .delete(stockMovements)
      .where(eq(stockMovements.id, id));

    return NextResponse.json({ message: 'Stock movement deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting stock movement:', err);
    return NextResponse.json(
      { error: 'Failed to delete stock movement' },
      { status: 500 }
    );
  }
}
