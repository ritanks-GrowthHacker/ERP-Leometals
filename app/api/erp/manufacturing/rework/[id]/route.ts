import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// PATCH /api/erp/manufacturing/rework/[id] - Update rework order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to update rework orders' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    await db.execute(`
      UPDATE rework_orders 
      SET status = '${status}', updated_at = NOW()
      WHERE id = '${id}'
    `);

    return NextResponse.json({ message: 'Rework order updated successfully' });
  } catch (error) {
    console.error('Error updating rework order:', error);
    return NextResponse.json({ error: 'Failed to update rework order' }, { status: 500 });
  }
}
