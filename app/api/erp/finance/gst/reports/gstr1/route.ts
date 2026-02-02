import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/gst/reports/gstr1
 * Generate GSTR-1 (Outward Supplies) report for a given period
 * Query params: period (e.g., 'Jan-2026'), financialYear ('2025-26')
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view GSTR-1 reports' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period'); // 'Jan-2026'
    const financialYear = searchParams.get('financialYear'); // '2025-26'
    const gstin = searchParams.get('gstin'); // Optional: Specific GSTIN

    if (!period || !financialYear) {
      return NextResponse.json(
        { error: 'Missing required parameters: period, financialYear' },
        { status: 400 }
      );
    }

    // Parse period to date range
    const { startDate, endDate } = parsePeriodToDates(period, financialYear);

    // Get primary GSTIN if not provided
    let gstinToUse = gstin;
    if (!gstinToUse) {
      const gstResult = await pool.query(
        'SELECT gstin FROM gst_configuration WHERE erp_organization_id = $1 AND is_primary = true LIMIT 1',
        [user.organizationId]
      );
      if (gstResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'No GSTIN configured' },
          { status: 400 }
        );
      }
      gstinToUse = gstResult.rows[0].gstin;
    }

    // B2B Supplies (Business to Business - with GSTIN)
    // UNION: Query BOTH sales_invoices_gst AND sales_orders (fallback)
    const b2bResult = await pool.query(
      `SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        cgd.gstin as customer_gstin,
        c.name as customer_name,
        si.place_of_supply,
        si.is_inter_state,
        si.taxable_amount,
        si.cgst_amount,
        si.sgst_amount,
        si.igst_amount,
        si.cess_amount,
        si.total_amount
      FROM sales_invoices_gst si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN customer_gst_details cgd ON c.id = cgd.customer_id
      WHERE si.erp_organization_id = $1
        AND si.invoice_date >= $2
        AND si.invoice_date <= $3
        AND si.status NOT IN ('draft', 'cancelled')
        AND cgd.gstin IS NOT NULL AND cgd.gstin != ''
      
      UNION ALL
      
      SELECT 
        so.id,
        so.so_number as invoice_number,
        so.so_date as invoice_date,
        c.tax_id as customer_gstin,
        c.name as customer_name,
        c.state as place_of_supply,
        false as is_inter_state,
        COALESCE(so.subtotal, 0) as taxable_amount,
        COALESCE(so.tax_amount, 0) * 0.09 as cgst_amount,
        COALESCE(so.tax_amount, 0) * 0.09 as sgst_amount,
        0 as igst_amount,
        0 as cess_amount,
        COALESCE(so.total_amount, 0) as total_amount
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.erp_organization_id = $1
        AND so.so_date >= $2
        AND so.so_date <= $3
        AND so.status NOT IN ('draft', 'cancelled')
        AND c.tax_id IS NOT NULL
      
      ORDER BY invoice_date ASC`,
      [user.organizationId, startDate, endDate]
    );

    // B2C Large Supplies (Consumer, invoice > Rs 2.5 lakhs)
    const b2cLargeResult = await pool.query(
      `SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.place_of_supply,
        si.taxable_amount,
        si.cgst_amount,
        si.sgst_amount,
        si.igst_amount,
        si.cess_amount,
        si.total_amount
      FROM sales_invoices_gst si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN customer_gst_details cgd ON c.id = cgd.customer_id
      WHERE si.erp_organization_id = $1
        AND si.invoice_date >= $2
        AND si.invoice_date <= $3
        AND si.status NOT IN ('draft', 'cancelled')
        AND (cgd.gstin IS NULL OR cgd.gstin = '')
        AND si.total_amount > 250000
      
      UNION ALL
      
      SELECT 
        so.id,
        so.so_number as invoice_number,
        so.so_date as invoice_date,
        c.state as place_of_supply,
        COALESCE(so.subtotal, 0) as taxable_amount,
        COALESCE(so.tax_amount, 0) * 0.09 as cgst_amount,
        COALESCE(so.tax_amount, 0) * 0.09 as sgst_amount,
        0 as igst_amount,
        0 as cess_amount,
        COALESCE(so.total_amount, 0) as total_amount
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.erp_organization_id = $1
        AND so.so_date >= $2
        AND so.so_date <= $3
        AND so.status NOT IN ('draft', 'cancelled')
        AND (c.tax_id IS NULL OR c.tax_id = '')
        AND so.total_amount > 250000
      
      ORDER BY invoice_date ASC`,
      [user.organizationId, startDate, endDate]
    );

    // B2C Other (Consumer, invoice <= Rs 2.5 lakhs) - Aggregated
    const b2cOtherResult = await pool.query(
      `SELECT 
        place_of_supply,
        SUM(total_taxable_amount) as total_taxable_amount,
        SUM(total_cgst) as total_cgst,
        SUM(total_sgst) as total_sgst,
        SUM(total_igst) as total_igst,
        SUM(total_cess) as total_cess,
        SUM(invoice_count) as invoice_count
      FROM (
        SELECT 
          si.place_of_supply,
          si.taxable_amount as total_taxable_amount,
          si.cgst_amount as total_cgst,
          si.sgst_amount as total_sgst,
          si.igst_amount as total_igst,
          si.cess_amount as total_cess,
          1 as invoice_count
        FROM sales_invoices_gst si
        LEFT JOIN customers c ON si.customer_id = c.id
        LEFT JOIN customer_gst_details cgd ON c.id = cgd.customer_id
        WHERE si.erp_organization_id = $1
          AND si.invoice_date >= $2
          AND si.invoice_date <= $3
          AND si.status NOT IN ('draft', 'cancelled')
          AND (cgd.gstin IS NULL OR cgd.gstin = '')
          AND si.total_amount <= 250000
        
        UNION ALL
        
        SELECT 
          c.state as place_of_supply,
          COALESCE(so.subtotal, 0) as total_taxable_amount,
          COALESCE(so.tax_amount, 0) * 0.09 as total_cgst,
          COALESCE(so.tax_amount, 0) * 0.09 as total_sgst,
          0 as total_igst,
          0 as total_cess,
          1 as invoice_count
        FROM sales_orders so
        LEFT JOIN customers c ON so.customer_id = c.id
        WHERE so.erp_organization_id = $1
          AND so.so_date >= $2
          AND so.so_date <= $3
          AND so.status NOT IN ('draft', 'cancelled')
          AND (c.tax_id IS NULL OR c.tax_id = '')
          AND so.total_amount <= 250000
      ) combined
      GROUP BY place_of_supply
      ORDER BY place_of_supply`,
      [user.organizationId, startDate, endDate]
    );

    // Export Invoices
    const exportResult = await pool.query(
      `SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.taxable_amount,
        si.igst_amount
      FROM sales_invoices_gst si
      LEFT JOIN customer_gst_details cgd ON si.customer_id = cgd.customer_id
      WHERE si.erp_organization_id = $1
        AND si.financial_year = $2
        AND si.invoice_date >= $3
        AND si.invoice_date <= $4
        AND si.status NOT IN ('draft', 'cancelled')
        AND (si.invoice_type = 'export_invoice' OR cgd.customer_type = 'export')
      ORDER BY si.invoice_date ASC`,
      [user.organizationId, financialYear, startDate, endDate]
    );

    // Calculate Summary Totals - handle empty arrays to avoid NaN
    const b2bTotal = b2bResult.rows.length > 0 
      ? b2bResult.rows.reduce((sum, row) => sum + parseFloat(row.taxable_amount || '0'), 0) 
      : 0;
    const b2bIgst = b2bResult.rows.length > 0
      ? b2bResult.rows.reduce((sum, row) => sum + parseFloat(row.igst_amount || '0'), 0)
      : 0;
    const b2bCgst = b2bResult.rows.length > 0
      ? b2bResult.rows.reduce((sum, row) => sum + parseFloat(row.cgst_amount || '0'), 0)
      : 0;
    const b2bSgst = b2bResult.rows.length > 0
      ? b2bResult.rows.reduce((sum, row) => sum + parseFloat(row.sgst_amount || '0'), 0)
      : 0;

    const b2cLargeTotal = b2cLargeResult.rows.length > 0
      ? b2cLargeResult.rows.reduce((sum, row) => sum + parseFloat(row.taxable_amount || '0'), 0)
      : 0;
    const b2cOtherTotal = b2cOtherResult.rows.length > 0
      ? b2cOtherResult.rows.reduce((sum, row) => sum + parseFloat(row.total_taxable_amount || '0'), 0)
      : 0;

    const exportTotal = exportResult.rows.length > 0
      ? exportResult.rows.reduce((sum, row) => sum + parseFloat(row.taxable_amount || '0'), 0)
      : 0;
    const exportIgst = exportResult.rows.length > 0
      ? exportResult.rows.reduce((sum, row) => sum + parseFloat(row.igst_amount || '0'), 0)
      : 0;

    // Check if summary already exists
    const existingSummary = await pool.query(
      'SELECT * FROM gstr1_summary WHERE erp_organization_id = $1 AND return_period = $2',
      [user.organizationId, period]
    );

    // Upsert summary
    if (existingSummary.rows.length > 0) {
      await pool.query(
        `UPDATE gstr1_summary SET
          b2b_invoices_count = $1,
          b2b_taxable_value = $2,
          b2b_igst_amount = $3,
          b2b_cgst_amount = $4,
          b2b_sgst_amount = $5,
          b2c_large_invoices_count = $6,
          b2c_large_taxable_value = $7,
          b2c_other_taxable_value = $8,
          export_taxable_value = $9,
          export_igst_amount = $10,
          generated_at = NOW(),
          status = 'generated'
        WHERE erp_organization_id = $11 AND return_period = $12`,
        [
          b2bResult.rows.length, b2bTotal, b2bIgst, b2bCgst, b2bSgst,
          b2cLargeResult.rows.length, b2cLargeTotal, b2cOtherTotal,
          exportTotal, exportIgst, user.organizationId, period
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO gstr1_summary (
          erp_organization_id, gstin, return_period, financial_year,
          b2b_invoices_count, b2b_taxable_value, b2b_igst_amount, b2b_cgst_amount, b2b_sgst_amount,
          b2c_large_invoices_count, b2c_large_taxable_value, b2c_other_taxable_value,
          export_taxable_value, export_igst_amount, generated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), 'generated')`,
        [
          user.organizationId, gstinToUse, period, financialYear,
          b2bResult.rows.length, b2bTotal, b2bIgst, b2bCgst, b2bSgst,
          b2cLargeResult.rows.length, b2cLargeTotal, b2cOtherTotal,
          exportTotal, exportIgst
        ]
      );
    }

    return NextResponse.json({
      period,
      financialYear,
      gstin: gstinToUse,
      b2b: {
        invoices: b2bResult.rows,
        count: b2bResult.rows.length,
        totalTaxableValue: b2bTotal,
        totalIgst: b2bIgst,
        totalCgst: b2bCgst,
        totalSgst: b2bSgst,
      },
      b2cLarge: {
        invoices: b2cLargeResult.rows,
        count: b2cLargeResult.rows.length,
        totalTaxableValue: b2cLargeTotal,
      },
      b2cOther: {
        aggregated: b2cOtherResult.rows,
        totalTaxableValue: b2cOtherTotal,
      },
      exports: {
        invoices: exportResult.rows,
        totalTaxableValue: exportTotal,
        totalIgst: exportIgst,
      },
      summary: {
        totalOutwardSupplies: b2bTotal + b2cLargeTotal + b2cOtherTotal + exportTotal,
        totalTaxAmount: b2bIgst + b2bCgst + b2bSgst + exportIgst,
      },
    });
  } catch (error: any) {
    console.error('Error generating GSTR-1:', error);
    return NextResponse.json(
      { error: 'Failed to generate GSTR-1', details: error.message },
      { status: 500 }
    );
  }
}

function parsePeriodToDates(period: string, financialYear: string): { startDate: string; endDate: string } {
  // Period format: 'Jan-2026' or 'Q1-2026'
  const months: any = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };

  const parts = period.split('-');
  const monthOrQuarter = parts[0];
  const year = parseInt(parts[1]);

  if (monthOrQuarter.startsWith('Q')) {
    // Quarterly
    const quarter = parseInt(monthOrQuarter.replace('Q', ''));
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${getDaysInMonth(year, endMonth)}`;
    return { startDate, endDate };
  } else {
    // Monthly
    const month = months[monthOrQuarter];
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${getDaysInMonth(year, month)}`;
    return { startDate, endDate };
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * POST /api/erp/finance/gst/reports/gstr1
 * Alternative POST endpoint - accepts period in query params
 */
export async function POST(req: NextRequest) {
  // Redirect to GET handler
  return GET(req);
}
