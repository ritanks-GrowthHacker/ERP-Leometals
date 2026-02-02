import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { moOperations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// POST /api/erp/manufacturing/operations/[id]/execute - Execute operation action
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to execute operations' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, operatorName, actualTime, scrapQuantity, scrapReason, notes } = body;

    // Get current operation
    const [operation] = await db
      .select()
      .from(moOperations)
      .where(eq(moOperations.id, id));

    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    const now = new Date();
    let updateData: any = {
      operatorName,
      notes,
      updatedAt: now,
    };

    // Handle different actions
    switch (action) {
      case 'start':
        if (operation.status !== 'pending') {
          return NextResponse.json({ error: 'Operation can only be started from pending status' }, { status: 400 });
        }
        updateData.status = 'in_progress';
        updateData.startedAt = now;
        break;

      case 'pause':
        if (operation.status !== 'in_progress') {
          return NextResponse.json({ error: 'Only in-progress operations can be paused' }, { status: 400 });
        }
        updateData.status = 'paused';
        // updateData.pauseCount = (operation.pauseCount || 0) + 1; // Will work after schema update
        break;

      case 'resume':
        if (operation.status !== 'paused') {
          return NextResponse.json({ error: 'Only paused operations can be resumed' }, { status: 400 });
        }
        updateData.status = 'in_progress';
        break;

      case 'complete':
        if (operation.status !== 'in_progress') {
          return NextResponse.json({ error: 'Only in-progress operations can be completed' }, { status: 400 });
        }
        updateData.status = 'done';
        updateData.completedAt = now;
        updateData.actualTime = actualTime;
        updateData.scrapQuantity = scrapQuantity || 0;
        updateData.scrapReason = scrapReason;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update operation
    const [updatedOperation] = await db
      .update(moOperations)
      .set(updateData)
      .where(eq(moOperations.id, id))
      .returning();

    // Log the action
    await db.execute(`
      INSERT INTO mo_operation_logs (
        mo_operation_id, action, performed_by, performed_by_name, notes
      ) VALUES (
        '${id}', '${action}', '${user.id}', '${user.name}', '${notes || ''}'
      )
    `);

    // Update MO progress based on operation completion
    if (action === 'complete') {
      await updateMOProgress(operation.moId);
    }

    return NextResponse.json(updatedOperation);
  } catch (error) {
    console.error('Error executing operation:', error);
    return NextResponse.json({ error: 'Failed to execute operation' }, { status: 500 });
  }
}

// Helper function to update MO progress
async function updateMOProgress(moId: string) {
  try {
    // Get all operations for this MO
    const operations = await db
      .select()
      .from(moOperations)
      .where(eq(moOperations.moId, moId));

    const totalOps = operations.length;
    const completedOps = operations.filter(op => op.status === 'done').length;
    
    // Calculate progress percentage
    const progress = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;

    // Check if all operations are complete
    const allComplete = completedOps === totalOps;

    // Update MO status
    if (allComplete) {
      await db.execute(`
        UPDATE manufacturing_orders 
        SET status = 'done', actual_end = NOW(), updated_at = NOW()
        WHERE id = '${moId}' AND status != 'done'
      `);
    } else if (completedOps > 0) {
      await db.execute(`
        UPDATE manufacturing_orders 
        SET status = 'in_progress', updated_at = NOW()
        WHERE id = '${moId}' AND status = 'confirmed'
      `);
    }
  } catch (error) {
    console.error('Error updating MO progress:', error);
  }
}

// GET /api/erp/manufacturing/operations/[id]/logs - Get operation execution logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view operation logs' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const logs = await db.execute(`
      SELECT * FROM mo_operation_logs
      WHERE mo_operation_id = '${id}'
      ORDER BY timestamp DESC
    `);

    return NextResponse.json(Array.from(logs) || []);
  } catch (error) {
    console.error('Error fetching operation logs:', error);
    return NextResponse.json({ error: 'Failed to fetch operation logs' }, { status: 500 });
  }
}
