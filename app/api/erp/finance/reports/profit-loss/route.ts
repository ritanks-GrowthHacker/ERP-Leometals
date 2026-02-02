import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/reports/profit-loss
 * Generate Profit & Loss Statement
 * Query params: startDate, endDate, fiscalYear
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view P&L' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const fiscalYear = searchParams.get('fiscalYear');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Revenue Accounts (Credit balance)
    const revenueResult = await pool.query(
      `SELECT 
        coa.account_code,
        coa.account_name,
        coa.account_subtype,
        COALESCE(SUM(gl.credit_amount) - SUM(gl.debit_amount), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN general_ledger gl ON coa.id = gl.account_id
        AND gl.erp_organization_id = $1
        AND gl.transaction_date >= $2
        AND gl.transaction_date <= $3
      WHERE coa.erp_organization_id = $1
        AND coa.account_type = 'revenue'
        AND coa.is_active = true
      GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_subtype
      HAVING COALESCE(SUM(gl.credit_amount) - SUM(gl.debit_amount), 0) != 0
      ORDER BY coa.account_code`,
      [user.organizationId, startDate, endDate]
    );

    // Expense Accounts (Debit balance)
    const expenseResult = await pool.query(
      `SELECT 
        coa.account_code,
        coa.account_name,
        coa.account_subtype,
        COALESCE(SUM(gl.debit_amount) - SUM(gl.credit_amount), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN general_ledger gl ON coa.id = gl.account_id
        AND gl.erp_organization_id = $1
        AND gl.transaction_date >= $2
        AND gl.transaction_date <= $3
      WHERE coa.erp_organization_id = $1
        AND coa.account_type = 'expense'
        AND coa.is_active = true
      GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_subtype
      HAVING COALESCE(SUM(gl.debit_amount) - SUM(gl.credit_amount), 0) != 0
      ORDER BY coa.account_code`,
      [user.organizationId, startDate, endDate]
    );

    const totalRevenue = revenueResult.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    const totalExpense = expenseResult.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    const netProfit = totalRevenue - totalExpense;

    return NextResponse.json({
      period: { startDate, endDate, fiscalYear },
      revenue: {
        accounts: revenueResult.rows,
        total: parseFloat(totalRevenue.toFixed(2)),
      },
      expenses: {
        accounts: expenseResult.rows,
        total: parseFloat(totalExpense.toFixed(2)),
      },
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitMargin: totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0,
    });
  } catch (error: any) {
    console.error('Error generating P&L:', error);
    return NextResponse.json(
      { error: 'Failed to generate P&L', details: error.message },
      { status: 500 }
    );
  }
}
