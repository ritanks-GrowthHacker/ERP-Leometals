import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Fetch quality inspections
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = sql`
      SELECT 
        qi.*,
        p.name as product_name,
        p.sku as product_sku,
        w.name as warehouse_name,
        sln.tracking_number as lot_serial_number
      FROM quality_inspections qi
      JOIN products p ON p.id = qi.product_id
      LEFT JOIN warehouses w ON w.id = qi.warehouse_id
      LEFT JOIN serial_lot_numbers sln ON sln.id = qi.lot_serial_id
      WHERE qi.erp_organization_id = ${user.erpOrganizationId}
    `;

    if (status) {
      query = sql`${query} AND qi.inspection_status = ${status}`;
    }

    if (type) {
      query = sql`${query} AND qi.inspection_type = ${type}`;
    }

    query = sql`${query} ORDER BY qi.inspection_date DESC`;

    const inspections = await erpDb.execute(query);

    return NextResponse.json({ inspections });
  } catch (error: any) {
    console.error('Error fetching inspections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspections', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create quality inspection
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      inspectionType,
      referenceType,
      referenceId,
      productId,
      warehouseId,
      lotSerialId,
      quantityInspected,
      quantityAccepted,
      quantityRejected,
      inspectionStatus,
      defectDetails,
      correctiveAction,
      notes,
    } = body;

    if (!inspectionType || !productId || !quantityInspected) {
      return NextResponse.json(
        { error: 'Inspection type, product, and quantity are required' },
        { status: 400 }
      );
    }

    const result = await erpDb.execute(sql`
      INSERT INTO quality_inspections (
        erp_organization_id,
        inspection_type,
        reference_type,
        reference_id,
        product_id,
        warehouse_id,
        lot_serial_id,
        quantity_inspected,
        quantity_accepted,
        quantity_rejected,
        inspection_status,
        inspector_id,
        defect_details,
        corrective_action,
        notes
      ) VALUES (
        ${user.erpOrganizationId},
        ${inspectionType},
        ${referenceType || null},
        ${referenceId || null},
        ${productId},
        ${warehouseId || null},
        ${lotSerialId || null},
        ${quantityInspected},
        ${quantityAccepted || 0},
        ${quantityRejected || 0},
        ${inspectionStatus || 'pending'},
        ${user.id},
        ${defectDetails || null},
        ${correctiveAction || null},
        ${notes || null}
      )
      RETURNING *
    `);

    return NextResponse.json({ inspection: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inspection:', error);
    return NextResponse.json(
      { error: 'Failed to create inspection', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update inspection status and results
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      id,
      quantityAccepted,
      quantityRejected,
      inspectionStatus,
      defectDetails,
      correctiveAction,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Inspection ID is required' }, { status: 400 });
    }

    const result = await erpDb.execute(sql`
      UPDATE quality_inspections
      SET
        quantity_accepted = ${quantityAccepted},
        quantity_rejected = ${quantityRejected},
        inspection_status = ${inspectionStatus},
        defect_details = ${defectDetails || null},
        corrective_action = ${correctiveAction || null},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${id} AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING *
    `);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    return NextResponse.json({ inspection: result[0] });
  } catch (error: any) {
    console.error('Error updating inspection:', error);
    return NextResponse.json(
      { error: 'Failed to update inspection', details: error.message },
      { status: 500 }
    );
  }
}
