import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/invoices/purchase
 * Fetch all purchase invoices with ITC tracking
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view purchase invoices' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const status = searchParams.get('status');
    const itcStatus = searchParams.get('itcStatus'); // 'eligible', 'claimed', 'blocked'
    const offset = (page - 1) * limit;

    let whereConditions = 'WHERE pi.erp_organization_id = $1';
    const params: any[] = [user.organizationId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions += ` AND pi.status = $${paramCount}`;
      params.push(status);
    }

    if (itcStatus === 'eligible') {
      whereConditions += ` AND pi.itc_eligible = true AND pi.itc_claimed = false`;
    } else if (itcStatus === 'claimed') {
      whereConditions += ` AND pi.itc_claimed = true`;
    } else if (itcStatus === 'blocked') {
      whereConditions += ` AND pi.itc_eligible = false`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM purchase_invoices_gst pi ${whereConditions}`,
      params
    );

    const pagedCount = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
        pi.*,
        s.name as supplier_name,
        s.email as supplier_email,
        vgd.gstin as supplier_gstin_full,
        st.state_name as supplier_state_name
      FROM purchase_invoices_gst pi
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      LEFT JOIN vendor_gst_details vgd ON s.id = vgd.supplier_id
      LEFT JOIN indian_states st ON pi.supplier_state_code = st.state_code
      ${whereConditions}
      ORDER BY pi.invoice_date DESC, pi.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    // Also get recent purchase orders as fallback
    const recentOrders = await pool.query(
      `SELECT 
        po.id,
        po.po_number as invoice_number,
        po.po_date as invoice_date,
        po.supplier_id,
        po.total_amount,
        po.tax_amount,
        po.status,
        s.name as supplier_name,
        0 as itc_cgst_amount,
        0 as itc_sgst_amount,
        0 as itc_igst_amount,
        'purchase_order' as record_type
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.erp_organization_id = $1 AND po.status != 'cancelled'
      ORDER BY po.po_date DESC, po.created_at DESC
      LIMIT $2`,
      [user.organizationId, limit]
    );

    // Query purchase_invoices_gst table
    const invoicesSummaryResult = await pool.query(
      `SELECT 
        COUNT(*) as invoice_count,
        COALESCE(SUM(total_amount), 0) as invoice_expenses,
        COALESCE(SUM(total_gst_amount), 0) as invoice_tax,
        COALESCE(SUM(itc_cgst_amount + itc_sgst_amount + itc_igst_amount), 0) as invoice_itc
      FROM purchase_invoices_gst
      WHERE erp_organization_id = $1`,
      [user.organizationId]
    );
    
    // Query purchase_orders table (fallback)
    const ordersSummaryResult = await pool.query(
      `SELECT 
        COUNT(*) as order_count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as order_expenses,
        SUM(CASE WHEN tax_amount IS NOT NULL THEN tax_amount ELSE 0 END) as order_tax
      FROM purchase_orders
      WHERE erp_organization_id = $1 AND status != 'cancelled'`,
      [user.organizationId]
    );
    
    const invoicesSummary = invoicesSummaryResult.rows[0];
    const ordersSummary = ordersSummaryResult.rows[0];
    
    console.log('📊 Raw Query Results:');
    console.log('Invoices Summary:', invoicesSummary);
    console.log('Orders Summary:', ordersSummary);
    console.log('Order Expenses Raw:', ordersSummary.order_expenses);
    console.log('Order Expenses Type:', typeof ordersSummary.order_expenses);
    
    // Combine results with robust parsing
    const totalCount = parseInt(invoicesSummary.invoice_count || 0) + parseInt(ordersSummary.order_count || 0);
    const totalExpenses = (parseFloat(String(invoicesSummary.invoice_expenses || 0)) || 0) + (parseFloat(String(ordersSummary.order_expenses || 0)) || 0);
    const totalTax = (parseFloat(String(invoicesSummary.invoice_tax || 0)) || 0) + (parseFloat(String(ordersSummary.order_tax || 0)) || 0);
    const totalITC = parseFloat(String(invoicesSummary.invoice_itc || 0)) || 0;
    
    // Get ITC details separately from GST invoices only
    const itcResult = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN itc_claimed THEN (itc_cgst_amount + itc_sgst_amount + itc_igst_amount) ELSE 0 END), 0) as claimed_itc,
        COALESCE(SUM(itc_blocked_amount), 0) as blocked_itc
      FROM purchase_invoices_gst
      WHERE erp_organization_id = $1`,
      [user.organizationId]
    );
    
    const itcSummary = itcResult.rows[0];
    
    // Debug logging
    console.log('🔍 Purchase Summary Debug:');
    console.log('Organization ID:', user.organizationId);
    console.log('Invoice Count:', invoicesSummary.invoice_count);
    console.log('Invoice Expenses:', invoicesSummary.invoice_expenses);
    console.log('Order Count:', ordersSummary.order_count);
    console.log('Order Expenses:', ordersSummary.order_expenses);
    console.log('Total Count:', totalCount);
    console.log('Total Expenses:', totalExpenses);
    console.log('Total Tax:', totalTax);
    console.log('Total ITC:', totalITC);
    console.log('Claimed ITC:', itcSummary.claimed_itc);
    console.log('Blocked ITC:', itcSummary.blocked_itc);

    // Use orders if no invoices exist
    const displayRecords = result.rows.length > 0 ? result.rows : recentOrders.rows;

    return NextResponse.json({
      invoices: displayRecords,
      total: totalCount,
      summary: {
        totalExpenses: totalExpenses,
        totalGst: totalTax,
        totalITC: totalITC,
        claimedITC: parseFloat(itcSummary.claimed_itc || '0'),
        blockedITC: parseFloat(itcSummary.blocked_itc || '0'),
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching purchase invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoices', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/invoices/purchase
 * Create purchase invoice with ITC calculation
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create purchase invoices' },
      { status: 403 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const body = await req.json();
    const {
      invoiceNumber, // Our internal
      vendorInvoiceNumber, // Vendor's invoice number (CRITICAL)
      invoiceType,
      purchaseOrderId,
      supplierId,
      supplierGstin,
      supplierStateCode,
      invoiceDate,
      supplyDate,
      dueDate,
      financialYear,
      placeOfSupply,
      isRcmApplicable,
      paymentTerms,
      notes,
      lineItems,
    } = body;

    if (!supplierId || !vendorInvoiceNumber || !invoiceDate || !lineItems || lineItems.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, vendorInvoiceNumber, invoiceDate, lineItems' },
        { status: 400 }
      );
    }

    // Generate internal invoice number
    const finalInvoiceNumber = invoiceNumber || await generatePurchaseInvoiceNumber(client, user.organizationId, financialYear);

    // Get organization's state
    const gstConfigResult = await client.query(
      'SELECT state_code FROM gst_configuration WHERE erp_organization_id = $1 AND is_primary = true LIMIT 1',
      [user.organizationId]
    );

    if (gstConfigResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No primary GSTIN configured' },
        { status: 400 }
      );
    }

    const ourStateCode = gstConfigResult.rows[0].state_code;
    const finalPlaceOfSupply = placeOfSupply || ourStateCode;
    const isInterState = supplierStateCode !== finalPlaceOfSupply;

    // Calculate totals
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;
    let itcBlockedAmount = 0;

    const processedLines = [];

    for (const line of lineItems) {
      const lineSubtotal = line.quantity * line.unitPrice;
      const lineTaxable = lineSubtotal;

      // Get GST rate
      const rateResult = await client.query(
        'SELECT * FROM gst_rates WHERE id = $1 AND is_active = true',
        [line.gstRateId]
      );

      if (rateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `GST rate not found for: ${line.description}` },
          { status: 400 }
        );
      }

      const gstRate = rateResult.rows[0];

      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;
      let lineCess = 0;

      if (isInterState) {
        lineIgst = (lineTaxable * gstRate.igst_rate) / 100;
      } else {
        lineCgst = (lineTaxable * gstRate.cgst_rate) / 100;
        lineSgst = (lineTaxable * gstRate.sgst_rate) / 100;
      }

      if (gstRate.cess_rate) {
        lineCess = (lineTaxable * gstRate.cess_rate) / 100;
      }

      // ITC Eligibility Logic
      const itcEligible = line.itcEligible !== false; // Default true
      let lineItcCgst = 0;
      let lineItcSgst = 0;
      let lineItcIgst = 0;
      let lineItcBlocked = 0;

      if (itcEligible) {
        lineItcCgst = lineCgst;
        lineItcSgst = lineSgst;
        lineItcIgst = lineIgst;
      } else {
        // ITC blocked (Section 17(5) - motor vehicles, food, etc.)
        lineItcBlocked = lineCgst + lineSgst + lineIgst;
      }

      const lineTotal = lineTaxable + lineCgst + lineSgst + lineIgst + lineCess;

      processedLines.push({
        ...line,
        taxableAmount: lineTaxable,
        cgstRate: gstRate.cgst_rate,
        sgstRate: gstRate.sgst_rate,
        igstRate: gstRate.igst_rate,
        cessRate: gstRate.cess_rate,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        igstAmount: lineIgst,
        cessAmount: lineCess,
        itcEligible,
        itcCgstAmount: lineItcCgst,
        itcSgstAmount: lineItcSgst,
        itcIgstAmount: lineItcIgst,
        itcBlockReason: line.itcBlockReason || null,
        lineTotal,
      });

      subtotal += lineSubtotal;
      taxableAmount += lineTaxable;
      totalCgst += lineCgst;
      totalSgst += lineSgst;
      totalIgst += lineIgst;
      totalCess += lineCess;
      itcCgst += lineItcCgst;
      itcSgst += lineItcSgst;
      itcIgst += lineItcIgst;
      itcBlockedAmount += lineItcBlocked;
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst + totalCess;
    const totalAmount = taxableAmount + totalGstAmount;
    const balanceAmount = totalAmount;

    // Insert invoice header
    const invoiceResult = await client.query(
      `INSERT INTO purchase_invoices_gst (
        erp_organization_id, invoice_number, vendor_invoice_number, invoice_type,
        purchase_order_id, supplier_id, supplier_gstin, supplier_state_code,
        invoice_date, supply_date, due_date, financial_year, place_of_supply,
        is_inter_state, is_rcm_applicable, subtotal, discount_amount, taxable_amount,
        cgst_amount, sgst_amount, igst_amount, cess_amount, total_gst_amount,
        total_amount, balance_amount, itc_eligible, itc_cgst_amount, itc_sgst_amount,
        itc_igst_amount, itc_blocked_amount, payment_terms, notes, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING *`,
      [
        user.organizationId, finalInvoiceNumber, vendorInvoiceNumber, invoiceType || 'purchase_invoice',
        purchaseOrderId || null, supplierId, supplierGstin || null, supplierStateCode,
        invoiceDate, supplyDate || invoiceDate, dueDate, financialYear, finalPlaceOfSupply,
        isInterState, isRcmApplicable || false, subtotal, discountAmount, taxableAmount,
        totalCgst, totalSgst, totalIgst, totalCess, totalGstAmount, totalAmount, balanceAmount,
        itcBlockedAmount === 0, itcCgst, itcSgst, itcIgst, itcBlockedAmount,
        paymentTerms || null, notes || null, 'draft', user.id
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Insert line items
    for (const line of processedLines) {
      await client.query(
        `INSERT INTO purchase_invoice_lines_gst (
          invoice_id, product_id, hsn_sac_code, description, quantity, unit_of_measurement,
          unit_price, taxable_amount, gst_rate, cgst_rate, sgst_rate, igst_rate,
          cess_rate, cgst_amount, sgst_amount, igst_amount, cess_amount,
          itc_eligible, itc_cgst_amount, itc_sgst_amount, itc_igst_amount,
          itc_block_reason, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          invoice.id, line.productId || null, line.hsnSacCode, line.description,
          line.quantity, line.unitOfMeasurement || 'NOS', line.unitPrice,
          line.taxableAmount, line.igstRate || (line.cgstRate + line.sgstRate),
          line.cgstRate, line.sgstRate, line.igstRate, line.cessRate,
          line.cgstAmount, line.sgstAmount, line.igstAmount, line.cessAmount,
          line.itcEligible, line.itcCgstAmount, line.itcSgstAmount, line.itcIgstAmount,
          line.itcBlockReason, line.lineTotal
        ]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      message: 'Purchase invoice created successfully',
      invoice: invoice,
    }, { status: 201 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase invoice', details: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

async function generatePurchaseInvoiceNumber(client: any, organizationId: string, financialYear: string): Promise<string> {
  const result = await client.query(
    `SELECT invoice_number FROM purchase_invoices_gst 
    WHERE erp_organization_id = $1 AND financial_year = $2 
    ORDER BY created_at DESC LIMIT 1`,
    [organizationId, financialYear]
  );

  if (result.rows.length === 0) {
    return `PI/${financialYear}/0001`;
  }

  const lastNumber = result.rows[0].invoice_number;
  const match = lastNumber.match(/(\d+)$/);
  if (match) {
    const nextNumber = parseInt(match[1]) + 1;
    return `PI/${financialYear}/${String(nextNumber).padStart(4, '0')}`;
  }

  return `PI/${financialYear}/0001`;
}
