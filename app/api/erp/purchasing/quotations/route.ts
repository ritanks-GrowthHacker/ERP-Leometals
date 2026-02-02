import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { supplierQuotations, quotationLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/purchasing/quotations
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view quotations' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const rfqId = searchParams.get('rfqId');

    const conditions = [eq(supplierQuotations.erpOrganizationId, user.erpOrganizationId)];
    
    if (status) {
      conditions.push(eq(supplierQuotations.status, status));
    }
    
    if (rfqId) {
      conditions.push(eq(supplierQuotations.rfqId, rfqId));
    }

    const quotations = await erpDb.query.supplierQuotations.findMany({
      where: and(...conditions),
      with: {
        supplier: true,
        rfq: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(supplierQuotations.createdAt)],
    });

    return NextResponse.json({ quotations });
  } catch (error: any) {
    logDatabaseError('Fetching quotations', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/purchasing/quotations
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create quotations' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      rfqId,
      supplierId,
      quotationDate,
      validUntil,
      paymentTerms,
      deliveryTime,
      shippingCharges,
      discountAmount,
      notes,
      lines,
    } = body;

    if (!supplierId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate quotation number with retry logic
    let quotationNumber = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const lastQuotation = await erpDb.query.supplierQuotations.findFirst({
        where: eq(supplierQuotations.erpOrganizationId, user.erpOrganizationId),
        orderBy: [desc(supplierQuotations.quotationNumber)],
      });

      const lastNum = lastQuotation ? parseInt((lastQuotation as any).quotationNumber.split('-')[1]) : 0;
      quotationNumber = `QT-${String(lastNum + 1).padStart(6, '0')}`;
      
      // Check if exists
      const existing = await erpDb.query.supplierQuotations.findFirst({
        where: and(
          eq(supplierQuotations.erpOrganizationId, user.erpOrganizationId),
          eq(supplierQuotations.quotationNumber, quotationNumber)
        ),
      });
      
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique quotation number' }, { status: 500 });
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      const discount = parseFloat(line.discountPercentage || 0);
      const tax = parseFloat(line.taxRate || 0);
      
      const lineSubtotal = qty * price * (1 - discount / 100);
      const lineTax = lineSubtotal * (tax / 100);
      
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    const shipping = parseFloat(shippingCharges || 0);
    const discount = parseFloat(discountAmount || 0);
    const totalAmount = subtotal + taxAmount + shipping - discount;

    // Create quotation
    const [newQuotation] = await erpDb.insert(supplierQuotations).values({
      erpOrganizationId: user.erpOrganizationId,
      rfqId: sanitizeUuid(rfqId),
      supplierId,
      quotationNumber,
      quotationDate,
      validUntil,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      shippingCharges: shipping.toString(),
      discountAmount: discount.toString(),
      totalAmount: totalAmount.toString(),
      paymentTerms,
      deliveryTime,
      notes,
      createdBy: user.id,
    }).returning();

    // Create quotation lines
    for (const line of lines) {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      const discount = parseFloat(line.discountPercentage || 0);
      const tax = parseFloat(line.taxRate || 0);
      
      const lineSubtotal = qty * price * (1 - discount / 100);
      const lineTotal = lineSubtotal * (1 + tax / 100);

      await erpDb.insert(quotationLines).values({
        quotationId: newQuotation.id,
        rfqLineId: sanitizeUuid(line.rfqLineId) || null,
        productId: sanitizeUuid(line.productId) || line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate || 0,
        discountPercentage: line.discountPercentage || 0,
        lineTotal: lineTotal.toString(),
        deliveryTime: line.deliveryTime,
      });
    }

    return NextResponse.json({ quotation: newQuotation }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/purchasing/quotations
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update quotations' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { quotationId, status } = body;

    if (!quotationId || !status) {
      return NextResponse.json(
        { error: 'Missing quotationId or status' },
        { status: 400 }
      );
    }

    await erpDb.update(supplierQuotations)
      .set({ status, updatedAt: sql`NOW()` })
      .where(
        and(
          eq(supplierQuotations.id, quotationId),
          eq(supplierQuotations.erpOrganizationId, user.erpOrganizationId)
        )
      );

    return NextResponse.json({ message: 'Quotation updated successfully' });
  } catch (error: any) {
    logDatabaseError('Updating quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
