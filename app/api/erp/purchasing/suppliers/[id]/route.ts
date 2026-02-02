import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { suppliers, purchaseOrders, requestForQuotations, rfqSuppliers, vendorInvoices } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/purchasing/suppliers/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view supplier details' },
      { status: 403 }
    );
  }

  try {
    const { id: supplierId } = await params;

    // Fetch supplier details
    const supplier = await erpDb.query.suppliers.findFirst({
      where: and(
        eq(suppliers.id, supplierId),
        eq(suppliers.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        contacts: true,
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Fetch purchase orders for this supplier
    const pos = await erpDb.query.purchaseOrders.findMany({
      where: and(
        eq(purchaseOrders.supplierId, supplierId),
        eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: {
          with: {
            product: true,
          },
        },
        warehouse: true,
      },
      orderBy: [desc(purchaseOrders.createdAt)],
      limit: 50,
    });

    // Fetch RFQs sent to this supplier
    const rfqList = await erpDb
      .select({
        rfq: requestForQuotations,
        rfqSupplier: rfqSuppliers,
      })
      .from(rfqSuppliers)
      .leftJoin(requestForQuotations, eq(rfqSuppliers.rfqId, requestForQuotations.id))
      .where(and(
        eq(rfqSuppliers.supplierId, supplierId),
        eq(requestForQuotations.erpOrganizationId, user.erpOrganizationId)
      ))
      .orderBy(desc(requestForQuotations.createdAt))
      .limit(50);

    // Fetch vendor invoices for this supplier (paid through ERP)
    const vendorInvoicesResult = await erpDb.execute(sql`
      SELECT 
        vi.*,
        s.name as supplier_name,
        po.po_number,
        COUNT(vil.id) as line_count
      FROM vendor_invoices vi
      LEFT JOIN suppliers s ON vi.supplier_id = s.id
      LEFT JOIN purchase_orders po ON vi.purchase_order_id = po.id
      LEFT JOIN vendor_invoice_lines vil ON vi.id = vil.vendor_invoice_id
      WHERE vi.erp_organization_id = ${user.erpOrganizationId}
      AND vi.supplier_id = ${supplierId}
      GROUP BY vi.id, s.name, po.po_number
      ORDER BY vi.created_at DESC
      LIMIT 50
    `);

    // Fetch supplier portal invoices (submitted by supplier, paid through portal)
    const supplierInvoicesResult = await erpDb.execute(sql`
      SELECT 
        si.*,
        sq.submission_number as quotation_number,
        sq.rfq_id,
        rfq.rfq_number
      FROM supplier_invoices si
      LEFT JOIN supplier_quotation_submissions sq ON si.quotation_id = sq.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      WHERE si.supplier_id = ${supplierId}
        AND si.erp_organization_id = ${user.erpOrganizationId}
      ORDER BY si.created_at DESC
      LIMIT 50
    `);

    const vendorInvoices = Array.from(vendorInvoicesResult);
    const supplierInvoices = Array.from(supplierInvoicesResult);
    const allInvoices = [...vendorInvoices, ...supplierInvoices];

    // Fetch supplier quotations from supplier portal
    const quotationsResult = await erpDb.execute(sql`
      SELECT 
        sq.*,
        rfq.rfq_number,
        rfq.title as rfq_title
      FROM supplier_quotation_submissions sq
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      WHERE sq.supplier_id = ${supplierId}
      ORDER BY sq.submission_date DESC, sq.created_at DESC
      LIMIT 50
    `);
    
    const quotations = Array.from(quotationsResult);

    // Fetch payment receipts for this supplier
    const receiptsResult = await erpDb.execute(sql`
      SELECT 
        r.*,
        si.invoice_number,
        si.invoice_date
      FROM supplier_invoice_receipts r
      JOIN supplier_invoices si ON r.invoice_id = si.id
      WHERE r.supplier_id = ${supplierId}
        AND r.erp_organization_id = ${user.erpOrganizationId}
      ORDER BY r.receipt_date DESC
      LIMIT 50
    `);
    
    const receipts = Array.from(receiptsResult);

    // Fetch products linked to this supplier
    const productsResult = await erpDb.execute(sql`
      SELECT 
        ps.id,
        ps.product_id as "productId",
        ps.supplier_id as "supplierId",
        ps.supplier_product_name as "supplierProductName",
        ps.supplier_sku as "supplierSku",
        ps.cost_price as "costPrice",
        ps.lead_time_days as "leadTimeDays",
        ps.is_primary as "isPrimary",
        p.name as "productName",
        p.sku as "productSku"
      FROM product_suppliers ps
      JOIN products p ON ps.product_id = p.id
      WHERE ps.supplier_id = ${supplierId}
        AND p.erp_organization_id = ${user.erpOrganizationId}
      ORDER BY ps.is_primary DESC, p.name ASC
    `);
    
    const products = Array.from(productsResult);

    // Calculate statistics
    // Total Purchase Value should be sum of all receipts, not purchase orders
    const totalPurchaseValue = receipts.reduce(
      (sum, receipt: any) => sum + parseFloat(receipt.amount || '0'),
      0
    );

    const pendingPOs = pos.filter(po => po.status === 'confirmed' || po.status === 'partially_received').length;
    const completedPOs = pos.filter(po => po.status === 'received').length;

    return NextResponse.json({
      supplier,
      purchaseOrders: pos,
      rfqs: rfqList.map(r => r.rfq),
      quotations,
      invoices: allInvoices,
      receipts,
      products,
      statistics: {
        totalPurchaseOrders: pos.length,
        pendingPurchaseOrders: pendingPOs,
        completedPurchaseOrders: completedPOs,
        totalPurchaseValue: totalPurchaseValue.toFixed(2),
        totalRFQs: rfqList.length,
        totalQuotations: quotations.length,
        totalInvoices: allInvoices.length,
        totalReceipts: receipts.length,
      },
    });
  } catch (error: any) {
    logDatabaseError('Fetching supplier details', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/purchasing/suppliers/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit suppliers' },
      { status: 403 }
    );
  }

  try {
    const { id: supplierId } = await params;
    const body = await req.json();

    const {
      name,
      code,
      email,
      phone,
      website,
      address,
      city,
      state,
      country,
      postalCode,
      taxId,
      paymentTerms,
      currencyCode,
      notes,
      isActive,
    } = body;

    // Check if supplier exists
    const existingSupplier = await erpDb.query.suppliers.findFirst({
      where: and(
        eq(suppliers.id, supplierId),
        eq(suppliers.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Update supplier
    const [updatedSupplier] = await erpDb
      .update(suppliers)
      .set({
        name,
        code,
        email,
        phone,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        taxId,
        paymentTerms,
        currencyCode,
        notes,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    return NextResponse.json({ supplier: updatedSupplier });
  } catch (error: any) {
    logDatabaseError('Updating supplier', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
