import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/purchasing/analytics
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view purchasing analytics' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let poSummary: any = [];
    let rfqSummary: any = [];
    let topSuppliers: any = [];
    let purchaseTrends: any = [];
    let categorySpending: any = [];
    let invoiceSummary: any = [];
    let deliveryPerformance: any = [];
    let topProducts: any = [];
    let pendingReceipts: any = [];

    try {
      // Purchase order summary statistics
      poSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_purchase_orders,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status IN ('confirmed', 'sent') THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN status = 'partially_received' THEN 1 END) as partially_received_count,
          COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_purchase_value,
          COALESCE(SUM(CASE WHEN status IN ('confirmed', 'sent', 'partially_received') THEN CAST(total_amount AS DECIMAL) ELSE 0 END), 0) as pending_value,
          COALESCE(SUM(CASE WHEN status IN ('received', 'confirmed', 'sent') THEN CAST(total_amount AS DECIMAL) ELSE 0 END), 0) as completed_value
        FROM purchase_orders
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${supplierId ? sql`AND supplier_id = ${supplierId}` : sql``}
        ${startDate && endDate ? sql`AND po_date >= CAST(${startDate} AS DATE) AND po_date <= CAST(${endDate} AS DATE)` : sql``}
      `);
      console.log('PO Summary from database:', poSummary);
      const poSummaryData = Array.from(poSummary)[0] as any;
      console.log('PO Summary parsed:', {
        total: poSummaryData?.total_purchase_orders,
        draft: poSummaryData?.draft_count,
        received: poSummaryData?.received_count,
        partially_received: poSummaryData?.partially_received_count,
        confirmed: poSummaryData?.confirmed_count
      });
    } catch (e: any) {
      console.error('Error in poSummary:', e.message);
      console.error('Full error:', e);
      poSummary = [];
    }

    try {
      // RFQ statistics
      rfqSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_rfqs,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count
        FROM request_for_quotations
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${startDate && endDate ? sql`AND rfq_date >= CAST(${startDate} AS DATE) AND rfq_date <= CAST(${endDate} AS DATE)` : sql``}
      `);
      console.log('RFQ Summary from database:', rfqSummary);
    } catch (e: any) {
      console.error('Error in rfqSummary:', e.message);
      console.error('Full error:', e);
      rfqSummary = [];
    }

    try {
      // Supplier performance (top suppliers by purchase value)
      topSuppliers = await erpDb.execute(sql`
        SELECT 
          s.id,
          s.name,
          s.code,
          COUNT(po.id) as total_orders,
          COALESCE(SUM(CAST(po.total_amount AS DECIMAL)), 0) as total_purchase_value,
          COUNT(CASE WHEN po.status = 'received' THEN 1 END) as completed_orders,
          ROUND(
            (COUNT(CASE WHEN po.status = 'received' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(po.id), 0) * 100), 2
          ) as completion_rate
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE s.erp_organization_id = ${user.erpOrganizationId}
        ${startDate && endDate ? sql`AND po.po_date >= CAST(${startDate} AS DATE) AND po.po_date <= CAST(${endDate} AS DATE)` : sql``}
        GROUP BY s.id, s.name, s.code
        ORDER BY total_purchase_value DESC
        LIMIT 10
      `);
    } catch (e: any) {
      console.error('Error in topSuppliers:', e.message);
      console.error('Full error:', e);
      topSuppliers = [];
    }

    try {
      // Purchase trends by month (last 12 months)
      purchaseTrends = await erpDb.execute(sql`
        SELECT 
          TO_CHAR(po_date, 'YYYY-MM') as month,
          COUNT(*) as order_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_value
        FROM purchase_orders
        WHERE erp_organization_id = ${user.erpOrganizationId}
          AND po_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(po_date, 'YYYY-MM')
        ORDER BY month DESC
      `);
    } catch (e: any) {
      console.error('Error in purchaseTrends:', e.message);
      purchaseTrends = [];
    }

    try {
      // Category-wise spending
      categorySpending = await erpDb.execute(sql`
        SELECT 
          COALESCE(c.name, 'Uncategorized') as category_name,
          COUNT(DISTINCT po.id) as order_count,
          COALESCE(SUM(CAST(pol.quantity_ordered AS DECIMAL) * CAST(pol.unit_price AS DECIMAL)), 0) as total_spending
        FROM purchase_order_lines pol
        JOIN purchase_orders po ON pol.purchase_order_id = po.id
        LEFT JOIN products p ON pol.product_id = p.id
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE po.erp_organization_id = ${user.erpOrganizationId}
        ${startDate && endDate ? sql`AND po.po_date >= CAST(${startDate} AS DATE) AND po.po_date <= CAST(${endDate} AS DATE)` : sql``}
        GROUP BY c.name
        ORDER BY total_spending DESC
        LIMIT 10
      `);
    } catch (e: any) {
      console.error('Error in categorySpending:', e.message);
      console.error('Full error:', e);
      categorySpending = [];
    }

    try {
      // Vendor invoice summary (including supplier portal invoices)
      invoiceSummary = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN payment_status = 'pending' OR status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN payment_status = 'paid' OR status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN payment_status = 'overdue' OR status = 'overdue' THEN 1 END) as overdue_count,
          COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total_invoice_value,
          COALESCE(SUM(CASE WHEN payment_status = 'pending' OR status = 'pending' THEN CAST(total_amount AS DECIMAL) ELSE 0 END), 0) as pending_value,
          COALESCE(SUM(CASE WHEN payment_status = 'paid' OR status = 'paid' THEN CAST(total_amount AS DECIMAL) ELSE 0 END), 0) as paid_value
        FROM (
          SELECT total_amount, status, NULL as payment_status FROM vendor_invoices 
          WHERE erp_organization_id = ${user.erpOrganizationId}
          ${supplierId ? sql`AND supplier_id = ${supplierId}` : sql``}
          ${startDate && endDate ? sql`AND invoice_date >= CAST(${startDate} AS DATE) AND invoice_date <= CAST(${endDate} AS DATE)` : sql``}
          UNION ALL
          SELECT total_amount, NULL as status, payment_status FROM supplier_invoices
          WHERE erp_organization_id = ${user.erpOrganizationId}
          ${supplierId ? sql`AND supplier_id = ${supplierId}` : sql``}
          ${startDate && endDate ? sql`AND invoice_date >= CAST(${startDate} AS DATE) AND invoice_date <= CAST(${endDate} AS DATE)` : sql``}
        ) combined_invoices
      `);
    } catch (e: any) {
      console.error('Error in invoiceSummary:', e.message);
      console.error('Full error:', e);
      invoiceSummary = [];
    }

    try {
      // Average delivery time
      deliveryPerformance = await erpDb.execute(sql`
        SELECT 
          COUNT(*) as completed_orders,
          AVG(
            EXTRACT(DAY FROM (received_date - po_date))
          ) as avg_delivery_days
        FROM purchase_orders
        WHERE erp_organization_id = ${user.erpOrganizationId}
          AND status = 'received'
          AND received_date IS NOT NULL
        ${supplierId ? sql`AND supplier_id = ${supplierId}` : sql``}
        ${startDate && endDate ? sql`AND po_date >= CAST(${startDate} AS DATE) AND po_date <= CAST(${endDate} AS DATE)` : sql``}
      `);
    } catch (e: any) {
      console.error('Error in deliveryPerformance:', e.message);
      console.error('Full error:', e);
      deliveryPerformance = [];
    }

    try {
      // Top purchased products
      topProducts = await erpDb.execute(sql`
        SELECT 
          p.id,
          p.name,
          p.sku,
          COUNT(DISTINCT pol.purchase_order_id) as order_count,
          COALESCE(SUM(CAST(pol.quantity_ordered AS DECIMAL)), 0) as total_quantity,
          COALESCE(SUM(CAST(pol.quantity_ordered AS DECIMAL) * CAST(pol.unit_price AS DECIMAL)), 0) as total_value
        FROM purchase_order_lines pol
        JOIN products p ON pol.product_id = p.id
        JOIN purchase_orders po ON pol.purchase_order_id = po.id
        WHERE po.erp_organization_id = ${user.erpOrganizationId}
        ${startDate && endDate ? sql`AND po.po_date >= CAST(${startDate} AS DATE) AND po.po_date <= CAST(${endDate} AS DATE)` : sql``}
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_value DESC
        LIMIT 10
      `);
    } catch (e: any) {
      console.error('Error in topProducts:', e.message);
      console.error('Full error:', e);
      topProducts = [];
    }

    try {
      // Pending items to receive
      pendingReceipts = await erpDb.execute(sql`
        SELECT 
          po.id,
          po.po_number,
          s.name as supplier_name,
          po.po_date,
          po.expected_delivery_date,
          po.total_amount,
          CASE 
            WHEN po.expected_delivery_date IS NOT NULL 
            THEN EXTRACT(DAY FROM (CURRENT_DATE - po.expected_delivery_date))
            ELSE 0
          END as days_overdue
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.erp_organization_id = ${user.erpOrganizationId}
          AND po.status IN ('confirmed', 'partially_received')
        ORDER BY po.expected_delivery_date ASC NULLS LAST
        LIMIT 20
      `);
    } catch (e: any) {
      console.error('Error in pendingReceipts:', e.message);
      console.error('Full error:', e);
      pendingReceipts = [];
    }

    let receiptSummary: any = [];
    try {
      // Goods and Payment Receipts Summary
      receiptSummary = await erpDb.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM goods_receipts WHERE erp_organization_id = ${user.erpOrganizationId}) as total_po_receipts,
          (SELECT COUNT(*) FROM supplier_invoice_receipts WHERE erp_organization_id = ${user.erpOrganizationId}) as total_invoice_receipts,
          (SELECT COUNT(*) FROM goods_receipts WHERE erp_organization_id = ${user.erpOrganizationId} AND status = 'received') as po_received,
          (SELECT COUNT(*) FROM goods_receipts WHERE erp_organization_id = ${user.erpOrganizationId} AND status = 'accepted') as po_accepted,
          (SELECT COUNT(*) FROM supplier_invoice_receipts WHERE erp_organization_id = ${user.erpOrganizationId} AND status = 'generated') as invoice_generated,
          (SELECT COUNT(*) FROM supplier_invoice_receipts WHERE erp_organization_id = ${user.erpOrganizationId} AND status = 'downloaded') as invoice_downloaded,
          (SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) FROM supplier_invoice_receipts WHERE erp_organization_id = ${user.erpOrganizationId}) as total_receipt_amount
      `);
    } catch (e: any) {
      console.error('Error in receiptSummary:', e.message);
      console.error('Full error:', e);
      receiptSummary = [];
    }

    return NextResponse.json({
      poSummary: Array.from(poSummary || [])[0] || {},
      rfqSummary: Array.from(rfqSummary || [])[0] || {},
      invoiceSummary: Array.from(invoiceSummary || [])[0] || {},
      deliveryPerformance: Array.from(deliveryPerformance || [])[0] || {},
      receiptSummary: Array.from(receiptSummary || [])[0] || {},
      topSuppliers: Array.from(topSuppliers || []),
      purchaseTrends: Array.from(purchaseTrends || []),
      categorySpending: Array.from(categorySpending || []),
      topProducts: Array.from(topProducts || []),
      pendingReceipts: Array.from(pendingReceipts || []),
    });
  } catch (err: any) {
    console.error('Error fetching purchasing analytics:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch purchasing analytics',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 500 }
    );
  }
}
