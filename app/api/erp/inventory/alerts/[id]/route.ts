import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// PUT /api/erp/inventory/alerts/[id] - Resolve alert
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to resolve alerts' },
      { status: 403 }
    );
  }

  try {
    const result = await erpDb.execute(sql`
      UPDATE stock_alerts
      SET 
        is_resolved = true,
        resolved_at = NOW(),
        resolved_by = ${user.id}
      WHERE id = ${id}
        AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING *
    `);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ alert: result[0] });
  } catch (error: any) {
    logDatabaseError('Resolving alert', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
