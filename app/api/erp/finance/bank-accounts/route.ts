import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { bankAccounts } from '@/lib/db/schema/finance';
import { eq, and } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Fetch all bank accounts
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

    const accounts = await erpDb.query.bankAccounts.findMany({
      where: eq(bankAccounts.erpOrganizationId, organizationId),
      with: {
        glAccount: true,
      },
    });

    return NextResponse.json({ bankAccounts: accounts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

// POST: Create new bank account
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create bank accounts' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const body = await req.json();
    const {
      accountName,
      bankName,
      accountNumber,
      accountType,
      currency,
      openingBalance,
      glAccountId,
      notes,
    } = body;

    if (!accountName || !bankName || !accountNumber) {
      return NextResponse.json(
        { error: 'Account name, bank name, and account number are required' },
        { status: 400 }
      );
    }

    const [account] = await erpDb.insert(bankAccounts).values({
      erpOrganizationId: organizationId,
      accountName,
      bankName,
      accountNumber,
      accountType: accountType || null,
      currency: currency || 'INR',
      openingBalance: openingBalance ? openingBalance.toString() : '0',
      currentBalance: openingBalance ? openingBalance.toString() : '0',
      glAccountId: glAccountId || null,
      notes,
    }).returning();

    return NextResponse.json(
      { message: 'Bank account created successfully', bankAccount: account },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json(
      { error: 'Failed to create bank account' },
      { status: 500 }
    );
  }
}

// PUT: Update bank account
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit bank accounts' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const body = await req.json();
    const { id, accountName, isActive, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Bank account ID is required' }, { status: 400 });
    }

    // Check if account exists
    const account = await erpDb.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.erpOrganizationId, organizationId)
      ),
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    await erpDb.update(bankAccounts)
      .set({
        accountName: accountName || account.accountName,
        isActive: isActive !== undefined ? isActive : account.isActive,
        notes: notes !== undefined ? notes : account.notes,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id));

    return NextResponse.json(
      { message: 'Bank account updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json(
      { error: 'Failed to update bank account' },
      { status: 500 }
    );
  }
}

// DELETE: Delete bank account
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete bank accounts' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bank account ID is required' }, { status: 400 });
    }

    // Check if account exists
    const account = await erpDb.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.erpOrganizationId, organizationId)
      ),
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    await erpDb.delete(bankAccounts).where(eq(bankAccounts.id, id));

    return NextResponse.json(
      { message: 'Bank account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank account' },
      { status: 500 }
    );
  }
}
