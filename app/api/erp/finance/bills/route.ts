import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { vendorBills, vendorBillLines } from '@/lib/db/schema/finance';
import { eq, and, desc } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET: Fetch all vendor bills
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
    const billId = searchParams.get('id');

    if (billId) {
      // Get single bill with details
      const bill = await erpDb.query.vendorBills.findFirst({
        where: and(
          eq(vendorBills.id, billId),
          eq(vendorBills.erpOrganizationId, organizationId)
        ),
        with: {
          supplier: true,
          lines: {
            with: {
              product: true,
            },
          },
          purchaseOrder: true,
          paymentAllocations: {
            with: {
              payment: true,
            },
          },
        },
      });

      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      }

      return NextResponse.json({ bill }, { status: 200 });
    }

    // Get all bills
    const bills = await erpDb.query.vendorBills.findMany({
      where: eq(vendorBills.erpOrganizationId, organizationId),
      with: {
        supplier: true,
      },
      orderBy: [desc(vendorBills.createdAt)],
    });

    return NextResponse.json({ bills }, { status: 200 });
  } catch (error) {
    console.error('Error fetching vendor bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor bills' },
      { status: 500 }
    );
  }
}

// POST: Create new vendor bill
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create bills' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;
    const userId = user.id;

    const body = await req.json();
    const {
      supplierId,
      vendorBillNumber,
      purchaseOrderId,
      billDate,
      dueDate,
      paymentTerms,
      currency,
      lines,
      notes,
    } = body;

    if (!supplierId || !billDate || !dueDate || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Supplier, dates, and at least one line item are required' },
        { status: 400 }
      );
    }

    // Generate bill number
    const bills = await erpDb.query.vendorBills.findMany({
      where: eq(vendorBills.erpOrganizationId, organizationId),
    });
    const count = bills.length + 1;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const billNumber = `BILL-${year}${month}-${String(count).padStart(5, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const lineTotal = line.quantity * line.unitPrice;
      const lineTax = lineTotal * (line.taxRate || 0) / 100;
      
      subtotal += lineTotal;
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Create bill
    const [bill] = await erpDb.insert(vendorBills).values({
      erpOrganizationId: organizationId,
      billNumber,
      vendorBillNumber: vendorBillNumber || null,
      supplierId,
      purchaseOrderId: sanitizeUuid(purchaseOrderId),
      billDate,
      dueDate,
      paymentTerms: paymentTerms || 'Net 30',
      currency: currency || 'INR',
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: '0',
      outstandingAmount: totalAmount.toString(),
      status: 'draft',
      notes,
      createdBy: userId,
    }).returning();

    // Insert lines
    const linesToInsert = lines.map((line: any) => ({
      billId: bill.id,
      productId: sanitizeUuid(line.productId),
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      taxRate: (line.taxRate || 0).toString(),
      taxAmount: ((line.quantity * line.unitPrice * (line.taxRate || 0)) / 100).toString(),
      lineTotal: (line.quantity * line.unitPrice * (1 + (line.taxRate || 0) / 100)).toString(),
      accountId: sanitizeUuid(line.accountId),
    }));

    await erpDb.insert(vendorBillLines).values(linesToInsert);

    return NextResponse.json(
      { message: 'Vendor bill created successfully', bill },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating vendor bill:', error);
    return NextResponse.json(
      { error: 'Failed to create vendor bill' },
      { status: 500 }
    );
  }
}

// PUT: Update vendor bill
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit bills' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;
    const userId = user.id;

    const body = await req.json();
    const { id, status, notes, approve } = body;

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    // Check if bill exists
    const bill = await erpDb.query.vendorBills.findFirst({
      where: and(
        eq(vendorBills.id, id),
        eq(vendorBills.erpOrganizationId, organizationId)
      ),
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (approve && bill.status === 'draft') {
      updateData.status = 'approved';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    await erpDb.update(vendorBills)
      .set(updateData)
      .where(eq(vendorBills.id, id));

    return NextResponse.json(
      { message: 'Vendor bill updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating vendor bill:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor bill' },
      { status: 500 }
    );
  }
}

// DELETE: Delete vendor bill
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete bills' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    // Check if bill exists
    const bill = await erpDb.query.vendorBills.findFirst({
      where: and(
        eq(vendorBills.id, id),
        eq(vendorBills.erpOrganizationId, organizationId)
      ),
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Only allow deletion of draft bills
    if (bill.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft bills can be deleted' },
        { status: 400 }
      );
    }

    await erpDb.delete(vendorBills).where(eq(vendorBills.id, id));

    return NextResponse.json(
      { message: 'Vendor bill deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting vendor bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor bill' },
      { status: 500 }
    );
  }
}
