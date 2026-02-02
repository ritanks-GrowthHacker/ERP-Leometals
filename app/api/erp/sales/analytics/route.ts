import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/sales/analytics
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view sales analytics' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const customerId = searchParams.get('customerId');
    
    // Calculate date filter based on days parameter
    let dateFilter = sql``;
    if (days > 0) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      dateFilter = sql`AND so_date >= ${startDateStr}`;
    }

    let orderSummary: any = [];
    let quotationSummary: any = [];
    let invoiceSummary: any = [];
    let topCustomers: any = [];
    let salesTrends: any = [];
    let topProducts: any = [];
    let paymentStatus: any = [];

    try {
      // Sales order summary
      orderSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'draft' OR status = 'pending' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'confirmed' OR status = 'completed' OR status = 'delivered' OR status = 'in_progress' THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'completed' OR status = 'delivered' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_sales_value,
          COALESCE(AVG(CAST(total_amount AS DECIMAL)), 0) as avg_order_value
        FROM sales_orders
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${customerId ? sql`AND customer_id = ${customerId}` : sql``}
        ${dateFilter}
      `);
    } catch (e: any) {
      console.error('Error in orderSummary:', e.message);
      orderSummary = [{
        total_orders: 0,
        draft_count: 0,
        confirmed_count: 0,
        in_progress_count: 0,
        completed_count: 0,
        cancelled_count: 0,
        total_sales_value: 0,
        avg_order_value: 0,
      }];
    }

    try {
      // Quotation summary
      quotationSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_quotations,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_quotation_value
        FROM sales_quotations
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${customerId ? sql`AND customer_id = ${customerId}` : sql``}
        ${dateFilter}
      `);
    } catch (e: any) {
      console.error('Error in quotationSummary:', e.message);
      quotationSummary = [{
        total_quotations: 0,
        draft_count: 0,
        sent_count: 0,
        accepted_count: 0,
        rejected_count: 0,
        expired_count: 0,
        total_quotation_value: 0,
      }];
    }

    try {
      // Invoice summary
      invoiceSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'partially_paid' THEN 1 END) as partially_paid_count,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_invoice_value,
          COALESCE(SUM(CAST(paid_amount AS DECIMAL)), 0) as total_paid,
          COALESCE(SUM(CAST(balance_amount AS DECIMAL)), 0) as total_outstanding
        FROM sales_invoices
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${customerId ? sql`AND customer_id = ${customerId}` : sql``}
        ${dateFilter}
      `);
    } catch (e: any) {
      console.error('Error in invoiceSummary:', e.message);
      invoiceSummary = [{
        total_invoices: 0,
        draft_count: 0,
        sent_count: 0,
        paid_count: 0,
        partially_paid_count: 0,
        overdue_count: 0,
        total_invoice_value: 0,
        total_paid: 0,
        total_outstanding: 0,
      }];
    }

    try {
      // Top customers by sales value
      topCustomers = await erpDb.execute(sql`
        SELECT 
          c.id,
          c.name,
          c.code,
          COUNT(so.id) as total_orders,
          COALESCE(SUM(CAST(so.total_amount AS DECIMAL)), 0) as total_sales_value,
          COUNT(CASE WHEN so.status = 'completed' OR so.status = 'delivered' THEN 1 END) as completed_orders
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id
        WHERE c.erp_organization_id = ${user.erpOrganizationId}
        AND so.id IS NOT NULL
        ${dateFilter}
        GROUP BY c.id, c.name, c.code
        ORDER BY total_sales_value DESC
        LIMIT 10
      `);
    } catch (e: any) {
      console.error('Error in topCustomers:', e.message);
      topCustomers = [];
    }

    try {
      // Sales trends by month (last 12 months or filtered period)
      salesTrends = await erpDb.execute(sql`
        SELECT 
          TO_CHAR(so_date, 'YYYY-MM') as month,
          COUNT(*) as order_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_value
        FROM sales_orders
        WHERE erp_organization_id = ${user.erpOrganizationId}
          ${days > 0 ? sql`AND so_date >= CURRENT_DATE - INTERVAL '${sql.raw(days.toString())} days'` : sql`AND so_date >= CURRENT_DATE - INTERVAL '12 months'`}
        GROUP BY TO_CHAR(so_date, 'YYYY-MM')
        ORDER BY month DESC
      `);
    } catch (e: any) {
      console.error('Error in salesTrends:', e.message);
      salesTrends = [];
    }

    try {
      // Top selling products
      topProducts = await erpDb.execute(sql`
        SELECT 
          p.id,
          p.name,
          p.sku,
          COUNT(DISTINCT sol.sales_order_id) as order_count,
          COALESCE(SUM(CAST(sol.quantity_ordered AS DECIMAL)), 0) as total_quantity,
          COALESCE(SUM(CAST(sol.quantity_ordered AS DECIMAL) * CAST(sol.unit_price AS DECIMAL)), 0) as total_value
        FROM sales_order_lines sol
        JOIN sales_orders so ON sol.sales_order_id = so.id
        JOIN products p ON sol.product_id = p.id
        WHERE so.erp_organization_id = ${user.erpOrganizationId}
        ${customerId ? sql`AND so.customer_id = ${customerId}` : sql``}
        ${dateFilter}
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_value DESC
        LIMIT 10
      `);
    } catch (e: any) {
      console.error('Error in topProducts:', e.message);
      topProducts = [];
    }

    try {
      // Payment status breakdown
      paymentStatus = await erpDb.execute(sql`
        SELECT 
          status,
          COUNT(*) as invoice_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_amount,
          COALESCE(SUM(CAST(balance_amount AS DECIMAL)), 0) as balance_amount
        FROM sales_invoices
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${customerId ? sql`AND customer_id = ${customerId}` : sql``}
        ${dateFilter}
        GROUP BY status
      `);
    } catch (e: any) {
      console.error('Error in paymentStatus:', e.message);
      paymentStatus = [];
    }

    return NextResponse.json({
      orderSummary: orderSummary[0] || {},
      quotationSummary: quotationSummary[0] || {},
      invoiceSummary: invoiceSummary[0] || {},
      topCustomers,
      salesTrends,
      topProducts,
      paymentStatus,
    });
  } catch (error: any) {
    console.error('Error in sales analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales analytics: ' + error.message },
      { status: 500 }
    );
  }
}
