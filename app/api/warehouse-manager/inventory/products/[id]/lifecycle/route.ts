import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { getErpUserFromToken } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id: productId } = params;

    // 1. Product Basic Info
    const productQuery = await erpDb.execute(sql`
      SELECT 
        p.*,
        c.name as category_name,
        u.name as uom_name
      FROM products p
      LEFT JOIN product_categories c ON p.product_category_id = c.id
      LEFT JOIN units_of_measure u ON p.uom_id = u.id
      WHERE p.id = ${productId}
      AND p.erp_organization_id = ${user.organizationId}
    `);

    const productResult = Array.from(productQuery);
    if (!productResult || productResult.length === 0) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    const product = productResult[0] as any;

    // 2. Warehouse Stock (only for manager's warehouse)
    const warehouseQuery = await erpDb.execute(sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.quantity_available,
        sl.updated_at as last_updated
      FROM stock_levels sl
      JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE sl.product_id = ${productId}
      AND sl.warehouse_id = ${user.warehouseId}
    `);

    const warehouses = Array.from(warehouseQuery);

    // 3. Suppliers
    const supplierQuery = await erpDb.execute(sql`
      SELECT DISTINCT
        s.id,
        s.name,
        s.code,
        s.email,
        ps.unit_price,
        ps.lead_time_days,
        ps.minimum_order_quantity
      FROM product_suppliers ps
      JOIN suppliers s ON ps.supplier_id = s.id
      WHERE ps.product_id = ${productId}
      AND ps.is_active = true
      ORDER BY s.name
    `);

    const suppliers = Array.from(supplierQuery);

    // 4. Purchase Orders (for this warehouse)
    const purchaseOrderQuery = await erpDb.execute(sql`
      SELECT 
        po.id,
        po.po_number,
        po.po_date,
        po.status,
        pol.quantity_ordered,
        pol.quantity_received,
        pol.unit_price,
        s.name as supplier_name
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON pol.purchase_order_id = po.id
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE pol.product_id = ${productId}
      AND po.warehouse_id = ${user.warehouseId}
      ORDER BY po.po_date DESC
      LIMIT 50
    `);

    const purchaseOrders = Array.from(purchaseOrderQuery);

    // 5. Sales Orders (from this warehouse)
    const salesOrderQuery = await erpDb.execute(sql`
      SELECT 
        so.id,
        so.so_number,
        so.so_date,
        so.status,
        sol.quantity_ordered,
        sol.unit_price,
        c.name as customer_name
      FROM sales_order_lines sol
      JOIN sales_orders so ON sol.sales_order_id = so.id
      JOIN customers c ON so.customer_id = c.id
      WHERE sol.product_id = ${productId}
      AND so.warehouse_id = ${user.warehouseId}
      ORDER BY so.so_date DESC
      LIMIT 50
    `);

    const salesOrders = Array.from(salesOrderQuery);

    // 6. Stock Movements (involving this warehouse)
    const stockMovementQuery = await erpDb.execute(sql`
      SELECT 
        sm.id,
        sm.movement_type as transaction_type,
        sml.quantity_ordered as quantity,
        sm.completed_date as transaction_date,
        sm.status,
        sm.notes,
        w_from.name as from_warehouse,
        w_to.name as to_warehouse
      FROM stock_movement_lines sml
      JOIN stock_movements sm ON sml.stock_movement_id = sm.id
      LEFT JOIN warehouses w_from ON sm.source_warehouse_id = w_from.id
      LEFT JOIN warehouses w_to ON sm.destination_warehouse_id = w_to.id
      WHERE sml.product_id = ${productId}
      AND (sm.source_warehouse_id = ${user.warehouseId} OR sm.destination_warehouse_id = ${user.warehouseId})
      ORDER BY sm.completed_date DESC NULLS LAST
      LIMIT 100
    `);

    const stockMovements = Array.from(stockMovementQuery);

    // 7. Stock Adjustments (for this warehouse)
    const adjustmentQuery = await erpDb.execute(sql`
      SELECT 
        sa.id,
        sa.adjustment_number,
        sa.adjustment_date,
        sa.adjustment_type,
        sa.reason,
        sa.status,
        sal.quantity_before,
        sal.quantity_adjusted,
        sal.quantity_after
      FROM stock_adjustment_lines sal
      JOIN stock_adjustments sa ON sal.stock_adjustment_id = sa.id
      WHERE sal.product_id = ${productId}
      AND sa.warehouse_id = ${user.warehouseId}
      ORDER BY sa.adjustment_date DESC
      LIMIT 50
    `);

    const adjustments = Array.from(adjustmentQuery);

    return NextResponse.json({
      product,
      creation: {
        created_at: product.created_at,
        initial_quantity: product.quantity_on_hand || 0,
      },
      warehouses,
      suppliers,
      purchaseOrders,
      salesOrders,
      stockMovements,
      adjustments,
    });
  } catch (error: any) {
    console.error('Error fetching product lifecycle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product lifecycle', details: error.message },
      { status: 500 }
    );
  }
}
