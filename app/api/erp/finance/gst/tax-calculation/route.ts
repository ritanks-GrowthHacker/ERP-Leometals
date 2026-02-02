import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * POST /api/erp/finance/gst/tax-calculation
 * Calculate GST amounts based on Place of Supply logic
 * 
 * Body:
 * {
 *   supplierStateCode: "27", // Your state
 *   customerStateCode: "29", // Customer state
 *   lineItems: [
 *     { productId: "uuid", taxableAmount: 10000, gstRateId: "uuid" }
 *   ]
 * }
 * 
 * Returns:
 * {
 *   isInterState: true/false,
 *   placeOfSupply: "29",
 *   lineItems: [
 *     { 
 *       taxableAmount: 10000,
 *       gstRate: 18,
 *       cgst: 0, sgst: 0, igst: 1800, // IGST for inter-state
 *       totalAmount: 11800
 *     }
 *   ],
 *   summary: {
 *     subtotal: 10000,
 *     totalCgst: 0,
 *     totalSgst: 0,
 *     totalIgst: 1800,
 *     totalCess: 0,
 *     grandTotal: 11800
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to calculate GST' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { supplierStateCode, customerStateCode, lineItems, isRcmApplicable } = body;

    if (!supplierStateCode || !customerStateCode || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierStateCode, customerStateCode, lineItems' },
        { status: 400 }
      );
    }

    /**
     * GST PLACE OF SUPPLY LOGIC:
     * - If supplier state == customer state → INTRA-STATE → Apply CGST + SGST
     * - If supplier state != customer state → INTER-STATE → Apply IGST
     * - Place of Supply = Customer's state (or delivery location state)
     */
    const isInterState = supplierStateCode !== customerStateCode;
    const placeOfSupply = customerStateCode;

    const calculatedLineItems = [];
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;

    for (const item of lineItems) {
      const { taxableAmount, gstRateId, productId } = item;

      if (!taxableAmount || taxableAmount <= 0) {
        return NextResponse.json(
          { error: 'Invalid taxable amount for line item' },
          { status: 400 }
        );
      }

      // Fetch GST rate
      let gstRate: any = null;
      if (gstRateId) {
        const rateResult = await pool.query(
          'SELECT * FROM gst_rates WHERE id = $1 AND is_active = true',
          [gstRateId]
        );
        gstRate = rateResult.rows[0];
      } else if (productId) {
        // Fetch from product mapping
        const mappingResult = await pool.query(
          `SELECT gr.* FROM product_gst_mapping pgm
          JOIN gst_rates gr ON pgm.gst_rate_id = gr.id
          WHERE pgm.product_id = $1 AND gr.is_active = true
          AND (gr.effective_to IS NULL OR gr.effective_to >= CURRENT_DATE)
          ORDER BY gr.effective_from DESC LIMIT 1`,
          [productId]
        );
        gstRate = mappingResult.rows[0];
      }

      if (!gstRate) {
        return NextResponse.json(
          { error: 'GST rate not found for line item. Please configure product GST mapping.' },
          { status: 400 }
        );
      }

      // Calculate tax amounts
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let cessAmount = 0;

      if (isInterState) {
        // INTER-STATE: Apply IGST
        igstAmount = (taxableAmount * gstRate.igst_rate) / 100;
      } else {
        // INTRA-STATE: Apply CGST + SGST
        cgstAmount = (taxableAmount * gstRate.cgst_rate) / 100;
        sgstAmount = (taxableAmount * gstRate.sgst_rate) / 100;
      }

      if (gstRate.cess_rate && gstRate.cess_rate > 0) {
        cessAmount = (taxableAmount * gstRate.cess_rate) / 100;
      }

      const totalGst = cgstAmount + sgstAmount + igstAmount + cessAmount;
      const lineTotalAmount = taxableAmount + totalGst;

      calculatedLineItems.push({
        ...item,
        gstRate: gstRate.igst_rate || (gstRate.cgst_rate + gstRate.sgst_rate),
        cgstRate: gstRate.cgst_rate,
        sgstRate: gstRate.sgst_rate,
        igstRate: gstRate.igst_rate,
        cessRate: gstRate.cess_rate,
        cgstAmount: parseFloat(cgstAmount.toFixed(2)),
        sgstAmount: parseFloat(sgstAmount.toFixed(2)),
        igstAmount: parseFloat(igstAmount.toFixed(2)),
        cessAmount: parseFloat(cessAmount.toFixed(2)),
        totalGst: parseFloat(totalGst.toFixed(2)),
        totalAmount: parseFloat(lineTotalAmount.toFixed(2)),
      });

      subtotal += taxableAmount;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;
      totalCess += cessAmount;
    }

    const grandTotal = subtotal + totalCgst + totalSgst + totalIgst + totalCess;

    return NextResponse.json({
      isInterState,
      placeOfSupply,
      isRcmApplicable: isRcmApplicable || false,
      lineItems: calculatedLineItems,
      summary: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalCgst: parseFloat(totalCgst.toFixed(2)),
        totalSgst: parseFloat(totalSgst.toFixed(2)),
        totalIgst: parseFloat(totalIgst.toFixed(2)),
        totalCess: parseFloat(totalCess.toFixed(2)),
        totalGst: parseFloat((totalCgst + totalSgst + totalIgst + totalCess).toFixed(2)),
        grandTotal: parseFloat(grandTotal.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error calculating GST:', error);
    return NextResponse.json(
      { error: 'Failed to calculate GST', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/erp/finance/gst/tax-calculation/rates
 * Get all active GST rates for the organization
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const result = await pool.query(
      `SELECT * FROM gst_rates 
      WHERE erp_organization_id = $1 
      AND is_active = true
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY igst_rate ASC`,
      [user.organizationId]
    );

    return NextResponse.json({
      rates: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching GST rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GST rates', details: error.message },
      { status: 500 }
    );
  }
}
