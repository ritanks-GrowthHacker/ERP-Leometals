import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/reports/trial-balance
 * Generate Trial Balance for a fiscal period
 * Query params: fiscalYear, fiscalPeriod (1-12, or 0 for full year)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view trial balance' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const fiscalYear = searchParams.get('fiscalYear');
    const fiscalPeriod = parseInt(searchParams.get('fiscalPeriod') || '0');

    if (!fiscalYear) {
      return NextResponse.json(
        { error: 'fiscalYear is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheResult = await pool.query(
      `SELECT 
        tb.*,
        coa.account_code,
        coa.account_name,
        coa.account_type,
        coa.account_subtype
      FROM trial_balance_cache tb
      JOIN chart_of_accounts coa ON tb.account_id = coa.id
      WHERE tb.erp_organization_id = $1 
        AND tb.fiscal_year = $2 
        AND tb.fiscal_period = $3
        AND tb.generated_at > NOW() - INTERVAL '1 hour'
      ORDER BY coa.account_code`,
      [user.organizationId, fiscalYear, fiscalPeriod]
    );

    if (cacheResult.rows.length > 0) {
      return NextResponse.json({
        cached: true,
        fiscalYear,
        fiscalPeriod,
        accounts: cacheResult.rows,
        summary: calculateSummary(cacheResult.rows),
      });
    }

    // Generate fresh trial balance
    let periodCondition = '';
    if (fiscalPeriod > 0) {
      periodCondition = `AND gl.fiscal_period <= ${fiscalPeriod}`;
    }

    const result = await pool.query(
      `SELECT 
        coa.id as account_id,
        coa.account_code,
        coa.account_name,
        coa.account_type,
        coa.account_subtype,
        coa.opening_balance,
        COALESCE(SUM(gl.debit_amount), 0) as total_debit,
        COALESCE(SUM(gl.credit_amount), 0) as total_credit,
        CASE 
          WHEN coa.account_type IN ('asset', 'expense') THEN
            coa.opening_balance + COALESCE(SUM(gl.debit_amount), 0) - COALESCE(SUM(gl.credit_amount), 0)
          ELSE
            coa.opening_balance + COALESCE(SUM(gl.credit_amount), 0) - COALESCE(SUM(gl.debit_amount), 0)
        END as closing_balance
      FROM chart_of_accounts coa
      LEFT JOIN general_ledger gl ON coa.id = gl.account_id 
        AND gl.erp_organization_id = $1
        AND gl.fiscal_year = $2
        ${periodCondition}
      WHERE coa.erp_organization_id = $1 AND coa.is_active = true
      GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.account_subtype, coa.opening_balance
      HAVING coa.opening_balance != 0 OR COALESCE(SUM(gl.debit_amount), 0) != 0 OR COALESCE(SUM(gl.credit_amount), 0) != 0
      ORDER BY coa.account_code`,
      [user.organizationId, fiscalYear]
    );

    // Cache results
    for (const row of result.rows) {
      await pool.query(
        `INSERT INTO trial_balance_cache (
          erp_organization_id, account_id, fiscal_year, fiscal_period,
          opening_balance, total_debit, total_credit, closing_balance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (erp_organization_id, account_id, fiscal_year, fiscal_period)
        DO UPDATE SET
          opening_balance = $5,
          total_debit = $6,
          total_credit = $7,
          closing_balance = $8,
          generated_at = NOW()`,
        [
          user.organizationId, row.account_id, fiscalYear, fiscalPeriod,
          row.opening_balance, row.total_debit, row.total_credit, row.closing_balance
        ]
      );
    }

    return NextResponse.json({
      cached: false,
      fiscalYear,
      fiscalPeriod,
      accounts: result.rows,
      summary: calculateSummary(result.rows),
    });
  } catch (error: any) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to generate trial balance', details: error.message },
      { status: 500 }
    );
  }
}

function calculateSummary(accounts: any[]) {
  const summary = {
    totalDebit: 0,
    totalCredit: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  };

  accounts.forEach((acc: any) => {
    const closing = parseFloat(acc.closing_balance || 0);
    summary.totalDebit += parseFloat(acc.total_debit || 0);
    summary.totalCredit += parseFloat(acc.total_credit || 0);

    if (acc.account_type === 'asset' && closing > 0) {
      summary.totalAssets += closing;
    } else if (acc.account_type === 'liability' && closing > 0) {
      summary.totalLiabilities += closing;
    } else if (acc.account_type === 'equity' && closing > 0) {
      summary.totalEquity += closing;
    } else if (acc.account_type === 'revenue') {
      summary.totalRevenue += Math.abs(closing);
    } else if (acc.account_type === 'expense' && closing > 0) {
      summary.totalExpenses += closing;
    }
  });

  return summary;
}
