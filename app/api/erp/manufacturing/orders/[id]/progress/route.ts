import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { manufacturingOrders } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// PATCH /api/erp/manufacturing/orders/[id]/progress - Update production progress
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to update orders' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await req.json();
    const { producedQuantity, status, notes } = body;

    // Validate produced quantity
    if (producedQuantity !== undefined) {
      if (typeof producedQuantity !== 'number' || producedQuantity < 0) {
        return NextResponse.json({ error: 'Invalid produced quantity' }, { status: 400 });
      }
    }

    // Get current order
    const [currentOrder] = await db
      .select()
      .from(manufacturingOrders)
      .where(eq(manufacturingOrders.id, id));

    if (!currentOrder) {
      return NextResponse.json({ error: 'Manufacturing order not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (producedQuantity !== undefined) {
      updateData.producedQuantity = producedQuantity.toString();
      
      // Auto-update status based on progress
      const plannedQty = parseFloat(currentOrder.plannedQuantity);
      if (producedQuantity >= plannedQty && currentOrder.status !== 'done') {
        updateData.status = 'done';
        updateData.actualEnd = new Date();
      } else if (producedQuantity > 0 && currentOrder.status === 'confirmed') {
        updateData.status = 'in_progress';
        updateData.actualStart = updateData.actualStart || new Date();
      }
    }

    // Manual status update
    if (status) {
      updateData.status = status;
      
      if (status === 'in_progress' && !currentOrder.actualStart) {
        updateData.actualStart = new Date();
      } else if (status === 'done' && !currentOrder.actualEnd) {
        updateData.actualEnd = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Update the order
    const [updatedOrder] = await db
      .update(manufacturingOrders)
      .set(updateData)
      .where(eq(manufacturingOrders.id, id))
      .returning();

    return NextResponse.json({
      message: 'Progress updated successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
