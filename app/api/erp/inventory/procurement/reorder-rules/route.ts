import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql, eq, and } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// Reorder Rules Table Schema (inline for reference)
const reorderRules = {
  id: 'id',
  erpOrganizationId: 'erp_organization_id',
  productId: 'product_id',
  warehouseId: 'warehouse_id',
  reorderPoint: 'reorder_point',
  reorderQuantity: 'reorder_quantity',
  maxQuantity: 'max_quantity',
  leadTimeDays: 'lead_time_days',
  isActive: 'is_active',
  priority: 'priority',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// GET: Fetch all reorder rules
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const rules = await erpDb.execute(sql`
      SELECT 
        rr.*,
        p.name as product_name,
        p.sku as product_sku,
        w.name as warehouse_name,
        COALESCE(SUM(sl.quantity_on_hand), 0) as current_stock
      FROM reorder_rules rr
      JOIN products p ON p.id = rr.product_id
      LEFT JOIN warehouses w ON w.id = rr.warehouse_id
      LEFT JOIN stock_levels sl ON sl.product_id = rr.product_id 
        AND (rr.warehouse_id IS NULL OR sl.warehouse_id = rr.warehouse_id)
      WHERE rr.erp_organization_id = ${user.erpOrganizationId}
      GROUP BY rr.id, p.name, p.sku, w.name
      ORDER BY rr.created_at DESC
    `);

    return NextResponse.json({ rules });
  } catch (error: any) {
    logDatabaseError('Fetching reorder rules', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST: Create new reorder rule
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      productId,
      warehouseId,
      supplierId,
      reorderPoint,
      reorderQuantity,
      maxQuantity,
      leadTimeDays,
      priority,
    } = body;

    if (!productId || !reorderPoint || !reorderQuantity) {
      return NextResponse.json(
        { error: 'Product, reorder point, and reorder quantity are required' },
        { status: 400 }
      );
    }

    const result = await erpDb.execute(sql`
      INSERT INTO reorder_rules (
        erp_organization_id,
        product_id,
        warehouse_id,
        supplier_id,
        reorder_point,
        reorder_quantity,
        max_quantity,
        lead_time_days,
        priority
      ) VALUES (
        ${user.erpOrganizationId},
        ${productId},
        ${warehouseId || null},
        ${supplierId || null},
        ${reorderPoint},
        ${reorderQuantity},
        ${maxQuantity || null},
        ${leadTimeDays || 0},
        ${priority || 'normal'}
      )
      RETURNING *
    `);

    return NextResponse.json({ rule: result[0] }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating reorder rule', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT: Update reorder rule
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
      productId,
      warehouseId,
      supplierId,
      reorderPoint,
      reorderQuantity,
      maxQuantity,
      leadTimeDays,
      priority,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const result = await erpDb.execute(sql`
      UPDATE reorder_rules
      SET
        product_id = ${productId},
        warehouse_id = ${warehouseId || null},
        supplier_id = ${supplierId || null},
        reorder_point = ${reorderPoint},
        reorder_quantity = ${reorderQuantity},
        max_quantity = ${maxQuantity || null},
        lead_time_days = ${leadTimeDays || 0},
        priority = ${priority || 'normal'},
        is_active = ${isActive !== undefined ? isActive : true},
        updated_at = NOW()
      WHERE id = ${id} AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING *
    `);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule: result[0] });
  } catch (error: any) {
    logDatabaseError('Updating reorder rule', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// DELETE: Delete reorder rule
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const result = await erpDb.execute(sql`
      DELETE FROM reorder_rules
      WHERE id = ${id} AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING id
    `);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Rule deleted successfully' });
  } catch (error: any) {
    logDatabaseError('Deleting reorder rule', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
