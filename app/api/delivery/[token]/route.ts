import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { erpDb as db } from '@/lib/db';

interface Params {
  token: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { token: deliveryToken } = await context.params;

    // Get delivery assignment by token
    const deliveryQuery = await db.execute(sql`
      SELECT 
        da.id,
        da.sales_order_id,
        da.delivery_partner_name,
        da.delivery_partner_email,
        da.delivery_partner_mobile,
        da.pickup_address,
        da.delivery_address,
        da.receiver_mobile,
        da.receiver_email,
        da.status,
        da.special_instructions,
        da.token_expires_at,
        da.token_used,
        da.assigned_at,
        da.picked_up_at,
        da.delivered_at,
        so.so_number,
        c.name as customer_name,
        so.total_amount,
        so.so_date
       FROM delivery_assignments da
       JOIN sales_orders so ON da.sales_order_id = so.id
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE da.delivery_token = ${deliveryToken}
    `);

    const deliveryResult = Array.from(deliveryQuery);
    if (deliveryResult.length === 0) {
      return NextResponse.json(
        { message: 'Invalid delivery link' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult[0] as any;

    // Check if token is expired
    const now = new Date();
    const tokenExpiry = new Date(delivery.token_expires_at);
    
    if (now > tokenExpiry) {
      return NextResponse.json(
        { message: 'Delivery link has expired' },
        { status: 410 }
      );
    }

    // Check if token is already used
    if (delivery.token_used) {
      return NextResponse.json(
        { message: 'This delivery has been completed and the link is no longer valid' },
        { status: 410 }
      );
    }

    // Get delivery items
    const itemsQuery = await db.execute(sql`
      SELECT 
        p.name as product_name,
        sol.quantity_ordered as quantity,
        sol.unit_price,
        (sol.quantity_ordered::numeric * sol.unit_price::numeric * (1 + COALESCE(sol.tax_rate, 0)::numeric / 100)) as total_price
       FROM sales_order_lines sol
       JOIN products p ON sol.product_id = p.id
       WHERE sol.sales_order_id = ${delivery.sales_order_id}
       ORDER BY p.name
    `);

    const itemsResult = Array.from(itemsQuery);

    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        orderNumber: delivery.so_number,
        customerName: delivery.customer_name,
        orderDate: delivery.order_date,
        totalAmount: delivery.total_amount,
        status: delivery.status,
        pickupAddress: delivery.pickup_address,
        deliveryAddress: delivery.delivery_address,
        receiverMobile: delivery.receiver_mobile,
        receiverEmail: delivery.receiver_email,
        specialInstructions: delivery.special_instructions,
        assignedAt: delivery.assigned_at,
        pickedUpAt: delivery.picked_up_at,
        deliveredAt: delivery.delivered_at,
        items: itemsResult,
      },
    });
  } catch (error) {
    console.error('Error fetching delivery details:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
