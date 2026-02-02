import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/invoices/sales/[id]
 * Get single sales invoice with all line items
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const { id: invoiceId } = await params;

    const invoiceResult = await pool.query(
      `SELECT 
        si.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.address as customer_address,
        cgd.gstin as customer_gstin_full,
        cgd.pan_number as customer_pan,
        s.state_name as customer_state_name
      FROM sales_invoices_gst si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN customer_gst_details cgd ON c.id = cgd.customer_id
      LEFT JOIN indian_states s ON si.customer_state_code = s.state_code
      WHERE si.id = $1 AND si.erp_organization_id = $2`,
      [invoiceId, user.organizationId]
    );

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoice = invoiceResult.rows[0];

    const linesResult = await pool.query(
      `SELECT 
        sil.*,
        p.name as product_name,
        p.sku as product_sku
      FROM sales_invoice_lines_gst sil
      LEFT JOIN products p ON sil.product_id = p.id
      WHERE sil.invoice_id = $1
      ORDER BY sil.created_at ASC`,
      [invoiceId]
    );

    return NextResponse.json({
      invoice: {
        ...invoice,
        lines: linesResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching sales invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales invoice', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/erp/finance/invoices/sales/[id]
 * Update invoice status or mark as sent
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update invoices' },
      { status: 403 }
    );
  }

  try {
    const { id: invoiceId } = await params;
    const body = await req.json();
    const { status, irnDetails } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);

      if (status === 'sent') {
        paramCount++;
        updates.push(`sent_at = $${paramCount}`);
        values.push(new Date());
      }
    }

    if (irnDetails) {
      // E-Invoice details
      paramCount++;
      updates.push(`irn = $${paramCount}`);
      values.push(irnDetails.irn);

      paramCount++;
      updates.push(`ack_number = $${paramCount}`);
      values.push(irnDetails.ackNumber);

      paramCount++;
      updates.push(`ack_date = $${paramCount}`);
      values.push(irnDetails.ackDate);

      paramCount++;
      updates.push(`qr_code = $${paramCount}`);
      values.push(irnDetails.qrCode);

      paramCount++;
      updates.push(`e_invoice_generated = $${paramCount}`);
      values.push(true);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);

    paramCount++;
    values.push(invoiceId);
    paramCount++;
    values.push(user.organizationId);

    const result = await pool.query(
      `UPDATE sales_invoices_gst 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount - 1} AND erp_organization_id = $${paramCount}
      RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Invoice updated successfully',
      invoice: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating sales invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update sales invoice', details: error.message },
      { status: 500 }
    );
  }
}
