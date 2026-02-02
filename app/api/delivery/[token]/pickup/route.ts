import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { erpDb as db } from '@/lib/db';

interface Params {
  token: string;
}

export async function POST(
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
        da.status,
        da.token_expires_at,
        da.token_used
       FROM delivery_assignments da
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
        { message: 'This delivery has been completed' },
        { status: 400 }
      );
    }

    // Check current status
    if (delivery.status !== 'pending') {
      return NextResponse.json(
        { message: 'Order has already been picked up' },
        { status: 400 }
      );
    }

    // Update delivery assignment status to picked_up
    await db.execute(sql`
      UPDATE delivery_assignments 
       SET status = 'picked_up',
           picked_up_at = NOW(),
           updated_at = NOW()
       WHERE id = ${delivery.id}
    `);

    // Update sales order status to 'in_progress' and delivery status
    await db.execute(sql`
      UPDATE sales_orders 
       SET status = 'in_progress',
           delivery_status = 'picked_up',
           delivery_picked_up_at = NOW()
       WHERE id = ${delivery.sales_order_id}
    `);

    // Log status change
    await db.execute(sql`
      INSERT INTO delivery_status_logs (
        delivery_assignment_id,
        old_status,
        new_status,
        changed_by,
        notes
      ) VALUES (${delivery.id}, 'pending', 'picked_up', 'delivery_partner', 'Order picked up from warehouse')
    `);

    return NextResponse.json({
      success: true,
      message: 'Order marked as picked up successfully!',
    });
  } catch (error) {
    console.error('Error marking order as picked up:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
