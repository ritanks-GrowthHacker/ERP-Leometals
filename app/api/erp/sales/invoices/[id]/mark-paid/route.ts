import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesInvoices } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// POST /api/erp/sales/invoices/[id]/mark-paid
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update invoices' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const invoiceId = params.id;
    const body = await req.json();
    const { paidAmount } = body;

    // Update invoice status to paid
    const result = await erpDb
      .update(salesInvoices)
      .set({
        status: 'paid',
        paidAmount: paidAmount,
        balanceAmount: '0',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(salesInvoices.id, invoiceId),
          eq(salesInvoices.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Invoice marked as paid successfully',
      invoice: result[0]
    });
  } catch (error: any) {
    console.error('Error marking invoice as paid:', error);
    return NextResponse.json(
      { error: 'Failed to mark invoice as paid', message: error.message },
      { status: 500 }
    );
  }
}
