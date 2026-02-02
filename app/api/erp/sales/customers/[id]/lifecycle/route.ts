import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/sales/customers/[id]/lifecycle
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    const { id: customerId } = await params;

    // Fetch customer details
    const customerResult = await erpDb.execute(sql`
      SELECT 
        c.id,
        c.name,
        c.code,
        c.email,
        c.phone,
        c.city,
        c.state,
        c.country,
        c.is_active,
        c.payment_terms,
        c.created_at
      FROM customers c
      WHERE c.id = ${customerId}
        AND c.erp_organization_id = ${user.erpOrganizationId}
    `);

    const customers = Array.from(customerResult);
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer: any = customers[0];

    // Fetch all sales orders for this customer
    const ordersResult = await erpDb.execute(sql`
      SELECT 
        so.id,
        so.so_number,
        so.so_date::text as order_date,
        so.status,
        so.total_amount,
        so.created_at::text as created_at
      FROM sales_orders so
      WHERE so.customer_id = ${customerId}
        AND so.erp_organization_id = ${user.erpOrganizationId}
      ORDER BY so.so_date DESC
    `);

    const orders = Array.from(ordersResult);

    // Get first order
    const firstOrder = orders.length > 0 ? orders[orders.length - 1] : null;

    // Calculate total revenue
    const totalRevenue = orders.reduce((sum: number, order: any) => {
      return sum + parseFloat(order.total_amount || 0);
    }, 0);

    // Get revenue timeline (last 10 orders)
    const revenueTimeline = orders.slice(0, 10).map((order: any) => ({
      order_date: order.order_date,
      total_amount: order.total_amount,
      so_number: order.so_number,
    }));

    // Build lifecycle data
    const lifecycle = {
      created: {
        completed: true,
        timestamp: customer.created_at,
        description: `Customer created on ${new Date(customer.created_at as string).toLocaleDateString()}`,
      },
      first_order: {
        completed: !!firstOrder,
        timestamp: firstOrder?.order_date || null,
        description: firstOrder
          ? `First order ${firstOrder.so_number} placed on ${new Date(firstOrder.order_date as string).toLocaleDateString()}`
          : 'No orders placed yet',
      },
      orders_count: {
        completed: orders.length > 0,
        timestamp: firstOrder?.order_date || null,
        description: orders.length > 0
          ? `${orders.length} total orders placed`
          : 'No orders placed yet',
      },
      revenue: {
        completed: totalRevenue > 0,
        timestamp: firstOrder?.order_date || null,
        description: totalRevenue > 0
          ? `Total revenue: ₹${totalRevenue.toLocaleString('en-IN')}`
          : 'No revenue generated yet',
      },
      customer_details: {
        completed: customer.is_active,
        timestamp: customer.created_at,
        description: customer.is_active
          ? 'Customer is active'
          : 'Customer is inactive',
      },
    };

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        code: customer.code,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        is_active: customer.is_active,
        payment_terms: customer.payment_terms,
      },
      orders: orders.map((o: any) => ({
        id: o.id,
        so_number: o.so_number,
        order_date: o.order_date,
        status: o.status,
        total_amount: o.total_amount,
      })),
      firstOrder: firstOrder
        ? {
            so_number: firstOrder.so_number,
            order_date: firstOrder.order_date,
            total_amount: firstOrder.total_amount,
          }
        : null,
      totalRevenue,
      revenueTimeline,
      lifecycle,
    });
  } catch (error: any) {
    console.error('Error fetching customer lifecycle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer lifecycle' },
      { status: 500 }
    );
  }
}
