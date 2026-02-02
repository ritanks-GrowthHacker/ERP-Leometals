import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { chartOfAccounts } from '@/lib/db/schema/finance';
import { eq, and } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET: Fetch all chart of accounts
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view finance' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const accounts = await erpDb.query.chartOfAccounts.findMany({
      where: eq(chartOfAccounts.erpOrganizationId, organizationId),
      orderBy: (accounts, { asc }) => [asc(accounts.accountCode)],
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart of accounts' },
      { status: 500 }
    );
  }
}

// POST: Create new account
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create finance records' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const body = await req.json();
    const {
      accountCode,
      accountName,
      accountType,
      accountSubtype,
      parentAccountId,
      currency,
      description,
    } = body;

    if (!accountCode || !accountName || !accountType) {
      return NextResponse.json(
        { error: 'Account code, name, and type are required' },
        { status: 400 }
      );
    }

    // Check if account code already exists
    const existing = await erpDb.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.erpOrganizationId, organizationId),
        eq(chartOfAccounts.accountCode, accountCode)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Account code already exists' },
        { status: 400 }
      );
    }

    const [account] = await erpDb.insert(chartOfAccounts).values({
      erpOrganizationId: organizationId,
      accountCode,
      accountName,
      accountType,
      accountSubtype,
      parentAccountId: sanitizeUuid(parentAccountId),
      currency: currency || 'INR',
      description,
    }).returning();

    return NextResponse.json(
      { message: 'Account created successfully', account },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

// PUT: Update account
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit finance records' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const body = await req.json();
    const {
      id,
      accountName,
      accountType,
      accountSubtype,
      parentAccountId,
      isActive,
      description,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Check if account exists and belongs to organization
    const account = await erpDb.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.erpOrganizationId, organizationId)
      ),
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.isSystemAccount) {
      return NextResponse.json(
        { error: 'Cannot modify system account' },
        { status: 400 }
      );
    }

    await erpDb.update(chartOfAccounts)
      .set({
        accountName: accountName || account.accountName,
        accountType: accountType || account.accountType,
        accountSubtype: accountSubtype || account.accountSubtype,
        parentAccountId: parentAccountId !== undefined ? parentAccountId : account.parentAccountId,
        isActive: isActive !== undefined ? isActive : account.isActive,
        description: description !== undefined ? description : account.description,
        updatedAt: new Date(),
      })
      .where(eq(chartOfAccounts.id, id));

    return NextResponse.json(
      { message: 'Account updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

// DELETE: Delete account
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete finance records' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Check if account exists and belongs to organization
    const account = await erpDb.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.erpOrganizationId, organizationId)
      ),
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.isSystemAccount) {
      return NextResponse.json(
        { error: 'Cannot delete system account' },
        { status: 400 }
      );
    }

    await erpDb.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
