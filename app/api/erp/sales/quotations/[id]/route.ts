import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesQuotations, salesQuotationLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/sales/quotations/[id]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view quotations' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const quotationId = params.id;

    if (!quotationId) {
      return NextResponse.json(
        { error: 'Quotation ID is required' },
        { status: 400 }
      );
    }

    const quotation = await erpDb.query.salesQuotations.findFirst({
      where: and(
        eq(salesQuotations.id, quotationId),
        eq(salesQuotations.erpOrganizationId, user.organizationId)
      ),
      with: {
        customer: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(quotation);
  } catch (error: any) {
    logDatabaseError('Fetching quotation details', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/sales/quotations/[id]
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit quotations' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const quotationId = params.id;

    if (!quotationId) {
      return NextResponse.json(
        { error: 'Quotation ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      customerId,
      quotationDate,
      validUntil,
      paymentTerms,
      notes,
      items,
    } = body;

    // Check if quotation exists and belongs to organization
    const existingQuotation = await erpDb.query.salesQuotations.findFirst({
      where: and(
        eq(salesQuotations.id, quotationId),
        eq(salesQuotations.erpOrganizationId, user.organizationId)
      ),
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    // Only allow editing draft quotations
    if (existingQuotation.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotations can be edited' },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const lineItems = items || [];
    for (const line of lineItems) {
      const lineSubtotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
      const discount = lineSubtotal * (parseFloat(line.discount || 0) / 100);
      const afterDiscount = lineSubtotal - discount;
      subtotal += afterDiscount;
      const lineTax = afterDiscount * (parseFloat(line.taxRate || 0) / 100);
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Update quotation
    const [updatedQuotation] = await erpDb
      .update(salesQuotations)
      .set({
        customerId,
        quotationDate,
        validUntil: validUntil || null,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paymentTerms: paymentTerms || 30,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(salesQuotations.id, quotationId))
      .returning();

    // Delete existing lines and create new ones
    await erpDb
      .delete(salesQuotationLines)
      .where(eq(salesQuotationLines.salesQuotationId, quotationId));

    const quotationLines = await erpDb
      .insert(salesQuotationLines)
      .values(
        lineItems.map((line: any) => ({
          salesQuotationId: updatedQuotation.id,
          productId: line.productId,
          productVariantId: line.productVariantId || null,
          description: line.description || line.productName || null,
          quantity: line.quantity,
          uomId: line.uomId || null,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate || '0',
          discount: line.discount || '0',
          notes: line.notes || null,
        }))
      )
      .returning();

    return NextResponse.json({
      quotation: { ...updatedQuotation, lines: quotationLines },
    });
  } catch (error: any) {
    console.error('Error updating quotation:', error);
    logDatabaseError('Updating sales quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// DELETE /api/erp/sales/quotations/[id]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete quotations' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const quotationId = params.id;

    if (!quotationId) {
      return NextResponse.json(
        { error: 'Quotation ID is required' },
        { status: 400 }
      );
    }

    const existingQuotation = await erpDb.query.salesQuotations.findFirst({
      where: and(
        eq(salesQuotations.id, quotationId),
        eq(salesQuotations.erpOrganizationId, user.organizationId)
      ),
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    // Only allow deleting draft quotations
    if (existingQuotation.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotations can be deleted' },
        { status: 400 }
      );
    }

    await erpDb.delete(salesQuotations).where(eq(salesQuotations.id, quotationId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logDatabaseError('Deleting sales quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
