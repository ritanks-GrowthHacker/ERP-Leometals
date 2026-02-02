import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Sales analytics for this warehouse
    const salesAnalytics = await erpDb.execute(sql`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales_value,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders
      FROM sales_orders
      WHERE warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND so_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND so_date <= ${endDate}` : sql``}
    `);

    // Invoice analytics
    const invoiceAnalytics = await erpDb.execute(sql`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(i.total_amount) as total_invoiced,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_invoices
      FROM sales_invoices i
      INNER JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE so.warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND i.invoice_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND i.invoice_date <= ${endDate}` : sql``}
    `);

    // Top customers by order count
    const topCustomers = await erpDb.execute(sql`
      SELECT 
        c.name as customer_name,
        COUNT(so.id) as order_count,
        SUM(so.total_amount) as total_value
      FROM customers c
      INNER JOIN sales_orders so ON c.id = so.customer_id
      WHERE so.warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND so.so_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND so.so_date <= ${endDate}` : sql``}
      GROUP BY c.id, c.name
      ORDER BY order_count DESC
      LIMIT 10
    `);

    // Top selling products in this warehouse
    const topProducts = await erpDb.execute(sql`
      SELECT 
        p.name as product_name,
        p.sku,
        SUM(sol.quantity) as total_quantity,
        SUM(sol.subtotal) as total_revenue
      FROM products p
      INNER JOIN sales_order_lines sol ON p.id = sol.product_id
      INNER JOIN sales_orders so ON sol.sales_order_id = so.id
      WHERE so.warehouse_id = ${user.warehouseId}
        ${startDate ? sql`AND so.so_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND so.so_date <= ${endDate}` : sql``}
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    return NextResponse.json({
      salesAnalytics: (salesAnalytics as any)[0],
      invoiceAnalytics: (invoiceAnalytics as any)[0],
      topCustomers: Array.from(topCustomers),
      topProducts: Array.from(topProducts),
    });
  } catch (error: any) {
    console.error('Error fetching sales analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales analytics', details: error.message },
      { status: 500 }
    );
  }
}
