import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view accounts' },
      { status: 403 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT * FROM chart_of_accounts 
       WHERE erp_organization_id = $1 
       ORDER BY account_code ASC`,
      [user.organizationId]
    );

    console.log('📚 Chart of Accounts Query:');
    console.log('Organization ID:', user.organizationId);
    console.log('Accounts Found:', result.rows.length);
    console.log('Accounts:', result.rows);

    return NextResponse.json({ accounts: result.rows });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create accounts' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      account_code,
      account_name,
      account_type,
      account_subtype,
      parent_account_id,
      is_gst_account,
      gst_account_type,
      opening_balance,
      opening_balance_date,
      description,
    } = body;

    // Validate required fields
    if (!account_code || !account_name || !account_type) {
      return NextResponse.json(
        { error: 'Missing required fields: account_code, account_name, account_type' },
        { status: 400 }
      );
    }

    // Check if account code already exists
    const existingAccount = await pool.query(
      'SELECT id FROM chart_of_accounts WHERE erp_organization_id = $1 AND account_code = $2',
      [user.organizationId, account_code]
    );

    if (existingAccount.rows.length > 0) {
      return NextResponse.json(
        { error: 'Account code already exists' },
        { status: 400 }
      );
    }

    // Insert new account
    const result = await pool.query(
      `INSERT INTO chart_of_accounts (
        erp_organization_id, account_code, account_name, account_type,
        account_subtype, parent_account_id, is_gst_account, gst_account_type,
        opening_balance, opening_balance_date, description, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *`,
      [
        user.organizationId,
        account_code,
        account_name,
        account_type,
        account_subtype || null,
        parent_account_id || null,
        is_gst_account || false,
        gst_account_type || null,
        opening_balance || 0,
        opening_balance_date || null,
        description || null,
      ]
    );

    return NextResponse.json({
      success: true,
      account: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account', details: error.message },
      { status: 500 }
    );
  }
}
