import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/audit/tax-filing?quarter=Q1&year=2025
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view tax filing data' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const quarter = searchParams.get('quarter') || 'Q1';
    const year = parseInt(searchParams.get('year') || '2025');

    // Calculate date range based on quarter (Indian FY: Apr-Mar)
    let startDate: string;
    let endDate: string;

    switch (quarter) {
      case 'Q1': // Apr-Jun
        startDate = `${year}-04-01`;
        endDate = `${year}-06-30`;
        break;
      case 'Q2': // Jul-Sep
        startDate = `${year}-07-01`;
        endDate = `${year}-09-30`;
        break;
      case 'Q3': // Oct-Dec
        startDate = `${year}-10-01`;
        endDate = `${year}-12-31`;
        break;
      case 'Q4': // Jan-Mar (next year)
        startDate = `${year + 1}-01-01`;
        endDate = `${year + 1}-03-31`;
        break;
      default:
        startDate = `${year}-04-01`;
        endDate = `${year + 1}-03-31`;
    }

    // 1. Overall Business Summary
    const businessSummary = await erpDb.execute(sql`
      SELECT 
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) as total_revenue,
        COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as total_cogs,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) - COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as gross_profit,
        COALESCE(SUM(so.tax_amount), 0) as total_tax_collected,
        COUNT(DISTINCT so.id) as total_orders,
        COUNT(DISTINCT so.customer_id) as total_customers
      FROM sales_order_lines sol
      JOIN sales_orders so ON sol.sales_order_id = so.id
      JOIN products p ON sol.product_id = p.id
      WHERE so.status IN ('confirmed', 'delivered', 'in_progress')
        AND so.erp_organization_id = ${user.erpOrganizationId}
        AND so.so_date >= CAST(${startDate} AS DATE)
        AND so.so_date <= CAST(${endDate} AS DATE)
    `);

    // 2. Monthly Revenue Breakdown
    const monthlyRevenue = await erpDb.execute(sql`
      SELECT 
        TO_CHAR(so.so_date, 'YYYY-MM') as month,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) as revenue,
        COALESCE(SUM(so.tax_amount), 0) as gst_collected,
        COUNT(DISTINCT so.id) as orders
      FROM sales_order_lines sol
      JOIN sales_orders so ON sol.sales_order_id = so.id
      WHERE so.status IN ('confirmed', 'delivered', 'in_progress')
        AND so.erp_organization_id = ${user.erpOrganizationId}
        AND so.so_date >= CAST(${startDate} AS DATE)
        AND so.so_date <= CAST(${endDate} AS DATE)
      GROUP BY TO_CHAR(so.so_date, 'YYYY-MM')
      ORDER BY month
    `);

    // 3. Top 10 Most Profitable Products
    const topProducts = await erpDb.execute(sql`
      SELECT 
        p.name as product_name,
        p.sku,
        SUM(sol.quantity_ordered) as total_units_sold,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) as total_revenue,
        COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as total_cost,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) - COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as profit,
        ROUND(
          ((COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) - COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0)) / 
           NULLIF(COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0), 0)) * 100, 
          2
        ) as profit_margin_percent
      FROM sales_order_lines sol
      JOIN products p ON sol.product_id = p.id
      JOIN sales_orders so ON sol.sales_order_id = so.id
      WHERE so.status IN ('confirmed', 'delivered', 'in_progress')
        AND so.erp_organization_id = ${user.erpOrganizationId}
        AND so.so_date >= CAST(${startDate} AS DATE)
        AND so.so_date <= CAST(${endDate} AS DATE)
      GROUP BY p.id, p.name, p.sku
      ORDER BY profit DESC
      LIMIT 10
    `);

    // 4. Top 10 Customers by Revenue
    const topCustomers = await erpDb.execute(sql`
      SELECT 
        c.name as customer_name,
        c.city,
        c.state,
        c.email,
        c.phone,
        COALESCE(SUM(so.total_amount), 0) as total_revenue,
        COUNT(so.id) as total_orders,
        COALESCE(AVG(so.total_amount), 0) as avg_order_value,
        MAX(so.so_date) as last_order_date
      FROM customers c
      LEFT JOIN sales_orders so ON c.id = so.customer_id
      WHERE so.status IN ('confirmed', 'delivered', 'in_progress')
        AND c.erp_organization_id = ${user.erpOrganizationId}
        AND so.so_date >= CAST(${startDate} AS DATE)
        AND so.so_date <= CAST(${endDate} AS DATE)
      GROUP BY c.id, c.name, c.city, c.state, c.email, c.phone
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    // 5. Purchase Expenses
    const purchaseExpenses = await erpDb.execute(sql`
      SELECT 
        COALESCE(SUM(po.total_amount), 0) as total_purchases,
        COALESCE(SUM(po.tax_amount), 0) as input_tax_credit,
        COUNT(po.id) as total_purchase_orders
      FROM purchase_orders po
      WHERE po.status IN ('confirmed', 'received', 'partially_received')
        AND po.erp_organization_id = ${user.erpOrganizationId}
        AND po.po_date >= CAST(${startDate} AS DATE)
        AND po.po_date <= CAST(${endDate} AS DATE)
    `);

    // 6. Inventory Valuation
    const inventoryValue = await erpDb.execute(sql`
      SELECT 
        COALESCE(SUM(sl.quantity_on_hand * p.cost_price), 0) as total_inventory_value,
        COALESCE(SUM(sl.quantity_on_hand), 0) as total_units_in_stock
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      WHERE p.is_active = true
        AND p.erp_organization_id = ${user.erpOrganizationId}
    `);

    // 7. Category Wise Revenue
    const categoryRevenue = await erpDb.execute(sql`
      SELECT 
        COALESCE(pc.name, 'Uncategorized') as category,
        COUNT(DISTINCT p.id) as products_count,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) as total_revenue,
        COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as total_cost,
        COALESCE(SUM(sol.quantity_ordered * sol.unit_price), 0) - COALESCE(SUM(sol.quantity_ordered * p.cost_price), 0) as profit
      FROM products p
      LEFT JOIN product_categories pc ON p.product_category_id = pc.id
      LEFT JOIN sales_order_lines sol ON p.id = sol.product_id
      LEFT JOIN sales_orders so ON sol.sales_order_id = so.id
      WHERE so.status IN ('confirmed', 'delivered', 'in_progress')
        AND p.erp_organization_id = ${user.erpOrganizationId}
        AND so.so_date >= CAST(${startDate} AS DATE)
        AND so.so_date <= CAST(${endDate} AS DATE)
      GROUP BY pc.name
      ORDER BY total_revenue DESC
    `);

    return NextResponse.json({
      success: true,
      data: {
        quarter,
        year,
        startDate,
        endDate,
        businessSummary: Array.from(businessSummary)[0] || {
          total_revenue: '0',
          total_cogs: '0',
          gross_profit: '0',
          total_tax_collected: '0',
          total_orders: '0',
          total_customers: '0',
        },
        monthlyRevenue: Array.from(monthlyRevenue),
        topProducts: Array.from(topProducts),
        topCustomers: Array.from(topCustomers),
        purchaseExpenses: Array.from(purchaseExpenses)[0] || {
          total_purchases: '0',
          input_tax_credit: '0',
          total_purchase_orders: '0',
        },
        inventoryValue: Array.from(inventoryValue)[0] || {
          total_inventory_value: '0',
          total_units_in_stock: '0',
        },
        categoryRevenue: Array.from(categoryRevenue),
      },
    });
  } catch (error: any) {
    console.error('Error fetching tax filing data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax filing data', details: error.message },
      { status: 500 }
    );
  }
}
