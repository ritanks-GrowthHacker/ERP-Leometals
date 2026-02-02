import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/gst/rates
 * Get all GST rates for the organization
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');

    let whereConditions = 'WHERE erp_organization_id = $1';
    const params: any[] = [user.organizationId];

    if (isActive !== null && isActive !== undefined) {
      whereConditions += ' AND is_active = $2';
      params.push(isActive === 'true');
    }

    const result = await pool.query(
      `SELECT * FROM gst_rates ${whereConditions} ORDER BY igst_rate ASC, created_at DESC`,
      params
    );

    return NextResponse.json({
      rates: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching GST rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GST rates', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/gst/rates
 * Create a new GST rate configuration
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create GST rates' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { rateName, cgstRate, sgstRate, igstRate, cessRate, effectiveFrom, effectiveTo, description } = body;

    if (!rateName || cgstRate === undefined || sgstRate === undefined || igstRate === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: rateName, cgstRate, sgstRate, igstRate' },
        { status: 400 }
      );
    }

    // Validate: CGST + SGST = IGST
    if (Math.abs((cgstRate + sgstRate) - igstRate) > 0.01) {
      return NextResponse.json(
        { error: 'Invalid GST rates. CGST + SGST must equal IGST' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO gst_rates (
        erp_organization_id, rate_name, cgst_rate, sgst_rate, igst_rate, cess_rate,
        effective_from, effective_to, description, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        user.organizationId, rateName, cgstRate, sgstRate, igstRate, cessRate || 0,
        effectiveFrom, effectiveTo || null, description || null
      ]
    );

    return NextResponse.json({
      message: 'GST rate created successfully',
      rate: result.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating GST rate:', error);
    return NextResponse.json(
      { error: 'Failed to create GST rate', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/erp/finance/gst/rates
 * Update existing GST rate
 */
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update GST rates' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, rateName, effectiveTo, isActive, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Rate ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE gst_rates SET
        rate_name = COALESCE($1, rate_name),
        effective_to = COALESCE($2, effective_to),
        is_active = COALESCE($3, is_active),
        description = COALESCE($4, description),
        updated_at = NOW()
      WHERE id = $5 AND erp_organization_id = $6
      RETURNING *`,
      [rateName, effectiveTo, isActive, description, id, user.organizationId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'GST rate not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'GST rate updated successfully',
      rate: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating GST rate:', error);
    return NextResponse.json(
      { error: 'Failed to update GST rate', details: error.message },
      { status: 500 }
    );
  }
}
