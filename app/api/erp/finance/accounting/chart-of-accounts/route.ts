import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/accounting/chart-of-accounts
 * Fetch Chart of Accounts hierarchy
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view chart of accounts' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const accountType = searchParams.get('accountType'); // 'asset', 'liability', 'equity', 'revenue', 'expense'
    const isActive = searchParams.get('isActive');

    let whereConditions = 'WHERE erp_organization_id = $1';
    const params: any[] = [user.organizationId];
    let paramCount = 1;

    if (accountType) {
      paramCount++;
      whereConditions += ` AND account_type = $${paramCount}`;
      params.push(accountType);
    }

    if (isActive !== null && isActive !== undefined) {
      paramCount++;
      whereConditions += ` AND is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }

    const result = await pool.query(
      `SELECT 
        coa.*,
        parent.account_name as parent_account_name
      FROM chart_of_accounts coa
      LEFT JOIN chart_of_accounts parent ON coa.parent_account_id = parent.id
      ${whereConditions}
      ORDER BY coa.account_type, coa.account_code`,
      params
    );

    return NextResponse.json({
      accounts: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching chart of accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart of accounts', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/accounting/chart-of-accounts
 * Create a new account
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
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
      accountCode,
      accountName,
      accountType,
      accountSubtype,
      parentAccountId,
      isGstAccount,
      gstAccountType,
      openingBalance,
      openingBalanceDate,
      description,
    } = body;

    if (!accountCode || !accountName || !accountType) {
      return NextResponse.json(
        { error: 'Missing required fields: accountCode, accountName, accountType' },
        { status: 400 }
      );
    }

    // Check for duplicate account code
    const duplicate = await pool.query(
      'SELECT id FROM chart_of_accounts WHERE erp_organization_id = $1 AND account_code = $2',
      [user.organizationId, accountCode]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { error: 'Account code already exists' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO chart_of_accounts (
        erp_organization_id, account_code, account_name, account_type, account_subtype,
        parent_account_id, is_gst_account, gst_account_type, opening_balance,
        opening_balance_date, description, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *`,
      [
        user.organizationId, accountCode, accountName, accountType, accountSubtype || null,
        parentAccountId || null, isGstAccount || false, gstAccountType || null,
        openingBalance || 0, openingBalanceDate || null, description || null
      ]
    );

    return NextResponse.json({
      message: 'Account created successfully',
      account: result.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/erp/finance/accounting/chart-of-accounts
 * Update an existing account
 */
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update accounts' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, accountName, accountSubtype, parentAccountId, isActive, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Check ownership and not system account
    const accountCheck = await pool.query(
      'SELECT is_system_account FROM chart_of_accounts WHERE id = $1 AND erp_organization_id = $2',
      [id, user.organizationId]
    );

    if (accountCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      );
    }

    if (accountCheck.rows[0].is_system_account) {
      return NextResponse.json(
        { error: 'Cannot modify system accounts' },
        { status: 403 }
      );
    }

    const result = await pool.query(
      `UPDATE chart_of_accounts SET
        account_name = COALESCE($1, account_name),
        account_subtype = COALESCE($2, account_subtype),
        parent_account_id = COALESCE($3, parent_account_id),
        is_active = COALESCE($4, is_active),
        description = COALESCE($5, description),
        updated_at = NOW()
      WHERE id = $6 AND erp_organization_id = $7
      RETURNING *`,
      [accountName, accountSubtype, parentAccountId, isActive, description, id, user.organizationId]
    );

    return NextResponse.json({
      message: 'Account updated successfully',
      account: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account', details: error.message },
      { status: 500 }
    );
  }
}
