import { NextRequest, NextResponse } from 'next/server';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb, mainDb } from '@/lib/db';
import { 
  customers, salesOrders, salesOrderLines, products, 
  productCategories 
} from '@/lib/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

/**
 * GET /api/erp/audit/customer-insights/[customerId]
 * Customer 360° Insights - Complete analytics for a single customer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  // Check permissions
  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view customer insights' },
      { status: 403 }
    );
  }

  try {
    // Await params to get customerId
    const { customerId } = await params;

    // Verify customer belongs to organization
    const customer = await erpDb.query.customers.findFirst({
      where: and(
        eq(customers.id, customerId),
        eq(customers.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // ================================================
    // 1. TOP KPIs
    // ================================================
    const kpiData = await erpDb
      .select({
        lifetimeValue: sql<number>`COALESCE(SUM(${salesOrders.totalAmount}), 0)::decimal`,
        outstandingBalance: sql<number>`COALESCE(SUM(CASE WHEN ${salesOrders.status} != 'delivered' THEN ${salesOrders.totalAmount} ELSE 0 END), 0)::decimal`,
        avgOrderValue: sql<number>`COALESCE(AVG(${salesOrders.totalAmount}), 0)::decimal`,
        totalOrders: sql<number>`COUNT(*)::int`,
        recentOrders: sql<number>`COUNT(CASE WHEN ${salesOrders.soDate} >= NOW() - INTERVAL '12 months' THEN 1 END)::int`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      );

    // Payment delay calculation
    const paymentDelayData = await erpDb
      .select({
        avgPaymentDelay: sql<number>`COALESCE(AVG(EXTRACT(DAY FROM (NOW() - ${salesOrders.soDate}))), 0)::decimal`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          sql`${salesOrders.status} IN ('confirmed', 'in_progress')`
        )
      );

    // Return rate calculation
    const returnData = await erpDb
      .select({
        deliveredOrders: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'delivered' THEN 1 END)::int`,
        returnedOrders: sql<number>`0::int`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      );

    const kpis = {
      lifetimeValue: Number(kpiData[0]?.lifetimeValue || 0),
      outstandingBalance: Number(kpiData[0]?.outstandingBalance || 0),
      avgOrderValue: Number(kpiData[0]?.avgOrderValue || 0),
      ordersLast12M: Number(kpiData[0]?.recentOrders || 0),
      returnRate: returnData[0]?.deliveredOrders > 0 
        ? (Number(returnData[0]?.returnedOrders || 0) / Number(returnData[0]?.deliveredOrders)) * 100 
        : 0,
      avgPaymentDelay: Number(paymentDelayData[0]?.avgPaymentDelay || 0),
    };

    // ================================================
    // 2. REVENUE TREND (Last 12 Months)
    // ================================================
    const revenueTrendData = await erpDb
      .select({
        month: sql<string>`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${salesOrders.soDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${salesOrders.soDate})::int`,
        revenue: sql<number>`COALESCE(SUM(${salesOrders.totalAmount}), 0)::decimal`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          sql`${salesOrders.soDate} >= NOW() - INTERVAL '12 months'`
        )
      )
      .groupBy(
        sql`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`,
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`
      );

    const revenueTrend = revenueTrendData.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
    }));

    // ================================================
    // 3. ORDERS VS REVENUE (Last 12 Months)
    // ================================================
    const ordersVsRevenueData = await erpDb
      .select({
        month: sql<string>`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${salesOrders.soDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${salesOrders.soDate})::int`,
        orderCount: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(${salesOrders.totalAmount}), 0)::decimal`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          sql`${salesOrders.soDate} >= NOW() - INTERVAL '12 months'`
        )
      )
      .groupBy(
        sql`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`,
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`
      );

    const ordersVsRevenue = ordersVsRevenueData.map((r) => ({
      month: r.month,
      orders: Number(r.orderCount),
      revenue: Number(r.revenue),
    }));

    // ================================================
    // 4. TOP PURCHASED CATEGORIES
    // ================================================
    const topCategoriesData = await erpDb
      .select({
        category: sql<string>`COALESCE(${productCategories.name}, 'Uncategorized')`,
        purchaseCount: sql<number>`COUNT(${salesOrderLines.id})::int`,
        totalSpent: sql<number>`COALESCE(SUM(${salesOrderLines.quantityOrdered} * ${salesOrderLines.unitPrice}), 0)::decimal`,
      })
      .from(salesOrderLines)
      .innerJoin(salesOrders, eq(salesOrderLines.salesOrderId, salesOrders.id))
      .innerJoin(products, eq(salesOrderLines.productId, products.id))
      .leftJoin(productCategories, eq(products.productCategoryId, productCategories.id))
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .groupBy(productCategories.name)
      .orderBy(desc(sql`COALESCE(SUM(${salesOrderLines.quantityOrdered} * ${salesOrderLines.unitPrice}), 0)`))
      .limit(5);

    const topCategories = topCategoriesData.map((c) => ({
      category: c.category,
      purchaseCount: Number(c.purchaseCount),
      totalSpent: Number(c.totalSpent),
    }));

    // ================================================
    // 5. TOP PRODUCTS BY REVENUE
    // ================================================
    const topProductsData = await erpDb
      .select({
        name: products.name,
        sku: products.sku,
        timesPurchased: sql<number>`COUNT(${salesOrderLines.id})::int`,
        totalQuantity: sql<number>`COALESCE(SUM(${salesOrderLines.quantityOrdered}), 0)::decimal`,
        totalRevenue: sql<number>`COALESCE(SUM(${salesOrderLines.quantityOrdered} * ${salesOrderLines.unitPrice}), 0)::decimal`,
      })
      .from(salesOrderLines)
      .innerJoin(salesOrders, eq(salesOrderLines.salesOrderId, salesOrders.id))
      .innerJoin(products, eq(salesOrderLines.productId, products.id))
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .groupBy(products.id, products.name, products.sku)
      .orderBy(desc(sql`COALESCE(SUM(${salesOrderLines.quantityOrdered} * ${salesOrderLines.unitPrice}), 0)`))
      .limit(5);

    const topProducts = topProductsData.map((p) => ({
      name: p.name,
      sku: p.sku,
      timesPurchased: Number(p.timesPurchased),
      totalQuantity: Number(p.totalQuantity),
      totalRevenue: Number(p.totalRevenue),
    }));

    // ================================================
    // 6. INVOICE PAYMENT STATUS
    // ================================================
    const paymentStatusData = await erpDb
      .select({
        month: sql<string>`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${salesOrders.soDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${salesOrders.soDate})::int`,
        paid: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'delivered' THEN 1 END)::int`,
        partiallyPaid: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'in_progress' THEN 1 END)::int`,
        overdue: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'confirmed' AND ${salesOrders.soDate} < NOW() - INTERVAL '30 days' THEN 1 END)::int`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          sql`${salesOrders.soDate} >= NOW() - INTERVAL '12 months'`
        )
      )
      .groupBy(
        sql`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`,
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`
      );

    const paymentStatus = paymentStatusData.map((p) => ({
      month: p.month,
      paid: Number(p.paid),
      partiallyPaid: Number(p.partiallyPaid),
      overdue: Number(p.overdue),
    }));

    // ================================================
    // 7. PAYMENT DELAY TREND
    // ================================================
    const paymentDelayTrendData = await erpDb
      .select({
        month: sql<string>`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${salesOrders.soDate})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${salesOrders.soDate})::int`,
        avgDelay: sql<number>`COALESCE(AVG(EXTRACT(DAY FROM (NOW() - ${salesOrders.soDate}))), 0)::decimal`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          sql`${salesOrders.soDate} >= NOW() - INTERVAL '12 months'`
        )
      )
      .groupBy(
        sql`TO_CHAR(${salesOrders.soDate}, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`,
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${salesOrders.soDate})`,
        sql`EXTRACT(MONTH FROM ${salesOrders.soDate})`
      );

    const paymentDelayTrend = paymentDelayTrendData.map((p) => ({
      month: p.month,
      avgDelay: Number(p.avgDelay),
    }));

    // ================================================
    // 8. RECENT ORDERS TABLE
    // ================================================
    const recentOrdersData = await erpDb
      .select({
        id: salesOrders.id,
        soNumber: salesOrders.soNumber,
        soDate: salesOrders.soDate,
        itemCount: sql<number>`COUNT(${salesOrderLines.id})::int`,
        totalAmount: salesOrders.totalAmount,
        status: salesOrders.status,
      })
      .from(salesOrders)
      .leftJoin(salesOrderLines, eq(salesOrders.id, salesOrderLines.salesOrderId))
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .groupBy(salesOrders.id, salesOrders.soNumber, salesOrders.soDate, salesOrders.totalAmount, salesOrders.status)
      .orderBy(desc(salesOrders.soDate))
      .limit(10);

    const recentOrders = recentOrdersData.map((o) => ({
      id: o.id,
      orderId: o.soNumber,
      orderNumber: o.soNumber,
      date: o.soDate,
      items: Number(o.itemCount),
      amount: Number(o.totalAmount),
      status: o.status,
    }));

    // ================================================
    // 9. INVOICES & PAYMENTS TABLE
    // ================================================
    const invoicesData = await erpDb
      .select({
        invoiceNo: salesOrders.soNumber,
        invoiceDate: salesOrders.soDate,
        totalAmount: salesOrders.totalAmount,
        paidAmount: sql<number>`CASE WHEN ${salesOrders.status} = 'delivered' THEN ${salesOrders.totalAmount} ELSE 0 END::decimal`,
        balance: sql<number>`CASE WHEN ${salesOrders.status} != 'delivered' THEN ${salesOrders.totalAmount} ELSE 0 END::decimal`,
        dueDate: salesOrders.expectedDeliveryDate,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .orderBy(desc(salesOrders.soDate))
      .limit(10);

    const invoices = invoicesData.map((i) => ({
      invoiceNo: i.invoiceNo,
      date: i.invoiceDate,
      invoiceDate: i.invoiceDate,
      totalAmount: Number(i.totalAmount),
      amount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      balance: Number(i.balance),
      dueDate: i.dueDate,
    }));

    // ================================================
    // 10. CREDIT SUMMARY
    // ================================================
    const creditSummary = {
      creditLimit: Number(customer.creditLimit || 0),
      usedCredit: Number(kpis.outstandingBalance),
      availableCredit: Number(customer.creditLimit || 0) - Number(kpis.outstandingBalance),
      avgDelay: Number(kpis.avgPaymentDelay),
      riskLevel: Number(kpis.avgPaymentDelay) > 30 ? 'High' : 
                 Number(kpis.avgPaymentDelay) > 15 ? 'Medium' : 'Low',
    };

    // ================================================
    // 11. CUSTOMER ACTIVITY LOG
    // ================================================
    const activityLogData = await erpDb
      .select({
        id: salesOrders.id,
        action: sql<string>`CASE 
          WHEN ${salesOrders.status} = 'delivered' THEN 'Order Delivered'
          WHEN ${salesOrders.status} = 'cancelled' THEN 'Order Cancelled'
          ELSE 'Order Created'
        END`,
        reference: salesOrders.soNumber,
        amount: salesOrders.totalAmount,
        date: salesOrders.soDate,
        performedBy: salesOrders.createdBy,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .orderBy(desc(salesOrders.soDate))
      .limit(20);

    // Get user names for activity log
    const userIds = [...new Set(activityLogData.map((a) => a.performedBy).filter(Boolean))];
    let usersData: Array<{ id: string; name: string }> = [];
    if (userIds.length > 0) {
      const userResults = await mainDb.execute(
        sql`SELECT id, name FROM users WHERE id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`
      );
      usersData = userResults.map((u: any) => ({ id: u.id, name: u.name }));
    }

    const userMap = new Map(usersData.map((u) => [u.id, u.name]));

    const activityLog = activityLogData.map((a) => ({
      action: a.action,
      reference: a.reference,
      amount: Number(a.amount),
      date: a.date,
      performedBy: a.performedBy ? userMap.get(a.performedBy) || 'Unknown' : 'System',
    }));

    // ================================================
    // 12. AUTO-GENERATED INSIGHTS
    // ================================================
    const insights: string[] = [];
    
    if (kpis.avgPaymentDelay > 30) {
      insights.push('⚠️ High payment delay detected. Average delay is over 30 days.');
    }
    
    const recentRevenue = revenueTrend.slice(-3).reduce((sum, r) => sum + r.revenue, 0);
    const previousRevenue = revenueTrend.slice(-6, -3).reduce((sum, r) => sum + r.revenue, 0);
    if (recentRevenue < previousRevenue * 0.8) {
      insights.push('📉 Revenue declining in recent months. Consider follow-up actions.');
    } else if (recentRevenue > previousRevenue * 1.2) {
      insights.push('📈 Revenue growing significantly! Customer is highly engaged.');
    }
    
    if (kpis.returnRate > 5) {
      insights.push(`⚠️ High return rate: ${kpis.returnRate.toFixed(1)}%. Review product quality.`);
    }

    if (kpis.outstandingBalance > (Number(customer.creditLimit || 0) * 0.8)) {
      insights.push('💳 Credit utilization is high. Consider increasing credit limit or follow up on payments.');
    }

    if (insights.length === 0) {
      insights.push('✅ Customer account is healthy with no major issues detected.');
    }

    // ================================================
    // RETURN COMPLETE CUSTOMER 360 DATA
    // ================================================
    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
        kpis,
        revenueTrend,
        ordersVsRevenue,
        topCategories,
        topProducts,
        paymentStatus,
        paymentDelayTrend,
        recentOrders,
        invoices,
        creditSummary,
        activityLog,
        insights,
      },
    });
  } catch (error) {
    console.error('Failed to fetch customer insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer insights', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}