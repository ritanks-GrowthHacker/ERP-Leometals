import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requestForQuotations, rfqLines, rfqSuppliers } from '@/lib/db/schema/purchasing-sales';
import { products } from '@/lib/db/schema/inventory';
import { suppliers } from '@/lib/db/schema/purchasing-sales';
import { eq, sql } from 'drizzle-orm';
import { requireErpAccess } from '@/lib/auth';

// GET /api/erp/purchasing/rfq/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    const { id: rfqId } = await params;

    // Fetch RFQ
    const [rfq] = await erpDb
      .select()
      .from(requestForQuotations)
      .where(eq(requestForQuotations.id, rfqId));

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    // Fetch RFQ lines with product details
    const lines = await erpDb
      .select({
        line: rfqLines,
        product: products,
      })
      .from(rfqLines)
      .leftJoin(products, eq(rfqLines.productId, products.id))
      .where(eq(rfqLines.rfqId, rfqId));

    // Fetch invited suppliers
    const invitedSuppliers = await erpDb
      .select({
        rfqSupplier: rfqSuppliers,
        supplier: suppliers,
      })
      .from(rfqSuppliers)
      .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
      .where(eq(rfqSuppliers.rfqId, rfqId));

    // Fetch quotations for this RFQ
    const quotationsResult = await erpDb.execute(sql`
      SELECT 
        sq.*,
        s.name as supplier_name,
        s.code as supplier_code,
        s.email as supplier_email
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      WHERE sq.rfq_id = ${rfqId}
      ORDER BY sq.submission_date DESC, sq.created_at DESC
    `);
    
    const quotations = Array.from(quotationsResult);

    return NextResponse.json({
      rfq: {
        ...rfq,
        lines: lines.map(l => ({
          ...l.line,
          product: l.product,
        })),
        suppliers: invitedSuppliers,
        quotations,
      },
    });
  } catch (error: any) {
    console.error('Error fetching RFQ:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch RFQ' }, { status: 500 });
  }
}
