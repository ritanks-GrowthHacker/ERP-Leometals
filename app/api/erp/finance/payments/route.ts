import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { customerPayments, paymentAllocations, customerInvoices } from '@/lib/db/schema/finance';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET: Fetch all customer payments
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

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');

    if (paymentId) {
      // Get single payment with details
      const payment = await erpDb.query.customerPayments.findFirst({
        where: and(
          eq(customerPayments.id, paymentId),
          eq(customerPayments.erpOrganizationId, organizationId)
        ),
        with: {
          customer: true,
          allocations: {
            with: {
              invoice: true,
            },
          },
          bankAccount: true,
        },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      return NextResponse.json({ payment }, { status: 200 });
    }

    // Get all payments
    const payments = await erpDb.query.customerPayments.findMany({
      where: eq(customerPayments.erpOrganizationId, organizationId),
      with: {
        customer: true,
      },
      orderBy: [desc(customerPayments.createdAt)],
    });

    return NextResponse.json({ payments }, { status: 200 });
  } catch (error) {
    console.error('Error fetching customer payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer payments' },
      { status: 500 }
    );
  }
}

// POST: Create new customer payment and allocate to invoices
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create payments' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;
    const userId = user.id;

    const body = await req.json();
    const {
      customerId,
      paymentDate,
      amount,
      currency,
      paymentMethod,
      referenceNumber,
      bankAccountId,
      notes,
      allocations, // Array of { invoiceId, amount }
    } = body;

    if (!customerId || !paymentDate || !amount) {
      return NextResponse.json(
        { error: 'Customer, payment date, and amount are required' },
        { status: 400 }
      );
    }

    // Generate payment number
    const payments = await erpDb.query.customerPayments.findMany({
      where: eq(customerPayments.erpOrganizationId, organizationId),
    });
    const count = payments.length + 1;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const paymentNumber = `PMT-${year}${month}-${String(count).padStart(5, '0')}`;

    // Create payment
    const [payment] = await erpDb.insert(customerPayments).values({
      erpOrganizationId: organizationId,
      paymentNumber,
      customerId,
      paymentDate,
      amount: amount.toString(),
      currency: currency || 'INR',
      paymentMethod,
      referenceNumber,
      bankAccountId: sanitizeUuid(bankAccountId),
      notes,
      createdBy: userId,
    }).returning();

    // Allocate payment to invoices
    if (allocations && allocations.length > 0) {
      const allocationData = allocations.map((alloc: any) => ({
        paymentId: payment.id,
        invoiceId: alloc.invoiceId,
        allocatedAmount: alloc.amount.toString(),
      }));

      await erpDb.insert(paymentAllocations).values(allocationData);

      // Update invoice amounts
      for (const alloc of allocations) {
        const invoice = await erpDb.query.customerInvoices.findFirst({
          where: eq(customerInvoices.id, alloc.invoiceId),
        });

        if (invoice) {
          const newPaidAmount = parseFloat(invoice.paidAmount || '0') + alloc.amount;
          const newOutstandingAmount = parseFloat(invoice.totalAmount) - newPaidAmount;
          
          let newStatus = invoice.status;
          if (newOutstandingAmount <= 0) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partially_paid';
          }

          await erpDb.update(customerInvoices)
            .set({
              paidAmount: newPaidAmount.toString(),
              outstandingAmount: newOutstandingAmount.toString(),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(customerInvoices.id, alloc.invoiceId));
        }
      }
    }

    return NextResponse.json(
      { message: 'Payment created successfully', payment },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating customer payment:', error);
    return NextResponse.json(
      { error: 'Failed to create customer payment' },
      { status: 500 }
    );
  }
}

// DELETE: Delete customer payment
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete payments' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Check if payment exists
    const payment = await erpDb.query.customerPayments.findFirst({
      where: and(
        eq(customerPayments.id, id),
        eq(customerPayments.erpOrganizationId, organizationId)
      ),
      with: {
        allocations: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Reverse invoice allocations
    if (payment.allocations) {
      for (const alloc of payment.allocations) {
        const invoice = await erpDb.query.customerInvoices.findFirst({
          where: eq(customerInvoices.id, alloc.invoiceId),
        });

        if (invoice) {
          const newPaidAmount = parseFloat(invoice.paidAmount || '0') - parseFloat(alloc.allocatedAmount);
          const newOutstandingAmount = parseFloat(invoice.totalAmount) - newPaidAmount;
          
          let newStatus = invoice.status;
          if (newPaidAmount <= 0) {
            newStatus = 'sent';
          } else {
            newStatus = 'partially_paid';
          }

          await erpDb.update(customerInvoices)
            .set({
              paidAmount: newPaidAmount.toString(),
              outstandingAmount: newOutstandingAmount.toString(),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(customerInvoices.id, alloc.invoiceId));
        }
      }
    }

    await erpDb.delete(customerPayments).where(eq(customerPayments.id, id));

    return NextResponse.json(
      { message: 'Payment deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting customer payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer payment' },
      { status: 500 }
    );
  }
}
