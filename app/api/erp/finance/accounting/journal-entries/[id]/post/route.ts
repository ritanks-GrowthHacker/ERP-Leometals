import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireErpAccess, hasPermission } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

/**
 * PUT /api/erp/finance/accounting/journal-entries/[id]/post
 * Post a draft journal entry (make it permanent)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to post journal entries' },
      { status: 403 }
    );
  }

  try {
    const { id: journalId } = await params;

    // Check ownership and status
    const jeCheck = await pool.query(
      'SELECT status FROM journal_entries WHERE id = $1 AND erp_organization_id = $2',
      [journalId, user.organizationId]
    );

    if (jeCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    if (jeCheck.rows[0].status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft journal entries can be posted' },
        { status: 400 }
      );
    }

    // Update to posted
    const result = await pool.query(
      `UPDATE journal_entries SET
        status = 'posted',
        posted_by = $1,
        posted_at = NOW(),
        updated_at = NOW()
      WHERE id = $2 AND erp_organization_id = $3
      RETURNING *`,
      [user.id, journalId, user.organizationId]
    );

    return NextResponse.json({
      message: 'Journal entry posted successfully',
      journalEntry: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to post journal entry', details: error.message },
      { status: 500 }
    );
  }
}
