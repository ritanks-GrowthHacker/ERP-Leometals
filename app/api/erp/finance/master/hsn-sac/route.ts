import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/master/hsn-sac
 * Search HSN/SAC codes
 * Query params: search, type ('HSN' or 'SAC'), limit
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type'); // 'HSN' or 'SAC'
    const limit = parseInt(searchParams.get('limit') || '50');

    let whereConditions = 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions += ` AND (code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (type) {
      paramCount++;
      whereConditions += ` AND code_type = $${paramCount}`;
      params.push(type);
    }

    const result = await pool.query(
      `SELECT * FROM hsn_sac_codes ${whereConditions} ORDER BY code ASC LIMIT $${paramCount + 1}`,
      [...params, limit]
    );

    return NextResponse.json({
      codes: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching HSN/SAC codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HSN/SAC codes', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/master/hsn-sac
 * Create new HSN/SAC code
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create HSN/SAC codes' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { codeType, code, description, uqc, defaultGstRate } = body;

    if (!codeType || !code || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: codeType, code, description' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO hsn_sac_codes (code_type, code, description, uqc, default_gst_rate, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *`,
      [codeType, code, description, uqc || null, defaultGstRate || 0]
    );

    return NextResponse.json({
      message: 'HSN/SAC code created successfully',
      code: result.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating HSN/SAC code:', error);
    return NextResponse.json(
      { error: 'Failed to create HSN/SAC code', details: error.message },
      { status: 500 }
    );
  }
}
