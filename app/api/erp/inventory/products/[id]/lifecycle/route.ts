import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/inventory/products/[id]/lifecycle
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const params = await context.params;
    const productId = params.id;

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
      AND p.erp_organization_id = ${user.erpOrganizationId}
    `);

    const productResult = Array.from(productQuery);
    if (!productResult || productResult.length === 0) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    const product = productResult[0] as any;

    // 2. Product Creation / Acquisition
    const creationInfo = {
      created_at: product.created_at,
      created_by: product.created_by,
      initial_quantity: product.quantity_on_hand || 0,
    };

    // 3. Warehouse Assignments
    const warehouseQuery = await erpDb.execute(sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.updated_at as last_updated
      FROM stock_levels sl
      JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE sl.product_id = ${productId}
      ORDER BY sl.updated_at DESC
    `);

    const warehouses = Array.from(warehouseQuery);

    // 4. Suppliers
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

    // 5. Purchase Orders (Incoming)
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
      ORDER BY po.po_date DESC
      LIMIT 50
    `);

    const purchaseOrders = Array.from(purchaseOrderQuery);

    // 6. Sales Orders (Outgoing)
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
      ORDER BY so.so_date DESC
      LIMIT 50
    `);

    const salesOrders = Array.from(salesOrderQuery);

    // 7. Stock Movements (Inventory Transactions)
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
      ORDER BY sm.completed_date DESC NULLS LAST
      LIMIT 100
    `);

    const stockMovements = Array.from(stockMovementQuery);

    // 8. Quantity Timeline (Aggregated)
    const quantityTimelineQuery = await erpDb.execute(sql`
      SELECT 
        DATE(sm.completed_date) as date,
        SUM(CASE 
          WHEN sm.movement_type IN ('receipt', 'adjustment', 'return') THEN sml.quantity_ordered
          WHEN sm.movement_type IN ('delivery', 'internal_transfer', 'scrap') THEN -sml.quantity_ordered
          ELSE 0
        END) as net_change
      FROM stock_movement_lines sml
      JOIN stock_movements sm ON sml.stock_movement_id = sm.id
      WHERE sml.product_id = ${productId}
      AND sm.completed_date IS NOT NULL
      GROUP BY DATE(sm.completed_date)
      ORDER BY date DESC
      LIMIT 90
    `);

    const quantityTimeline = Array.from(quantityTimelineQuery);

    // Calculate current total quantity across all warehouses
    const currentQuantity = warehouses.reduce((sum, w: any) => sum + parseFloat(w.quantity_on_hand || '0'), 0);

    // Lifecycle stages with completion status
    const lifecycle = {
      acquisition: {
        completed: true,
        timestamp: product.created_at,
        description: 'Product added to system',
      },
      warehouse_assignment: {
        completed: warehouses.length > 0,
        timestamp: warehouses.length > 0 ? warehouses[0].last_updated : null,
        description: `Assigned to ${warehouses.length} warehouse(s)`,
      },
      supplier_mapping: {
        completed: suppliers.length > 0,
        timestamp: null,
        description: `${suppliers.length} supplier(s) configured`,
      },
      incoming_orders: {
        completed: purchaseOrders.length > 0,
        timestamp: purchaseOrders.length > 0 ? purchaseOrders[0].po_date : null,
        description: `${purchaseOrders.length} purchase order(s)`,
      },
      outgoing_orders: {
        completed: salesOrders.length > 0,
        timestamp: salesOrders.length > 0 ? salesOrders[0].so_date : null,
        description: `${salesOrders.length} sales order(s)`,
      },
      stock_movements: {
        completed: stockMovements.length > 0,
        timestamp: stockMovements.length > 0 ? stockMovements[0].transaction_date : null,
        description: `${stockMovements.length} transaction(s)`,
      },
    };

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        category: product.category_name,
        uom: product.uom_name,
        sale_price: product.sale_price,
        cost_price: product.cost_price,
        current_quantity: currentQuantity,
      },
      lifecycle,
      creation: creationInfo,
      warehouses,
      suppliers,
      purchaseOrders,
      salesOrders,
      stockMovements,
      quantityTimeline,
    });
  } catch (error: any) {
    console.error('Error fetching product lifecycle:', error);
    return NextResponse.json(
      { message: 'Failed to fetch product lifecycle', error: error.message },
      { status: 500 }
    );
  }
}
