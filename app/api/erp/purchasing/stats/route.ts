import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/purchasing/stats - Get all purchasing stats
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stats' },
      { status: 403 }
    );
  }

  try {
    // Get RFQ stats
    const rfqStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::int as draft,
        COUNT(CASE WHEN status = 'sent' THEN 1 END)::int as sent,
        COUNT(CASE WHEN status = 'received' THEN 1 END)::int as received,
        COUNT(CASE WHEN status = 'closed' THEN 1 END)::int as closed
      FROM request_for_quotations
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Purchase Order stats
    const poStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::int as draft,
        COUNT(CASE WHEN status = 'sent' THEN 1 END)::int as sent,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::int as confirmed,
        COUNT(CASE WHEN status = 'received' THEN 1 END)::int as received,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount::numeric ELSE 0 END), 0) as total_value
      FROM purchase_orders
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Quotation stats
    const quotationStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END)::int as submitted,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END)::int as under_review,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END)::int as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected
      FROM supplier_quotation_submissions sq
      JOIN suppliers s ON sq.supplier_id = s.id
      WHERE s.erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Supplier Invoice stats
    const invoiceStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN payment_status = 'partially_paid' THEN 1 END)::int as partially_paid,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END)::int as paid,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END)::int as overdue,
        COALESCE(SUM(total_amount::numeric), 0) as total_value,
        COALESCE(SUM(paid_amount::numeric), 0) as paid_value
      FROM supplier_invoices
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Vendor Invoice stats
    const vendorInvoiceStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::int as draft,
        COUNT(CASE WHEN status = 'sent' THEN 1 END)::int as sent,
        COUNT(CASE WHEN status = 'approved' THEN 1 END)::int as approved,
        COUNT(CASE WHEN status = 'paid' THEN 1 END)::int as paid,
        COALESCE(SUM(total_amount::numeric), 0) as total_value
      FROM vendor_invoices
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Goods Receipts stats (including both PO receipts and supplier invoice receipts)
    const receiptsStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'received' THEN 1 END)::int as received,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END)::int as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int as rejected
      FROM goods_receipts
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Supplier Invoice Receipts stats
    const supplierReceiptsStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'downloaded' THEN 1 END)::int as downloaded,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending
      FROM supplier_invoice_receipts
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get Supplier stats
    const supplierStats = await erpDb.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int as active,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int as inactive
      FROM suppliers
      WHERE erp_organization_id = ${user.erpOrganizationId}
    `);

    const rfqData = Array.from(rfqStats)[0] as any;
    const poData = Array.from(poStats)[0] as any;
    const quotationData = Array.from(quotationStats)[0] as any;
    const supplierInvoiceData = Array.from(invoiceStats)[0] as any;
    const vendorInvoiceData = Array.from(vendorInvoiceStats)[0] as any;
    const receiptsData = Array.from(receiptsStats)[0] as any;
    const supplierReceiptsData = Array.from(supplierReceiptsStats)[0] as any;
    const supplierData = Array.from(supplierStats)[0] as any;

    return NextResponse.json({
      rfqs: {
        total: rfqData?.total || 0,
        pending: rfqData?.sent || 0,
        quoted: rfqData?.received || 0,
      },
      quotations: {
        total: quotationData?.total || 0,
        pending: quotationData?.submitted || 0,
        accepted: quotationData?.accepted || 0,
        rejected: quotationData?.rejected || 0,
      },
      purchaseOrders: {
        total: poData?.total || 0,
        draft: poData?.draft || 0,
        confirmed: poData?.confirmed || 0,
        received: poData?.received || 0,
      },
      invoices: {
        total: (supplierInvoiceData?.total || 0) + (vendorInvoiceData?.total || 0),
        pending: (supplierInvoiceData?.pending || 0) + (vendorInvoiceData?.draft || 0),
        approved: vendorInvoiceData?.approved || 0,
        paid: (supplierInvoiceData?.paid || 0) + (vendorInvoiceData?.paid || 0),
        overdue: supplierInvoiceData?.overdue || 0,
      },
      receipts: {
        total: (receiptsData?.total || 0) + (supplierReceiptsData?.total || 0),
        received: receiptsData?.received || 0,
        accepted: receiptsData?.accepted || 0,
        downloaded: supplierReceiptsData?.downloaded || 0,
      },
      suppliers: supplierData,
    });
  } catch (error: any) {
    console.error('Error fetching purchasing stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}