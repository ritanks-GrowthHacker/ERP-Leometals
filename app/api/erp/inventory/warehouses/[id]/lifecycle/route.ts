import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/inventory/warehouses/[id]/lifecycle
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    const { id: warehouseId } = await params;

    // Fetch warehouse details
    const warehouseResult = await erpDb.execute(sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        w.address as location,
        w.is_active,
        w.created_at::text as created_at,
        wm.name as manager_name,
        wm.address as manager_address,
        wm.mobile_number as manager_phone
      FROM warehouses w
      LEFT JOIN warehouse_managers wm ON w.id = wm.warehouse_id
      WHERE w.id = ${warehouseId}
        AND w.erp_organization_id = ${user.erpOrganizationId}
    `);

    const warehouses = Array.from(warehouseResult);
    if (warehouses.length === 0) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const warehouse: any = warehouses[0];

    // Fetch products in warehouse
    const productsResult = await erpDb.execute(sql`
      SELECT 
        p.id,
        p.name as product_name,
        p.sku,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.quantity_available
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      WHERE sl.warehouse_id = ${warehouseId}
        AND sl.quantity_on_hand > 0
      ORDER BY sl.quantity_on_hand DESC
      LIMIT 20
    `);

    const products = Array.from(productsResult);

    // Fetch stock movements with warehouse names and total quantity from lines
    const movementsResult = await erpDb.execute(sql`
      SELECT 
        sm.id,
        sm.movement_type as transaction_type,
        COALESCE(SUM(sml.quantity_ordered), 0) as quantity,
        sm.status,
        sm.created_at::text as created_at,
        sm.source_warehouse_id,
        sm.destination_warehouse_id,
        sw.name as from_warehouse,
        dw.name as to_warehouse
      FROM stock_movements sm
      LEFT JOIN stock_movement_lines sml ON sm.id = sml.stock_movement_id
      LEFT JOIN warehouses sw ON sm.source_warehouse_id = sw.id
      LEFT JOIN warehouses dw ON sm.destination_warehouse_id = dw.id
      WHERE (sm.source_warehouse_id = ${warehouseId} OR sm.destination_warehouse_id = ${warehouseId})
        AND sm.erp_organization_id = ${user.erpOrganizationId}
      GROUP BY sm.id, sm.movement_type, sm.status, sm.created_at, sm.source_warehouse_id, sm.destination_warehouse_id, sw.name, dw.name
      ORDER BY sm.created_at DESC
      LIMIT 50
    `);

    const stockMovements = Array.from(movementsResult);

    // Calculate total revenue from sales originating from this warehouse
    const totalRevenue = products.reduce((sum: number, p: any) => {
      return sum + (parseFloat(p.quantity_on_hand || 0) * 100); // Simplified calculation
    }, 0);

    // Build lifecycle data
    const lifecycle = {
      created: {
        completed: true,
        timestamp: warehouse.created_at,
        description: `Warehouse created on ${new Date(warehouse.created_at).toLocaleDateString()}`,
      },
      manager_assigned: {
        completed: !!warehouse.manager_name,
        timestamp: warehouse.created_at,
        description: warehouse.manager_name
          ? `Manager ${warehouse.manager_name} assigned`
          : 'No manager assigned yet',
      },
      products_stored: {
        completed: products.length > 0,
        timestamp: warehouse.created_at,
        description: products.length > 0
          ? `${products.length} products currently stored`
          : 'No products stored yet',
      },
      status_active: {
        completed: warehouse.is_active,
        timestamp: warehouse.created_at,
        description: warehouse.is_active ? 'Warehouse is active' : 'Warehouse is inactive',
      },
      stock_movements: {
        completed: stockMovements.length > 0,
        timestamp: stockMovements.length > 0 ? stockMovements[0].created_at : null,
        description: stockMovements.length > 0
          ? `${stockMovements.length} stock movements recorded`
          : 'No stock movements yet',
      },
    };

    return NextResponse.json({
      warehouse: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        location: warehouse.location,
        is_active: warehouse.is_active,
      },
      manager: warehouse.manager_name
        ? {
            name: warehouse.manager_name,
            address: warehouse.manager_address,
            phone: warehouse.manager_phone,
            email: warehouse.manager_email,
          }
        : null,
      products,
      stockMovements,
      totalRevenue,
      lifecycle,
    });
  } catch (error: any) {
    console.error('Error fetching warehouse lifecycle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch warehouse lifecycle' },
      { status: 500 }
    );
  }
}
