import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/gst/reports/gstr3b
 * Generate GSTR-3B (Monthly Return with ITC) for a given period
 * Query params: period (e.g., 'Jan-2026'), financialYear ('2025-26')
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view GSTR-3B reports' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period');
    const financialYear = searchParams.get('financialYear');

    if (!period || !financialYear) {
      return NextResponse.json(
        { error: 'Missing required parameters: period, financialYear' },
        { status: 400 }
      );
    }

    const { startDate, endDate } = parsePeriodToDates(period, financialYear);

    // Get primary GSTIN
    const gstResult = await pool.query(
      'SELECT gstin, state_code FROM gst_configuration WHERE erp_organization_id = $1 AND is_primary = true LIMIT 1',
      [user.organizationId]
    );

    if (gstResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No GSTIN configured' },
        { status: 400 }
      );
    }

    const gstin = gstResult.rows[0].gstin;

    // TABLE 3.1(a) - Outward Taxable Supplies (Sales)
    // UNION: Both sales_invoices_gst AND sales_orders
    const outwardResult = await pool.query(
      `SELECT 
        COALESCE(SUM(taxable_amount), 0) as total_taxable,
        COALESCE(SUM(cgst_amount), 0) as total_cgst,
        COALESCE(SUM(sgst_amount), 0) as total_sgst,
        COALESCE(SUM(igst_amount), 0) as total_igst,
        COALESCE(SUM(cess_amount), 0) as total_cess
      FROM (
        SELECT 
          taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount
        FROM sales_invoices_gst
        WHERE erp_organization_id = $1
          AND invoice_date >= $2
          AND invoice_date <= $3
          AND status NOT IN ('draft', 'cancelled')
        
        UNION ALL
        
        SELECT 
          COALESCE(subtotal, 0) as taxable_amount,
          COALESCE(tax_amount, 0) * 0.09 as cgst_amount,
          COALESCE(tax_amount, 0) * 0.09 as sgst_amount,
          0 as igst_amount,
          0 as cess_amount
        FROM sales_orders
        WHERE erp_organization_id = $1
          AND so_date >= $2
          AND so_date <= $3
          AND status NOT IN ('draft', 'cancelled')
      ) combined`,
      [user.organizationId, startDate, endDate]
    );

    const outward = outwardResult.rows[0];

    // TABLE 3.1(d) - Inward Supplies liable to RCM (Reverse Charge)
    const rcmResult = await pool.query(
      `SELECT 
        COALESCE(SUM(taxable_amount), 0) as total_taxable,
        COALESCE(SUM(rcm_cgst_amount), 0) as total_cgst,
        COALESCE(SUM(rcm_sgst_amount), 0) as total_sgst,
        COALESCE(SUM(rcm_igst_amount), 0) as total_igst
      FROM purchase_invoices_gst
      WHERE erp_organization_id = $1
        AND invoice_date >= $2
        AND invoice_date <= $3
        AND status NOT IN ('draft', 'cancelled')
        AND is_rcm_applicable = true`,
      [user.organizationId, startDate, endDate]
    );

    const rcm = rcmResult.rows[0] || { total_taxable: 0, total_cgst: 0, total_sgst: 0, total_igst: 0 };

    // TABLE 4(A) - ITC Available (from purchases)
    // UNION: Both purchase_invoices_gst AND purchase_orders
    const itcAvailableResult = await pool.query(
      `SELECT 
        COALESCE(SUM(itc_cgst), 0) as total_cgst,
        COALESCE(SUM(itc_sgst), 0) as total_sgst,
        COALESCE(SUM(itc_igst), 0) as total_igst
      FROM (
        SELECT 
          itc_cgst_amount as itc_cgst,
          itc_sgst_amount as itc_sgst,
          itc_igst_amount as itc_igst
        FROM purchase_invoices_gst
        WHERE erp_organization_id = $1
          AND invoice_date >= $2
          AND invoice_date <= $3
          AND status NOT IN ('draft', 'cancelled')
          AND itc_eligible = true
        
        UNION ALL
        
        SELECT 
          COALESCE(tax_amount, 0) * 0.09 as itc_cgst,
          COALESCE(tax_amount, 0) * 0.09 as itc_sgst,
          0 as itc_igst
        FROM purchase_orders
        WHERE erp_organization_id = $1
          AND po_date >= $2
          AND po_date <= $3
          AND status NOT IN ('draft', 'cancelled')
      ) combined`,
      [user.organizationId, startDate, endDate]
    );

    const itcAvailable = itcAvailableResult.rows[0];

    // TABLE 4(B) - ITC Reversed - Set to 0 for now
    const itcReversed = {
      total_cgst: 0,
      total_sgst: 0,
      total_igst: 0
    };

    // Net ITC Available = ITC Available - ITC Reversed
    const netItcCgst = (parseFloat(itcAvailable.total_cgst || '0')) - itcReversed.total_cgst;
    const netItcSgst = (parseFloat(itcAvailable.total_sgst || '0')) - itcReversed.total_sgst;
    const netItcIgst = (parseFloat(itcAvailable.total_igst || '0')) - itcReversed.total_igst;

    // TABLE 5 - Tax Payable = Output Tax - Net ITC
    const cgstPayable = Math.max(0, parseFloat(String(outward.total_cgst || 0)) - netItcCgst);
    const sgstPayable = Math.max(0, parseFloat(String(outward.total_sgst || 0)) - netItcSgst);
    const igstPayable = Math.max(0, parseFloat(String(outward.total_igst || 0)) - netItcIgst);
    const cessPayable = parseFloat(String(outward.total_cess || 0));

    // Upsert GSTR-3B summary
    const existingSummary = await pool.query(
      'SELECT * FROM gstr3b_summary WHERE erp_organization_id = $1 AND return_period = $2',
      [user.organizationId, period]
    );

    if (existingSummary.rows.length > 0) {
      await pool.query(
        `UPDATE gstr3b_summary SET
          outward_taxable_supplies = $1,
          outward_igst = $2,
          outward_cgst = $3,
          outward_sgst = $4,
          outward_cess = $5,
          inward_rcm_taxable_value = $6,
          inward_rcm_igst = $7,
          inward_rcm_cgst = $8,
          inward_rcm_sgst = $9,
          itc_igst_available = $10,
          itc_cgst_available = $11,
          itc_sgst_available = $12,
          itc_igst_reversed = $13,
          itc_cgst_reversed = $14,
          itc_sgst_reversed = $15,
          net_itc_igst = $16,
          net_itc_cgst = $17,
          net_itc_sgst = $18,
          igst_payable = $19,
          cgst_payable = $20,
          sgst_payable = $21,
          cess_payable = $22,
          generated_at = NOW(),
          status = 'generated'
        WHERE erp_organization_id = $23 AND return_period = $24`,
        [
          outward.total_taxable, outward.total_igst, outward.total_cgst, outward.total_sgst, outward.total_cess,
          rcm.total_taxable || 0, rcm.total_igst || 0, rcm.total_cgst || 0, rcm.total_sgst || 0,
          itcAvailable.total_igst || 0, itcAvailable.total_cgst || 0, itcAvailable.total_sgst || 0,
          itcReversed.total_igst || 0, itcReversed.total_cgst || 0, itcReversed.total_sgst || 0,
          netItcIgst, netItcCgst, netItcSgst,
          igstPayable, cgstPayable, sgstPayable, cessPayable,
          user.organizationId, period
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO gstr3b_summary (
          erp_organization_id, gstin, return_period, financial_year,
          outward_taxable_supplies, outward_igst, outward_cgst, outward_sgst, outward_cess,
          inward_rcm_taxable_value, inward_rcm_igst, inward_rcm_cgst, inward_rcm_sgst,
          itc_igst_available, itc_cgst_available, itc_sgst_available,
          itc_igst_reversed, itc_cgst_reversed, itc_sgst_reversed,
          net_itc_igst, net_itc_cgst, net_itc_sgst,
          igst_payable, cgst_payable, sgst_payable, cess_payable,
          generated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), 'generated')`,
        [
          user.organizationId, gstin, period, financialYear,
          outward.total_taxable, outward.total_igst, outward.total_cgst, outward.total_sgst, outward.total_cess,
          rcm.total_taxable || 0, rcm.total_igst || 0, rcm.total_cgst || 0, rcm.total_sgst || 0,
          itcAvailable.total_igst || 0, itcAvailable.total_cgst || 0, itcAvailable.total_sgst || 0,
          itcReversed.total_igst || 0, itcReversed.total_cgst || 0, itcReversed.total_sgst || 0,
          netItcIgst, netItcCgst, netItcSgst,
          igstPayable, cgstPayable, sgstPayable, cessPayable
        ]
      );
    }

    return NextResponse.json({
      period,
      financialYear,
      gstin,
      table3_1_outward_supplies: {
        taxableValue: parseFloat(String(outward.total_taxable || 0)),
        igst: parseFloat(String(outward.total_igst || 0)),
        cgst: parseFloat(String(outward.total_cgst || 0)),
        sgst: parseFloat(String(outward.total_sgst || 0)),
        cess: parseFloat(String(outward.total_cess || 0)),
      },
      table3_1_rcm: {
        taxableValue: parseFloat(String(rcm.total_taxable || 0)),
        igst: parseFloat(String(rcm.total_igst || 0)),
        cgst: parseFloat(String(rcm.total_cgst || 0)),
        sgst: parseFloat(String(rcm.total_sgst || 0)),
      },
      table4_itc_available: {
        igst: parseFloat(String(itcAvailable.total_igst || 0)),
        cgst: parseFloat(String(itcAvailable.total_cgst || 0)),
        sgst: parseFloat(String(itcAvailable.total_sgst || 0)),
      },
      table4_itc_reversed: {
        igst: itcReversed.total_igst,
        cgst: itcReversed.total_cgst,
        sgst: itcReversed.total_sgst,
      },
      net_itc: {
        igst: parseFloat(netItcIgst.toFixed(2)),
        cgst: parseFloat(netItcCgst.toFixed(2)),
        sgst: parseFloat(netItcSgst.toFixed(2)),
      },
      table5_tax_payable: {
        igst: parseFloat(igstPayable.toFixed(2)),
        cgst: parseFloat(cgstPayable.toFixed(2)),
        sgst: parseFloat(sgstPayable.toFixed(2)),
        cess: parseFloat(cessPayable.toFixed(2)),
        total: parseFloat((igstPayable + cgstPayable + sgstPayable + cessPayable).toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error generating GSTR-3B:', error);
    return NextResponse.json(
      { error: 'Failed to generate GSTR-3B', details: error.message },
      { status: 500 }
    );
  }
}

function parsePeriodToDates(period: string, financialYear: string): { startDate: string; endDate: string } {
  const months: any = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };

  const parts = period.split('-');
  const monthName = parts[0];
  const year = parseInt(parts[1]);
  const month = months[monthName];

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${getDaysInMonth(year, month)}`;
  return { startDate, endDate };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * POST /api/erp/finance/gst/reports/gstr3b
 * Alternative POST endpoint - accepts period in query params
 */
export async function POST(req: NextRequest) {
  // Redirect to GET handler
  return GET(req);
}
