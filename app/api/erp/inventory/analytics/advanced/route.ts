import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Comprehensive inventory analytics and reporting
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type') || 'overview';

    let response: any = {};

    switch (reportType) {
      case 'overview':
        // Overall inventory statistics
        const overviewStats = await erpDb.execute(sql`
          SELECT 
            COUNT(DISTINCT p.id) as total_products,
            COUNT(DISTINCT w.id) as total_warehouses,
            COALESCE(SUM(sl.quantity_on_hand), 0) as total_quantity,
            COALESCE(SUM(sl.quantity_on_hand * p.cost_price), 0) as total_value,
            COUNT(DISTINCT CASE WHEN sl.quantity_on_hand <= p.reorder_point THEN p.id END) as low_stock_products
          FROM products p
          LEFT JOIN stock_levels sl ON sl.product_id = p.id
          LEFT JOIN warehouses w ON w.id = sl.warehouse_id
          WHERE p.erp_organization_id = ${user.erpOrganizationId}
        `);

        // Get top customers by delivery value
        const topCustomers = await erpDb.execute(sql`
          SELECT 
            c.id as customer_id,
            c.name as customer_name,
            COUNT(DISTINCT so.id) as total_deliveries,
            COALESCE(SUM(CAST(si.total_amount AS DECIMAL)), 0) as total_value
          FROM customers c
          JOIN sales_orders so ON so.customer_id = c.id
          LEFT JOIN sales_invoices si ON si.sales_order_id = so.id
          WHERE c.erp_organization_id = ${user.erpOrganizationId}
          AND so.status = 'delivered'
          GROUP BY c.id, c.name
          ORDER BY total_value DESC
          LIMIT 10
        `);

        // Get top products
        const topProducts = await erpDb.execute(sql`
          SELECT 
            p.id,
            p.name,
            p.sku,
            COALESCE(SUM(CAST(sl.quantity_on_hand AS DECIMAL)), 0) as total_quantity,
            COALESCE(SUM(CAST(sl.quantity_on_hand AS DECIMAL) * CAST(p.cost_price AS DECIMAL)), 0) as value
          FROM products p
          LEFT JOIN stock_levels sl ON sl.product_id = p.id
          WHERE p.erp_organization_id = ${user.erpOrganizationId}
          GROUP BY p.id, p.name, p.sku
          ORDER BY value DESC
          LIMIT 20
        `);

        // Get warehouse stock
        const warehouseStock = await erpDb.execute(sql`
          SELECT 
            w.id as warehouse_id,
            w.name as warehouse_name,
            COUNT(DISTINCT sl.product_id) as product_count,
            COALESCE(SUM(CAST(sl.quantity_on_hand AS DECIMAL)), 0) as total_quantity
          FROM warehouses w
          LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
          WHERE w.erp_organization_id = ${user.erpOrganizationId}
          GROUP BY w.id, w.name
          ORDER BY total_quantity DESC
          LIMIT 10
        `);

        response.overview = overviewStats[0];
        response.topCustomers = Array.from(topCustomers);
        response.topProducts = Array.from(topProducts);
        response.warehouseStock = Array.from(warehouseStock);
        break;

      case 'turnover':
        // Inventory turnover analysis
        const turnoverData = await erpDb.execute(sql`
          SELECT 
            itm.*,
            p.name as product_name,
            p.sku as product_sku,
            w.name as warehouse_name
          FROM inventory_turnover_metrics itm
          JOIN products p ON p.id = itm.product_id
          LEFT JOIN warehouses w ON w.id = itm.warehouse_id
          WHERE itm.erp_organization_id = ${user.erpOrganizationId}
          ORDER BY itm.turnover_ratio DESC
          LIMIT 100
        `);

        response.turnover = turnoverData;
        break;

      case 'abc_analysis':
        // ABC Classification
        const abcData = await erpDb.execute(sql`
          SELECT 
            itm.abc_classification,
            COUNT(DISTINCT p.id) as product_count,
            COALESCE(SUM(sl.quantity_on_hand * p.cost_price), 0) as total_value,
            COALESCE(SUM(sh.revenue), 0) as total_revenue
          FROM products p
          LEFT JOIN inventory_turnover_metrics itm ON itm.product_id = p.id
          LEFT JOIN stock_levels sl ON sl.product_id = p.id
          LEFT JOIN sales_history sh ON sh.product_id = p.id
          WHERE p.erp_organization_id = ${user.erpOrganizationId}
          GROUP BY itm.abc_classification
          ORDER BY itm.abc_classification
        `);

        response.abc_analysis = abcData;
        break;

      case 'stock_aging':
        // Stock aging analysis
        const agingData = await erpDb.execute(sql`
          SELECT 
            sas.*,
            p.name as product_name,
            p.sku as product_sku,
            w.name as warehouse_name
          FROM stock_aging_snapshots sas
          JOIN products p ON p.id = sas.product_id
          JOIN warehouses w ON w.id = sas.warehouse_id
          WHERE sas.erp_organization_id = ${user.erpOrganizationId}
          ORDER BY sas.snapshot_date DESC, sas.quantity_over_180_days DESC
          LIMIT 100
        `);

        response.stock_aging = agingData;
        break;

      case 'valuation':
        // Inventory valuation summary
        const valuationData = await erpDb.execute(sql`
          SELECT 
            p.id,
            p.name as product_name,
            p.sku,
            w.name as warehouse_name,
            COALESCE(SUM(ivl.quantity_remaining), 0) as quantity,
            COALESCE(SUM(ivl.total_cost), 0) as total_value,
            CASE 
              WHEN SUM(ivl.quantity_remaining) > 0 
              THEN SUM(ivl.total_cost) / SUM(ivl.quantity_remaining)
              ELSE 0 
            END as average_unit_cost
          FROM products p
          JOIN inventory_valuation_layers ivl ON ivl.product_id = p.id
          JOIN warehouses w ON w.id = ivl.warehouse_id
          WHERE p.erp_organization_id = ${user.erpOrganizationId}
          AND ivl.is_consumed = false
          GROUP BY p.id, p.name, p.sku, w.name
          ORDER BY total_value DESC
        `);

        response.valuation = valuationData;
        break;

      case 'cogs':
        // COGS analysis
        const cogsData = await erpDb.execute(sql`
          SELECT 
            p.name as product_name,
            p.sku,
            ct.transaction_type,
            DATE_TRUNC('month', ct.transaction_date) as month,
            SUM(ct.quantity) as total_quantity,
            SUM(ct.total_cost) as total_cogs,
            AVG(ct.unit_cost) as average_unit_cost
          FROM cogs_transactions ct
          JOIN products p ON p.id = ct.product_id
          WHERE ct.erp_organization_id = ${user.erpOrganizationId}
          AND ct.transaction_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY p.name, p.sku, ct.transaction_type, DATE_TRUNC('month', ct.transaction_date)
          ORDER BY month DESC, total_cogs DESC
        `);

        response.cogs = cogsData;
        break;

      case 'expiry':
        // Expiry alerts summary
        const expiryData = await erpDb.execute(sql`
          SELECT 
            ea.alert_level,
            COUNT(*) as alert_count,
            SUM(ea.quantity) as total_quantity,
            SUM(ea.quantity * p.cost_price) as total_value
          FROM expiry_alerts ea
          JOIN products p ON p.id = ea.product_id
          WHERE p.erp_organization_id = ${user.erpOrganizationId}
          AND ea.is_resolved = false
          GROUP BY ea.alert_level
          ORDER BY 
            CASE ea.alert_level
              WHEN 'critical' THEN 1
              WHEN 'warning' THEN 2
              ELSE 3
            END
        `);

        response.expiry_summary = expiryData;
        break;

      case 'movements':
        // Stock movement summary
        const movementsData = await erpDb.execute(sql`
          SELECT 
            sm.movement_type,
            sm.status,
            COUNT(*) as movement_count,
            SUM(sml.quantity_ordered) as total_quantity
          FROM stock_movements sm
          JOIN stock_movement_lines sml ON sml.stock_movement_id = sm.id
          WHERE sm.erp_organization_id = ${user.erpOrganizationId}
          AND sm.created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY sm.movement_type, sm.status
          ORDER BY movement_count DESC
        `);

        response.movements = movementsData;
        break;

      case 'quality':
        // Quality inspection summary
        const qualityData = await erpDb.execute(sql`
          SELECT 
            qi.inspection_type,
            qi.inspection_status,
            COUNT(*) as inspection_count,
            SUM(qi.quantity_inspected) as total_inspected,
            SUM(qi.quantity_accepted) as total_accepted,
            SUM(qi.quantity_rejected) as total_rejected,
            CASE 
              WHEN SUM(qi.quantity_inspected) > 0 
              THEN (SUM(qi.quantity_rejected) / SUM(qi.quantity_inspected) * 100)
              ELSE 0 
            END as rejection_rate
          FROM quality_inspections qi
          WHERE qi.erp_organization_id = ${user.erpOrganizationId}
          AND qi.inspection_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY qi.inspection_type, qi.inspection_status
          ORDER BY inspection_count DESC
        `);

        response.quality = qualityData;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Run batch analytics calculations
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { operation } = body;

    switch (operation) {
      case 'calculate_abc':
        await erpDb.execute(sql`SELECT calculate_abc_classification(${user.erpOrganizationId})`);
        return NextResponse.json({ message: 'ABC classification calculated successfully' });

      case 'update_expiry_alerts':
        await erpDb.execute(sql`SELECT update_expiry_alerts()`);
        return NextResponse.json({ message: 'Expiry alerts updated successfully' });

      case 'generate_po_suggestions':
        await erpDb.execute(sql`SELECT generate_purchase_order_suggestions()`);
        return NextResponse.json({ message: 'PO suggestions generated successfully' });

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error running analytics operation:', error);
    return NextResponse.json(
      { error: 'Failed to run operation', details: error.message },
      { status: 500 }
    );
  }
}
