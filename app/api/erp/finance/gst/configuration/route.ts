import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// Use raw PostgreSQL connection for new finance tables
const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/gst/configuration
 * Fetch all GST configurations (GSTINs) for the organization
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view GST configuration' },
      { status: 403 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT 
        gc.*,
        s.state_name,
        s.tin_code
      FROM gst_configuration gc
      LEFT JOIN indian_states s ON gc.state_code = s.state_code
      WHERE gc.erp_organization_id = $1
      ORDER BY gc.is_primary DESC, gc.created_at DESC`,
      [user.organizationId]
    );

    return NextResponse.json({
      configurations: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching GST configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GST configuration', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/gst/configuration
 * Create a new GSTIN for the organization
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create GST configuration' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      gstin,
      legalName,
      legal_name,
      tradeName,
      trade_name,
      stateCode,
      state_code,
      registrationDate,
      registration_date,
      gstType,
      gst_type,
      compositionScheme,
      composition_scheme,
      annualTurnover,
      annual_turnover,
      isActive,
      is_active,
      isPrimary,
      is_primary,
    } = body;

    // Support both camelCase and snake_case from frontend
    const finalLegalName = legalName || legal_name;
    const finalTradeName = tradeName || trade_name;
    const finalStateCode = stateCode || state_code;
    const finalRegistrationDate = registrationDate || registration_date;
    const finalGstType = gstType || gst_type || 'regular';
    const finalCompositionScheme = compositionScheme !== undefined ? compositionScheme : (composition_scheme || false);
    const finalAnnualTurnover = annualTurnover || annual_turnover;
    const finalIsActive = isActive !== undefined ? isActive : (is_active !== undefined ? is_active : true);
    const finalIsPrimary = isPrimary !== undefined ? isPrimary : (is_primary || false);

    // Validate required fields
    if (!gstin || !gstin.trim()) {
      return NextResponse.json(
        { error: 'GSTIN is required' },
        { status: 400 }
      );
    }

    if (!finalLegalName || !finalLegalName.trim()) {
      return NextResponse.json(
        { error: 'Legal name is required' },
        { status: 400 }
      );
    }

    if (!finalStateCode || !finalStateCode.trim()) {
      return NextResponse.json(
        { error: 'State code is required' },
        { status: 400 }
      );
    }

    if (!finalRegistrationDate) {
      return NextResponse.json(
        { error: 'Registration date is required' },
        { status: 400 }
      );
    }

    // Validate GSTIN format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin)) {
      return NextResponse.json(
        { error: 'Invalid GSTIN format. Must be 15 characters (e.g., 27AABCU9603R1ZM)' },
        { status: 400 }
      );
    }

    // Check if GSTIN already exists
    const existingCheck = await pool.query(
      'SELECT id FROM gst_configuration WHERE gstin = $1',
      [gstin]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'GSTIN already registered in the system' },
        { status: 400 }
      );
    }

    // If this is primary, unset other primary GSTINs
    if (finalIsPrimary) {
      await pool.query(
        'UPDATE gst_configuration SET is_primary = false WHERE erp_organization_id = $1',
        [user.organizationId]
      );
    }

    const result = await pool.query(
      `INSERT INTO gst_configuration (
        erp_organization_id,
        gstin,
        legal_name,
        trade_name,
        state_code,
        registration_date,
        gst_type,
        composition_scheme,
        annual_turnover,
        is_active,
        is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        user.organizationId,
        gstin.toUpperCase(),
        finalLegalName,
        finalTradeName || null,
        finalStateCode,
        finalRegistrationDate,
        finalGstType,
        finalCompositionScheme,
        finalAnnualTurnover || null,
        finalIsActive,
        finalIsPrimary,
      ]
    );

    return NextResponse.json({
      message: 'GST configuration created successfully',
      configuration: result.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating GST configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create GST configuration', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/erp/finance/gst/configuration
 * Update existing GSTIN configuration
 */
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update GST configuration' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      id,
      legalName,
      legal_name,
      tradeName,
      trade_name,
      gstType,
      gst_type,
      compositionScheme,
      composition_scheme,
      annualTurnover,
      annual_turnover,
      isActive,
      is_active,
      isPrimary,
      is_primary,
    } = body;

    // Support both camelCase and snake_case
    const finalLegalName = legalName || legal_name;
    const finalTradeName = tradeName || trade_name;
    const finalGstType = gstType || gst_type;
    const finalCompositionScheme = compositionScheme !== undefined ? compositionScheme : composition_scheme;
    const finalAnnualTurnover = annualTurnover || annual_turnover;
    const finalIsActive = isActive !== undefined ? isActive : is_active;
    const finalIsPrimary = isPrimary !== undefined ? isPrimary : is_primary;

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT id FROM gst_configuration WHERE id = $1 AND erp_organization_id = $2',
      [id, user.organizationId]
    );

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'GST configuration not found or access denied' },
        { status: 404 }
      );
    }

    // If setting as primary, unset others
    if (finalIsPrimary) {
      await pool.query(
        'UPDATE gst_configuration SET is_primary = false WHERE erp_organization_id = $1 AND id != $2',
        [user.organizationId, id]
      );
    }

    const result = await pool.query(
      `UPDATE gst_configuration SET
        legal_name = COALESCE($1, legal_name),
        trade_name = $2,
        gst_type = COALESCE($3, gst_type),
        composition_scheme = COALESCE($4, composition_scheme),
        annual_turnover = $5,
        is_active = COALESCE($6, is_active),
        is_primary = COALESCE($7, is_primary),
        updated_at = NOW()
      WHERE id = $8 AND erp_organization_id = $9
      RETURNING *`,
      [
        finalLegalName,
        finalTradeName,
        finalGstType,
        finalCompositionScheme,
        finalAnnualTurnover,
        finalIsActive,
        finalIsPrimary,
        id,
        user.organizationId,
      ]
    );

    return NextResponse.json({
      message: 'GST configuration updated successfully',
      configuration: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating GST configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update GST configuration', details: error.message },
      { status: 500 }
    );
  }
}
