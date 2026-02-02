import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/master/indian-states
 * Get list of all Indian states for dropdowns
 * Public endpoint (no auth required for master data)
 */
export async function GET(req: NextRequest) {
  try {
    const result = await pool.query(
      `SELECT * FROM indian_states ORDER BY state_name ASC`
    );

    return NextResponse.json({
      states: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching Indian states:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Indian states', details: error.message },
      { status: 500 }
    );
  }
}
