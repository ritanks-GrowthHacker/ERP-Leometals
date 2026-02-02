import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/invoices/sales
 * Fetch all GST-enabled sales invoices
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view sales invoices' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const status = searchParams.get('status');
    const financialYear = searchParams.get('financialYear');
    const offset = (page - 1) * limit;

    let whereConditions = 'WHERE si.erp_organization_id = $1';
    const params: any[] = [user.organizationId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions += ` AND si.status = $${paramCount}`;
      params.push(status);
    }

    if (financialYear) {
      paramCount++;
      whereConditions += ` AND si.financial_year = $${paramCount}`;
      params.push(financialYear);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM sales_invoices_gst si ${whereConditions}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
        si.*,
        c.name as customer_name,
        c.email as customer_email,
        cgd.gstin as customer_gstin,
        s.state_name as customer_state_name
      FROM sales_invoices_gst si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN customer_gst_details cgd ON c.id = cgd.customer_id
      LEFT JOIN indian_states s ON si.customer_state_code = s.state_code
      ${whereConditions}
      ORDER BY si.invoice_date DESC, si.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    // Also get recent sales orders as fallback
    const recentOrders = await pool.query(
      `SELECT 
        so.id,
        so.so_number as invoice_number,
        so.so_date as invoice_date,
        so.customer_id,
        so.total_amount,
        so.tax_amount,
        so.status,
        c.name as customer_name,
        'sales_order' as record_type
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.erp_organization_id = $1 AND so.status != 'cancelled'
      ORDER BY so.so_date DESC, so.created_at DESC
      LIMIT $2`,
      [user.organizationId, limit]
    );

    // Calculate summary stats
    // Get summary from BOTH sales_invoices_gst AND sales_orders (fallback for orders not yet invoiced)
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(total_gst_amount), 0) as total_gst,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_outstanding
      FROM sales_invoices_gst si
      ${whereConditions}`,
      params
    );

    // Also get sales orders as fallback
    const ordersResult = await pool.query(
      `SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END), 0) as order_revenue,
        COALESCE(SUM(CASE WHEN tax_amount IS NOT NULL THEN tax_amount ELSE 0 END), 0) as order_tax
      FROM sales_orders
      WHERE erp_organization_id = $1 AND status != 'cancelled'`,
      [user.organizationId]
    );

    const summary = summaryResult.rows[0];
    const ordersSummary = ordersResult.rows[0];

    console.log('📊 Sales Orders Raw Data:');
    console.log('Order Count:', ordersSummary.order_count);
    console.log('Order Revenue:', ordersSummary.order_revenue);
    console.log('Order Tax:', ordersSummary.order_tax);

    // Debug logging
    console.log('🔍 Sales Invoice Query Debug:');
    console.log('Organization ID:', user.organizationId);
    console.log('Total Invoices Found:', totalCount);
    console.log('Total Orders Found:', ordersSummary.order_count);
    console.log('Invoice Summary:', summary);
    console.log('Orders Summary:', ordersSummary);
    console.log('Invoices:', result.rows.length);
    console.log('Recent Orders:', recentOrders.rows.length);

    // Use orders if no invoices exist
    const displayRecords = result.rows.length > 0 ? result.rows : recentOrders.rows;

    return NextResponse.json({
      invoices: displayRecords,
      total: totalCount + parseInt(ordersSummary.order_count || 0),
      summary: {
        totalRevenue: parseFloat(summary.total_revenue || 0) + parseFloat(ordersSummary.order_revenue || 0),
        totalGst: parseFloat(summary.total_gst || 0) + parseFloat(ordersSummary.order_tax || 0),
        totalPaid: parseFloat(summary.total_paid || 0),
        totalOutstanding: parseFloat(summary.total_outstanding || 0),
        ordersCount: parseInt(ordersSummary.order_count || 0),
        ordersRevenue: parseFloat(ordersSummary.order_revenue || 0),
      },
      pagination: {
        page,
        limit,
        total: totalCount + parseInt(ordersSummary.order_count || 0),
        totalPages: Math.ceil((totalCount + parseInt(ordersSummary.order_count || 0)) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching sales invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales invoices', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/invoices/sales
 * Create a new GST sales invoice with line items
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create sales invoices' },
      { status: 403 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const body = await req.json();
    const {
      invoiceNumber, // Auto-generated or manual
      invoiceType,
      salesOrderId,
      customerId,
      customerGstin,
      customerStateCode,
      invoiceDate,
      supplyDate,
      dueDate,
      financialYear,
      placeOfSupply,
      paymentTerms,
      notes,
      termsAndConditions,
      lineItems, // Array of { productId, description, quantity, unitPrice, discountPercent, hsnSacCode, gstRateId }
    } = body;

    if (!customerId || !invoiceDate || !dueDate || !lineItems || lineItems.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Missing required fields: customerId, invoiceDate, dueDate, lineItems' },
        { status: 400 }
      );
    }

    // Generate invoice number if not provided
    const finalInvoiceNumber = invoiceNumber || await generateInvoiceNumber(client, user.organizationId, financialYear);

    // Get organization's primary GSTIN state
    const gstConfigResult = await client.query(
      'SELECT state_code FROM gst_configuration WHERE erp_organization_id = $1 AND is_primary = true LIMIT 1',
      [user.organizationId]
    );

    if (gstConfigResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No primary GSTIN configured. Please setup GST configuration first.' },
        { status: 400 }
      );
    }

    const supplierStateCode = gstConfigResult.rows[0].state_code;
    const finalPlaceOfSupply = placeOfSupply || customerStateCode;
    const isInterState = supplierStateCode !== finalPlaceOfSupply;

    // Calculate totals
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;

    const processedLines = [];

    for (const line of lineItems) {
      const lineSubtotal = line.quantity * line.unitPrice;
      const lineDiscount = lineSubtotal * (line.discountPercent || 0) / 100;
      const lineTaxable = lineSubtotal - lineDiscount;

      // Get GST rate
      const rateResult = await client.query(
        'SELECT * FROM gst_rates WHERE id = $1 AND is_active = true',
        [line.gstRateId]
      );

      if (rateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `GST rate not found for line item: ${line.description}` },
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
        lineTotal,
      });

      subtotal += lineSubtotal;
      discountAmount += lineDiscount;
      taxableAmount += lineTaxable;
      totalCgst += lineCgst;
      totalSgst += lineSgst;
      totalIgst += lineIgst;
      totalCess += lineCess;
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst + totalCess;
    const totalAmount = taxableAmount + totalGstAmount;
    const balanceAmount = totalAmount;

    // Insert invoice header
    const invoiceResult = await client.query(
      `INSERT INTO sales_invoices_gst (
        erp_organization_id, invoice_number, invoice_type, sales_order_id, customer_id,
        customer_gstin, customer_state_code, invoice_date, supply_date, due_date,
        financial_year, place_of_supply, is_inter_state, subtotal, discount_amount,
        taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount,
        total_gst_amount, total_amount, balance_amount, payment_terms, notes,
        terms_and_conditions, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *`,
      [
        user.organizationId, finalInvoiceNumber, invoiceType || 'tax_invoice', salesOrderId || null,
        customerId, customerGstin || null, customerStateCode, invoiceDate, supplyDate || invoiceDate,
        dueDate, financialYear, finalPlaceOfSupply, isInterState, subtotal, discountAmount,
        taxableAmount, totalCgst, totalSgst, totalIgst, totalCess, totalGstAmount,
        totalAmount, balanceAmount, paymentTerms || null, notes || null,
        termsAndConditions || null, 'draft', user.id
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Insert line items
    for (const line of processedLines) {
      await client.query(
        `INSERT INTO sales_invoice_lines_gst (
          invoice_id, product_id, hsn_sac_code, description, quantity, unit_of_measurement,
          unit_price, discount_percent, discount_amount, taxable_amount, gst_rate,
          cgst_rate, sgst_rate, igst_rate, cess_rate, cgst_amount, sgst_amount,
          igst_amount, cess_amount, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          invoice.id, line.productId || null, line.hsnSacCode, line.description,
          line.quantity, line.unitOfMeasurement || 'NOS', line.unitPrice,
          line.discountPercent || 0, line.taxableAmount - (line.quantity * line.unitPrice - line.taxableAmount),
          line.taxableAmount, line.igstRate || (line.cgstRate + line.sgstRate),
          line.cgstRate, line.sgstRate, line.igstRate, line.cessRate,
          line.cgstAmount, line.sgstAmount, line.igstAmount, line.cessAmount, line.lineTotal
        ]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      message: 'Sales invoice created successfully',
      invoice: invoice,
    }, { status: 201 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating sales invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create sales invoice', details: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

async function generateInvoiceNumber(client: any, organizationId: string, financialYear: string): Promise<string> {
  const result = await client.query(
    `SELECT invoice_number FROM sales_invoices_gst 
    WHERE erp_organization_id = $1 AND financial_year = $2 
    ORDER BY created_at DESC LIMIT 1`,
    [organizationId, financialYear]
  );

  if (result.rows.length === 0) {
    return `INV/${financialYear}/0001`;
  }

  const lastNumber = result.rows[0].invoice_number;
  const match = lastNumber.match(/(\d+)$/);
  if (match) {
    const nextNumber = parseInt(match[1]) + 1;
    return `INV/${financialYear}/${String(nextNumber).padStart(4, '0')}`;
  }

  return `INV/${financialYear}/0001`;
}
