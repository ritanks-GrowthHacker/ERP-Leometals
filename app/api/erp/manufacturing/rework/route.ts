import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET /api/erp/manufacturing/rework - List all rework orders
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view rework orders' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;

    const result = await db.execute(`
      SELECT 
        ro.id,
        ro.rework_number,
        ro.parent_mo_id,
        ro.product_id,
        ro.defect_quantity,
        ro.rework_quantity,
        ro.defect_type,
        ro.defect_description,
        ro.root_cause,
        ro.corrective_action,
        ro.priority,
        ro.status,
        ro.scheduled_start,
        ro.scheduled_end,
        ro.actual_start,
        ro.actual_end,
        ro.created_at,
        mo.mo_number as parent_mo_number,
        p.name as product_name,
        p.sku as product_sku
      FROM rework_orders ro
      LEFT JOIN manufacturing_orders mo ON ro.parent_mo_id = mo.id
      LEFT JOIN products p ON ro.product_id = p.id
      WHERE ro.erp_organization_id = '${erpOrganizationId}'
      ORDER BY ro.created_at DESC
    `);

    const rows = Array.from(result);
    
    // Map snake_case to camelCase
    const formattedData = rows.map((row: any) => ({
      id: row.id,
      reworkNumber: row.rework_number,
      parentMoId: row.parent_mo_id,
      parentMoNumber: row.parent_mo_number,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      defectQuantity: row.defect_quantity,
      reworkQuantity: row.rework_quantity,
      defectType: row.defect_type,
      defectDescription: row.defect_description,
      rootCause: row.root_cause,
      correctiveAction: row.corrective_action,
      priority: row.priority,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      actualStart: row.actual_start,
      actualEnd: row.actual_end,
      createdAt: row.created_at,
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching rework orders:', error);
    return NextResponse.json({ error: 'Failed to fetch rework orders' }, { status: 500 });
  }
}

// POST /api/erp/manufacturing/rework - Create new rework order
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'create')) {
    return NextResponse.json({ error: 'No permission to create rework orders' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const erpOrganizationId = user.erpOrganizationId;

    // Generate rework number
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const reworkNumber = `RWK-${timestamp}-${randomSuffix}`;

    const result = await db.execute(`
      INSERT INTO rework_orders (
        erp_organization_id, rework_number, parent_mo_id, product_id,
        defect_quantity, rework_quantity, defect_type, defect_description,
        root_cause, corrective_action, priority, scheduled_start, scheduled_end,
        created_by
      ) VALUES (
        '${erpOrganizationId}', '${reworkNumber}', '${body.parentMoId}', '${body.productId}',
        ${body.defectQuantity}, ${body.reworkQuantity}, '${body.defectType}', '${body.defectDescription}',
        ${body.rootCause ? `'${body.rootCause}'` : 'NULL'},
        ${body.correctiveAction ? `'${body.correctiveAction}'` : 'NULL'},
        '${body.priority}',
        ${body.scheduledStart ? `'${body.scheduledStart}'` : 'NULL'},
        ${body.scheduledEnd ? `'${body.scheduledEnd}'` : 'NULL'},
        '${user.id}'
      )
      RETURNING *
    `);

    const resultArray = Array.from(result);
    return NextResponse.json(resultArray[0] || {}, { status: 201 });
  } catch (error) {
    console.error('Error creating rework order:', error);
    return NextResponse.json({ error: 'Failed to create rework order' }, { status: 500 });
  }
}
