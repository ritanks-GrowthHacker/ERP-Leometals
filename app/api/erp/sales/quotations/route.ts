import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesQuotations, salesQuotationLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/sales/quotations
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view quotations' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    const conditions = [eq(salesQuotations.erpOrganizationId, user.organizationId)];

    if (status) {
      conditions.push(eq(salesQuotations.status, status));
    }

    if (search) {
      conditions.push(
        like(salesQuotations.quotationNumber, `%${search}%`)
      );
    }

    const quotationsList = await erpDb.query.salesQuotations.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(salesQuotations.createdAt)],
      limit,
      offset,
    });

    const [countResult] = await erpDb
      .select({ count: sql<number>`count(*)::int` })
      .from(salesQuotations)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    return NextResponse.json({
      quotations: quotationsList,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    logDatabaseError('Fetching sales quotations', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/sales/quotations
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create quotations' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    console.log('POST /api/erp/sales/quotations - Request body:', JSON.stringify(body, null, 2));
    
    const {
      customerId,
      validUntil,
      paymentTerms,
      notes,
      lines,
      items, // Accept both 'items' and 'lines' for flexibility
    } = body;

    // Use either 'lines' or 'items' from the request
    const lineItems = lines || items;

    if (!customerId || !lineItems || lineItems.length === 0) {
      console.error('Validation failed:', { customerId, linesLength: lineItems?.length });
      return NextResponse.json(
        { error: 'Customer and at least one line item are required', received: { customerId: !!customerId, linesCount: lineItems?.length || 0 } },
        { status: 400 }
      );
    }

    // Generate quotation number with retry logic
    let quotationNumber = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const lastQuotation = await erpDb.query.salesQuotations.findFirst({
        where: eq(salesQuotations.erpOrganizationId, user.organizationId),
        orderBy: [desc(salesQuotations.quotationNumber)],
      });

      const nextNum = (lastQuotation ? parseInt(lastQuotation.quotationNumber.replace('QT', '')) : 0) + 1;
      quotationNumber = `QT${String(nextNum).padStart(6, '0')}`;
      
      // Check if exists
      const existing = await erpDb.query.salesQuotations.findFirst({
        where: and(
          eq(salesQuotations.erpOrganizationId, user.organizationId),
          eq(salesQuotations.quotationNumber, quotationNumber)
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

    for (const line of lineItems) {
      const lineTotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
      subtotal += lineTotal;
      const lineTax = lineTotal * (parseFloat(line.taxRate || 0) / 100);
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Create quotation
    const [newQuotation] = await erpDb
      .insert(salesQuotations)
      .values({
        erpOrganizationId: user.organizationId,
        customerId,
        quotationNumber,
        quotationDate: new Date().toISOString().split('T')[0],
        validUntil: validUntil || null,
        status: 'draft',
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paymentTerms: paymentTerms || 30,
        notes: notes || null,
        createdBy: user.id,
      })
      .returning();

    // Create quotation lines
    const quotationLines = await erpDb
      .insert(salesQuotationLines)
      .values(
        lineItems.map((line: any) => ({
          salesQuotationId: newQuotation.id,
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

    return NextResponse.json(
      { quotation: { ...newQuotation, lines: quotationLines } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating sales quotation:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint_name,
      cause: error.cause,
      stack: error.stack,
    });
    logDatabaseError('Creating sales quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message, details: error.message }, { status: dbError.statusCode });
  }
}
