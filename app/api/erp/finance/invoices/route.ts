import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { customerInvoices, customerInvoiceLines } from '@/lib/db/schema/finance';
import { eq, and, desc } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { generateInvoiceFromSalesOrder, sendInvoiceEmail } from '@/lib/financeAutomation';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET: Fetch all customer invoices
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
    const invoiceId = searchParams.get('id');

    if (invoiceId) {
      // Get single invoice with details
      const invoice = await erpDb.query.customerInvoices.findFirst({
        where: and(
          eq(customerInvoices.id, invoiceId),
          eq(customerInvoices.erpOrganizationId, organizationId)
        ),
        with: {
          customer: true,
          lines: {
            with: {
              product: true,
            },
          },
          salesOrder: true,
          paymentAllocations: {
            with: {
              payment: true,
            },
          },
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json({ invoice }, { status: 200 });
    }

    // Get all invoices
    const invoices = await erpDb.query.customerInvoices.findMany({
      where: eq(customerInvoices.erpOrganizationId, organizationId),
      with: {
        customer: true,
      },
      orderBy: [desc(customerInvoices.createdAt)],
    });

    return NextResponse.json({ invoices }, { status: 200 });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST: Create new invoice or generate from sales order
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create invoices' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;
    const userId = user.id;

    const body = await req.json();

    // Check if generating from sales order
    if (body.salesOrderId && body.autoGenerate) {
      const result = await generateInvoiceFromSalesOrder(
        body.salesOrderId,
        organizationId,
        userId
      );
      return NextResponse.json(result, { status: result.success ? 201 : 400 });
    }

    // Manual invoice creation
    const {
      customerId,
      invoiceDate,
      dueDate,
      paymentTerms,
      currency,
      lines,
      notes,
      termsAndConditions,
    } = body;

    if (!customerId || !invoiceDate || !dueDate || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Customer, dates, and at least one line item are required' },
        { status: 400 }
      );
    }

    // Generate invoice number
    const invoices = await erpDb.query.customerInvoices.findMany({
      where: eq(customerInvoices.erpOrganizationId, organizationId),
    });
    const count = invoices.length + 1;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const invoiceNumber = `INV-${year}${month}-${String(count).padStart(5, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const lineTotal = line.quantity * line.unitPrice;
      const lineTax = lineTotal * (line.taxRate || 0) / 100;
      const discount = lineTotal * (line.discountPercent || 0) / 100;
      
      subtotal += lineTotal - discount;
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const [invoice] = await erpDb.insert(customerInvoices).values({
      erpOrganizationId: organizationId,
      invoiceNumber,
      customerId,
      invoiceDate,
      dueDate,
      paymentTerms: paymentTerms || 'Net 30',
      currency: currency || 'INR',
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: '0',
      totalAmount: totalAmount.toString(),
      paidAmount: '0',
      outstandingAmount: totalAmount.toString(),
      status: 'draft',
      notes,
      termsAndConditions,
      createdBy: userId,
    }).returning();

    // Insert lines
    const linesToInsert = lines.map((line: any) => ({
      invoiceId: invoice.id,
      productId: sanitizeUuid(line.productId),
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: (line.discountPercent || 0).toString(),
      discountAmount: ((line.quantity * line.unitPrice * (line.discountPercent || 0)) / 100).toString(),
      taxRate: (line.taxRate || 0).toString(),
      taxAmount: ((line.quantity * line.unitPrice * (line.taxRate || 0)) / 100).toString(),
      lineTotal: (line.quantity * line.unitPrice * (1 + (line.taxRate || 0) / 100) * (1 - (line.discountPercent || 0) / 100)).toString(),
      accountId: sanitizeUuid(line.accountId),
    }));

    await erpDb.insert(customerInvoiceLines).values(linesToInsert);

    return NextResponse.json(
      { message: 'Invoice created successfully', invoice },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

// PUT: Update invoice
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit invoices' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const body = await req.json();
    const { id, status, notes, termsAndConditions } = body;

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Check if invoice exists
    const invoice = await erpDb.query.customerInvoices.findFirst({
      where: and(
        eq(customerInvoices.id, id),
        eq(customerInvoices.erpOrganizationId, organizationId)
      ),
      with: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Update invoice
    await erpDb.update(customerInvoices)
      .set({
        status: status || invoice.status,
        notes: notes !== undefined ? notes : invoice.notes,
        termsAndConditions: termsAndConditions !== undefined ? termsAndConditions : invoice.termsAndConditions,
        updatedAt: new Date(),
      })
      .where(eq(customerInvoices.id, id));

    // If status changed to 'sent', send email
    if (status === 'sent' && invoice.status !== 'sent') {
      await sendInvoiceEmail(id, invoice.customer);
    }

    return NextResponse.json(
      { message: 'Invoice updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// DELETE: Delete invoice
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete invoices' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Check if invoice exists
    const invoice = await erpDb.query.customerInvoices.findFirst({
      where: and(
        eq(customerInvoices.id, id),
        eq(customerInvoices.erpOrganizationId, organizationId)
      ),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted' },
        { status: 400 }
      );
    }

    await erpDb.delete(customerInvoices).where(eq(customerInvoices.id, id));

    return NextResponse.json(
      { message: 'Invoice deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
