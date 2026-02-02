import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/inventory/analytics
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view inventory analytics' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');

    // Get stock summary using the view
    const stockSummary = await erpDb.execute(sql`
      SELECT * FROM v_stock_summary
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
      ORDER BY product_name
    `);

    // Get reorder suggestions
    const reorderSuggestions = await erpDb.execute(sql`
      SELECT * FROM v_reorder_suggestions
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
      ORDER BY suggested_order_quantity DESC
      LIMIT 50
    `);

    // Calculate summary statistics
    const summaryStats = await erpDb.execute(sql`
      SELECT 
        COUNT(DISTINCT product_id) as total_products,
        SUM(quantity_on_hand) as total_quantity,
        SUM(inventory_value) as total_value,
        COUNT(CASE WHEN stock_status = 'out_of_stock' THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN stock_status = 'low_stock' THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN stock_status = 'in_stock' THEN 1 END) as in_stock_count
      FROM v_stock_summary
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
    `);

    // Get top value products
    const topValueProducts = await erpDb.execute(sql`
      SELECT 
        product_id,
        product_name,
        sku,
        category_name,
        SUM(inventory_value) as total_value,
        SUM(quantity_on_hand) as total_quantity
      FROM v_stock_summary
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
      GROUP BY product_id, product_name, sku, category_name
      ORDER BY total_value DESC
      LIMIT 10
    `);

    // Get stock by category
    const stockByCategory = await erpDb.execute(sql`
      SELECT 
        COALESCE(category_name, 'Uncategorized') as category_name,
        COUNT(DISTINCT product_id) as product_count,
        SUM(quantity_on_hand) as total_quantity,
        SUM(inventory_value) as total_value
      FROM v_stock_summary
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
      GROUP BY category_name
      ORDER BY total_value DESC
    `);

    return NextResponse.json({
      summary: Array.from(summaryStats)[0] || {},
      stockSummary: Array.from(stockSummary),
      reorderSuggestions: Array.from(reorderSuggestions),
      topValueProducts: Array.from(topValueProducts),
      stockByCategory: Array.from(stockByCategory),
    });
  } catch (err: any) {
    console.error('Error fetching inventory analytics:', err);
    return NextResponse.json(
      { error: 'Failed to fetch inventory analytics' },
      { status: 500 }
    );
  }
}
