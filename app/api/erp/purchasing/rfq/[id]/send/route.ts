import { NextRequest, NextResponse } from 'next/server';
import { erpDb, mainDb } from '@/lib/db';
import { requestForQuotations, rfqLines, rfqSuppliers, suppliers } from '@/lib/db/schema/purchasing-sales';
import { products } from '@/lib/db/schema/inventory';
import { eq, sql, inArray } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';
import { getRFQEmailTemplate } from '@/lib/emailTemplates';
import { requireErpAccess } from '@/lib/auth';

// POST /api/erp/purchasing/rfq/[id]/send
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    const { id: rfqId } = await params;

    // Fetch RFQ with details
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

    if (invitedSuppliers.length === 0) {
      return NextResponse.json({ error: 'No suppliers invited for this RFQ' }, { status: 400 });
    }

    // Fetch organization details from main DB
    const [org] = await mainDb.execute(
      sql`SELECT name, logo_url FROM organizations WHERE id = ${user.organizationId} LIMIT 1`
    );

    const organizationName = (org as any)?.name || 'Organization';
    const organizationLogo = (org as any)?.logo_url;

    // Prepare email data
    const emailData = {
      rfqNumber: rfq.rfqNumber,
      rfqDate: new Date(rfq.rfqDate).toLocaleDateString('en-IN'),
      deadlineDate: rfq.deadlineDate
        ? new Date(rfq.deadlineDate).toLocaleDateString('en-IN')
        : undefined,
      title: rfq.title,
      description: rfq.description || undefined,
      organizationName,
      lines: lines.map(l => ({
        productName: l.product?.name || 'Unknown Product',
        description: l.line.description || undefined,
        quantity: parseFloat(l.line.quantityRequested).toString(),
        targetPrice: l.line.targetPrice
          ? `₹${parseFloat(l.line.targetPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          : undefined,
      })),
      suppliers: invitedSuppliers.map(s => ({
        name: s.supplier?.name || 'Unknown Supplier',
        email: s.supplier?.email || '',
      })),
    };

    // Send emails to all suppliers
    const sendPromises = invitedSuppliers
      .filter(s => s.supplier?.email)
      .map(async (s) => {
        // Create email data with supplier-specific email for portal link
        const supplierEmailData = {
          ...emailData,
          supplierEmail: s.supplier!.email || undefined,
        };
        
        const supplierEmailHtml = getRFQEmailTemplate(supplierEmailData, organizationName, organizationLogo);
        
        const result = await sendEmail({
          to: s.supplier!.email!,
          subject: `Request for Quotation ${rfq.rfqNumber} from ${organizationName}`,
          html: supplierEmailHtml,
        });
        return { supplierId: s.supplier!.id, success: result.success, error: result.error };
      });

    const results = await Promise.all(sendPromises);
    const failedSends = results.filter(r => !r.success);

    if (failedSends.length > 0) {
      console.error('Some emails failed to send:', failedSends);
    }

    // Update RFQ status to 'sent'
    await erpDb
      .update(requestForQuotations)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(requestForQuotations.id, rfqId));

    return NextResponse.json({
      success: true,
      message: `RFQ sent to ${results.length - failedSends.length} supplier(s)`,
      sentCount: results.length - failedSends.length,
      failedCount: failedSends.length,
    });
  } catch (error: any) {
    console.error('Error sending RFQ:', error);
    return NextResponse.json({ error: error.message || 'Failed to send RFQ' }, { status: 500 });
  }
}
