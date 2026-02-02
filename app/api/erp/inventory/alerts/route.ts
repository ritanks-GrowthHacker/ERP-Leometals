import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/inventory/alerts
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stock alerts' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const isResolved = searchParams.get('isResolved');
    const alertType = searchParams.get('alertType');
    const alertLevel = searchParams.get('alertLevel');

    let query = sql`
      SELECT 
        sa.*,
        p.name as product_name,
        p.sku as product_sku,
        w.name as warehouse_name
      FROM stock_alerts sa
      LEFT JOIN products p ON sa.product_id = p.id
      LEFT JOIN warehouses w ON sa.warehouse_id = w.id
      WHERE sa.erp_organization_id = ${user.erpOrganizationId}
    `;

    if (isResolved !== null) {
      query = sql`${query} AND sa.is_resolved = ${isResolved === 'true'}`;
    }

    if (alertType) {
      query = sql`${query} AND sa.alert_type = ${alertType}`;
    }

    if (alertLevel) {
      query = sql`${query} AND sa.alert_level = ${alertLevel}`;
    }

    query = sql`${query} ORDER BY sa.created_at DESC LIMIT 100`;

    const alertsResult = await erpDb.execute(query);

    // Get alert counts by type
    const alertCountsResult = await erpDb.execute(sql`
      SELECT 
        alert_type,
        alert_level,
        COUNT(*) as count
      FROM stock_alerts
      WHERE erp_organization_id = ${user.erpOrganizationId}
        AND is_resolved = false
      GROUP BY alert_type, alert_level
    `);

    return NextResponse.json({
      alerts: Array.from(alertsResult),
      counts: Array.from(alertCountsResult),
    });
  } catch (error: any) {
    logDatabaseError('Fetching stock alerts', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
