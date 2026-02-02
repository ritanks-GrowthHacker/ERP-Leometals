import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requestForQuotations, rfqLines, rfqSuppliers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/purchasing/rfq
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view RFQs' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Fetch RFQs with quotations count
    const query = sql`
      SELECT 
        rfq.*,
        COUNT(DISTINCT sq.id) as quotations_count
      FROM request_for_quotations rfq
      LEFT JOIN supplier_quotation_submissions sq ON sq.rfq_id = rfq.id
      WHERE rfq.erp_organization_id = ${user.erpOrganizationId}
      ${status ? sql`AND rfq.status = ${status}` : sql``}
      GROUP BY rfq.id
      ORDER BY rfq.created_at DESC
    `;

    const result = await erpDb.execute(query);
    const rfqsWithCounts = Array.from(result);

    // Fetch lines and suppliers for each RFQ
    const rfqs = await Promise.all(
      rfqsWithCounts.map(async (rfq: any) => {
        const lines = await erpDb.query.rfqLines.findMany({
          where: eq(rfqLines.rfqId, rfq.id),
          with: { product: true },
        });

        const suppliers = await erpDb.query.rfqSuppliers.findMany({
          where: eq(rfqSuppliers.rfqId, rfq.id),
          with: { supplier: true },
        });

        return {
          ...rfq,
          quotationsCount: parseInt(rfq.quotations_count) || 0,
          lines,
          suppliers,
        };
      })
    );

    return NextResponse.json({ rfqs });
  } catch (error: any) {
    logDatabaseError('Fetching RFQs', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/purchasing/rfq
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create RFQs' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    console.log('RFQ creation request body:', body);
    
    const {
      title,
      description,
      deadlineDate,
      responseDeadline,
      deliveryDate,
      notes,
      lines,
      items, // Accept items as well
      supplierIds,
    } = body;

    // Use items if lines is not provided
    const productLines = lines || items;

    console.log('Extracted fields:', { title, hasLines: !!productLines, linesLength: productLines?.length, hasSupplierIds: !!supplierIds, supplierIdsLength: supplierIds?.length });

    if (!productLines || !Array.isArray(productLines) || productLines.length === 0) {
      return NextResponse.json(
        { error: 'At least one product line/item is required' },
        { status: 400 }
      );
    }

    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one supplier must be selected' },
        { status: 400 }
      );
    }

    // Auto-generate title if not provided
    const rfqTitle = title || `RFQ for ${productLines[0]?.productName || 'Products'} (${new Date().toLocaleDateString()})`;
    const deadline = responseDeadline || deadlineDate || deliveryDate;

    // Generate RFQ number with retry logic
    let rfqNumber = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const lastRFQ = await erpDb.query.requestForQuotations.findFirst({
        where: eq(requestForQuotations.erpOrganizationId, user.erpOrganizationId),
        orderBy: [desc(requestForQuotations.rfqNumber)],
      });

      const lastNum = lastRFQ ? parseInt((lastRFQ as any).rfqNumber.split('-')[1]) : 0;
      rfqNumber = `RFQ-${String(lastNum + 1).padStart(6, '0')}`;
      
      // Check if exists
      const existing = await erpDb.query.requestForQuotations.findFirst({
        where: and(
          eq(requestForQuotations.erpOrganizationId, user.erpOrganizationId),
          eq(requestForQuotations.rfqNumber, rfqNumber)
        ),
      });
      
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique RFQ number' }, { status: 400 });
    }

    // Create RFQ
    const [newRFQ] = await erpDb.insert(requestForQuotations).values({
      erpOrganizationId: user.erpOrganizationId,
      rfqNumber,
      title: rfqTitle,
      description: description || null,
      deadlineDate: deadline || null,
      notes: notes || null,
      createdBy: user.id,
    }).returning();

    // Create RFQ lines from either lines or items
    for (const line of productLines) {
      await erpDb.insert(rfqLines).values({
        rfqId: newRFQ.id,
        productId: sanitizeUuid(line.productId) || line.productId,
        quantityRequested: line.quantityRequested || line.quantity || '1',
        targetPrice: line.targetPrice || null,
        description: line.description || line.specifications || null,
      });
    }

    // Create RFQ suppliers
    for (const supplierId of supplierIds) {
      await erpDb.insert(rfqSuppliers).values({
        rfqId: newRFQ.id,
        supplierId,
      });
    }

    return NextResponse.json({ rfq: newRFQ }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating RFQ', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
