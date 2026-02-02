import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view reports' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get revenue from sales orders
    const revenueResult = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(tax_amount), 0) as total_tax
       FROM sales_orders
       WHERE erp_organization_id = $1 
       AND so_date >= CAST($2 AS DATE)
       AND so_date <= CAST($3 AS DATE)
       AND status != 'cancelled'`,
      [user.organizationId, startDate, endDate]
    );

    // Get expenses from purchase orders - handle NULL values
    const expenseResult = await pool.query(
      `SELECT 
        COUNT(*) as po_count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN tax_amount IS NOT NULL THEN tax_amount ELSE 0 END) as total_tax
       FROM purchase_orders
       WHERE erp_organization_id = $1 
       AND po_date >= CAST($2 AS DATE)
       AND po_date <= CAST($3 AS DATE)
       AND status != 'cancelled'`,
      [user.organizationId, startDate, endDate]
    );

    console.log('📊 P&L Raw Query Results:');
    console.log('Revenue Result:', revenueResult.rows[0]);
    console.log('Expense Result:', expenseResult.rows[0]);
    console.log('Expenses Raw Value:', expenseResult.rows[0]?.total_expenses);
    console.log('Expenses Type:', typeof expenseResult.rows[0]?.total_expenses);

    const revenue = parseFloat(String(revenueResult.rows[0]?.total_revenue || 0)) || 0;
    const expenses = parseFloat(String(expenseResult.rows[0]?.total_expenses || 0)) || 0;
    const profit = revenue - expenses;
    const profitMargin = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0;

    console.log('P&L Report Data:', { 
      revenue, 
      expenses, 
      profit, 
      profitMargin,
      dateRange: { startDate, endDate },
      organizationId: user.organizationId,
      poCount: expenseResult.rows[0]?.po_count
    });

    return NextResponse.json({
      revenue,
      expenses,
      profit,
      profitMargin
    });
  } catch (error: any) {
    console.error('Error generating P&L:', error);
    return NextResponse.json(
      { error: 'Failed to generate P&L report' },
      { status: 500 }
    );
  }
}
