import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> }
) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view inventory' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const { locationId } = params;

    // Fetch restock POs for this location (both from suggestions and manually created)
    const restockPOsQuery = await erpDb.execute(sql`
      SELECT 
        po.id as po_id,
        po.po_number,
        po.status as po_status,
        po.created_at,
        s.name as supplier_name,
        SUM(pol.quantity_ordered) as total_quantity,
        po.location_id
      FROM purchase_orders po
      JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.erp_organization_id = ${user.erpOrganizationId}
        AND po.location_id = ${locationId}
      GROUP BY po.id, po.po_number, po.status, po.created_at, s.name, po.location_id
      ORDER BY po.created_at DESC
    `);

    const restockPOs = Array.from(restockPOsQuery);

    return NextResponse.json({ restockPOs });
  } catch (error: any) {
    console.error('Error fetching restock POs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restock POs', details: error.message },
      { status: 500 }
    );
  }
}
