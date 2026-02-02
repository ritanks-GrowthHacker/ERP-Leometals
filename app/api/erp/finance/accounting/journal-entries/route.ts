import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * GET /api/erp/finance/accounting/journal-entries
 * Fetch journal entries with filters
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const journalType = searchParams.get('journalType');
    const fiscalYear = searchParams.get('fiscalYear');
    const offset = (page - 1) * limit;

    let whereConditions = 'WHERE je.erp_organization_id = $1';
    const params: any[] = [user.organizationId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions += ` AND je.status = $${paramCount}`;
      params.push(status);
    }

    if (journalType) {
      paramCount++;
      whereConditions += ` AND je.journal_type = $${paramCount}`;
      params.push(journalType);
    }

    if (fiscalYear) {
      paramCount++;
      whereConditions += ` AND je.fiscal_year = $${paramCount}`;
      params.push(parseInt(fiscalYear));
    }

    const result = await pool.query(
      `SELECT 
        je.*,
        COUNT(gl.id) as line_count
      FROM journal_entries je
      LEFT JOIN general_ledger gl ON je.id = gl.journal_entry_id
      ${whereConditions}
      GROUP BY je.id
      ORDER BY je.transaction_date DESC, je.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM journal_entries je ${whereConditions}`,
      params
    );

    return NextResponse.json({
      journalEntries: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entries', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erp/finance/accounting/journal-entries
 * Create a new journal entry with GL postings
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create journal entries' },
      { status: 403 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const body = await req.json();
    const {
      journal_type,
      transaction_date,
      reference_number,
      narration,
      lines, // Array of { account_id, description, debit_amount, credit_amount }
      total_debit,
      total_credit,
    } = body;

    if (!transaction_date || !narration || !lines || lines.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Missing required fields: transaction_date, narration, lines' },
        { status: 400 }
      );
    }

    // Calculate fiscal year and period from transaction date
    const txDate = new Date(transaction_date);
    const month = txDate.getMonth() + 1; // 1-12
    const year = txDate.getFullYear();
    
    // Fiscal year: Apr-Mar (e.g., Apr 2025 - Mar 2026 = 2025)
    // Store the starting year of the fiscal period
    let fiscalYear: number;
    let fiscalPeriod: number;
    
    if (month >= 4) {
      fiscalYear = year; // Apr 2025 - Mar 2026 = 2025
      fiscalPeriod = month - 3; // Apr=1, May=2, ..., Dec=9
    } else {
      fiscalYear = year - 1; // Jan 2026 - Mar 2026 = 2025
      fiscalPeriod = month + 9; // Jan=10, Feb=11, Mar=12
    }
    
    console.log('📅 Fiscal Calculation Debug:');
    console.log('Transaction Date:', transaction_date);
    console.log('Month:', month, 'Year:', year);
    console.log('Fiscal Year:', fiscalYear, 'Type:', typeof fiscalYear);
    console.log('Fiscal Period:', fiscalPeriod, 'Type:', typeof fiscalPeriod);

    // Validate double-entry: Total Debit = Total Credit
    const calculatedDebit = lines.reduce((sum: number, line: any) => sum + parseFloat(line.debit_amount || 0), 0);
    const calculatedCredit = lines.reduce((sum: number, line: any) => sum + parseFloat(line.credit_amount || 0), 0);

    if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Journal entry not balanced. Debit: ${calculatedDebit}, Credit: ${calculatedCredit}` },
        { status: 400 }
      );
    }

    // Generate journal number
    const journalNumber = await generateJournalNumber(client, user.organizationId, fiscalYear);

    // Insert journal entry header
    const jeResult = await client.query(
      `INSERT INTO journal_entries (
        erp_organization_id, journal_number, journal_type, transaction_date, posting_date,
        reference_type, reference_id, reference_number, narration, total_debit, total_credit,
        status, fiscal_year, fiscal_period, is_auto_generated, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13, false, $14)
      RETURNING *`,
      [
        user.organizationId,
        journalNumber,
        journal_type || 'general',
        transaction_date,
        transaction_date, // posting_date same as transaction_date
        null, // reference_type
        null, // reference_id
        reference_number || null,
        narration,
        total_debit || calculatedDebit,
        total_credit || calculatedCredit,
        fiscalYear,
        fiscalPeriod,
        user.id
      ]
    );

    const journalEntry = jeResult.rows[0];

    // Insert general ledger entries
    for (const line of lines) {
      const debit = parseFloat(line.debit_amount || 0);
      const credit = parseFloat(line.credit_amount || 0);
      
      // Skip lines with no amounts
      if (debit === 0 && credit === 0) continue;
      
      await client.query(
        `INSERT INTO general_ledger (
          erp_organization_id, journal_entry_id, account_id, transaction_date, posting_date,
          description, debit_amount, credit_amount, fiscal_year, fiscal_period
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.organizationId,
          journalEntry.id,
          line.account_id,
          transaction_date,
          transaction_date,
          line.description || narration,
          debit,
          credit,
          fiscalYear,
          fiscalPeriod
        ]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Journal entry created successfully',
      journalEntry: journalEntry,
    }, { status: 201 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to create journal entry', details: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

async function generateJournalNumber(client: any, organizationId: string, fiscalYear: number): Promise<string> {
  const result = await client.query(
    `SELECT journal_number FROM journal_entries 
    WHERE erp_organization_id = $1 AND fiscal_year = $2 
    ORDER BY created_at DESC LIMIT 1`,
    [organizationId, fiscalYear]
  );

  if (result.rows.length === 0) {
    return `JE/${fiscalYear}/0001`;
  }

  const lastNumber = result.rows[0].journal_number;
  const match = lastNumber.match(/(\d+)$/);
  if (match) {
    const nextNumber = parseInt(match[1]) + 1;
    return `JE/${fiscalYear}/${String(nextNumber).padStart(4, '0')}`;
  }

  return `JE/${fiscalYear}/0001`;
}