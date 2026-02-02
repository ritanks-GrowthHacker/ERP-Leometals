import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { erpDb as db } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sendDeliveryAssignmentEmail, sendDeliveryOTPEmail } from '@/lib/emailServices';
import crypto from 'crypto';

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { id: salesOrderId } = await context.params;
    
    const { user, error } = await requireErpAccess(request);
    if (error) return error;
    
    if (!hasPermission(user, 'sales', 'edit')) {
      return NextResponse.json(
        { message: 'No permission to assign delivery' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      deliveryPartnerName,
      deliveryPartnerMobile,
      deliveryPartnerEmail,
      pickupAddress,
      deliveryAddress,
      receiverMobile,
      receiverEmail,
      specialInstructions,
    } = body;

    // Validate required fields
    if (
      !deliveryPartnerName ||
      !deliveryPartnerMobile ||
      !deliveryPartnerEmail ||
      !receiverMobile ||
      !receiverEmail
    ) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if sales order exists and belongs to the organization
    const salesOrderQuery = await db.execute(sql`
      SELECT 
        so.id,
        so.so_number,
        so.shipping_address,
        so.status,
        c.name as customer_name,
        c.email as customer_email,
        w.name as warehouse_name,
        w.address as warehouse_address
       FROM sales_orders so
       LEFT JOIN warehouses w ON so.warehouse_id = w.id
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.id = ${salesOrderId} AND so.erp_organization_id = ${user.erpOrganizationId}
    `);

    const salesOrderResult = Array.from(salesOrderQuery);
    if (salesOrderResult.length === 0) {
      return NextResponse.json(
        { message: 'Sales order not found' },
        { status: 404 }
      );
    }

    const salesOrder = salesOrderResult[0] as any;

    // Check if delivery is already assigned
    const existingDeliveryQuery = await db.execute(sql`
      SELECT id FROM delivery_assignments WHERE sales_order_id = ${salesOrderId}
    `);

    const existingDeliveryResult = Array.from(existingDeliveryQuery);
    if (existingDeliveryResult.length > 0) {
      return NextResponse.json(
        { message: 'Delivery partner already assigned to this order' },
        { status: 400 }
      );
    }

    // Generate OTP (6-digit)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate unique delivery token
    const tokenPayload = {
      salesOrderId,
      deliveryPartnerEmail,
      timestamp: Date.now(),
      random: crypto.randomBytes(16).toString('hex'),
    };
    const deliveryToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    // Calculate expiry times
    const otpExpiresAt = new Date();
    otpExpiresAt.setHours(otpExpiresAt.getHours() + 24); // OTP valid for 24 hours

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Token valid for 7 days

    // Final addresses
    const finalPickupAddress = pickupAddress || salesOrder.warehouse_address || 'N/A';
    const finalDeliveryAddress = deliveryAddress || salesOrder.shipping_address || 'N/A';

    // Insert delivery assignment
    const insertQuery = await db.execute(sql`
      INSERT INTO delivery_assignments (
        erp_organization_id,
        sales_order_id,
        delivery_partner_name,
        delivery_partner_mobile,
        delivery_partner_email,
        pickup_address,
        delivery_address,
        receiver_mobile,
        receiver_email,
        delivery_otp,
        otp_generated_at,
        otp_expires_at,
        delivery_token,
        token_expires_at,
        special_instructions,
        status,
        created_by
      ) VALUES (
        ${user.erpOrganizationId},
        ${salesOrderId},
        ${deliveryPartnerName},
        ${deliveryPartnerMobile},
        ${deliveryPartnerEmail},
        ${finalPickupAddress},
        ${finalDeliveryAddress},
        ${receiverMobile},
        ${receiverEmail},
        ${otp},
        NOW(),
        ${otpExpiresAt.toISOString()},
        ${deliveryToken},
        ${tokenExpiresAt.toISOString()},
        ${specialInstructions || null},
        'pending',
        ${user.id}
      )
      RETURNING id
    `);

    const insertResult = Array.from(insertQuery);
    const deliveryAssignmentId = (insertResult[0] as any).id;

    // Log status change
    await db.execute(sql`
      INSERT INTO delivery_status_logs (
        delivery_assignment_id,
        old_status,
        new_status,
        changed_by,
        notes
      ) VALUES (${deliveryAssignmentId}, NULL, 'pending', 'erp_user', 'Delivery partner assigned')
    `);

    // Send emails
    const deliveryLink = `${process.env.NEXT_PUBLIC_APP_URL}/delivery/${deliveryToken}`;
    
    try {
      // Send email to delivery partner
      await sendDeliveryAssignmentEmail({
        deliveryPartnerName,
        deliveryPartnerEmail,
        orderNumber: salesOrder.so_number,
        customerName: salesOrder.customer_name,
        pickupAddress: finalPickupAddress,
        deliveryAddress: finalDeliveryAddress,
        deliveryLink,
        specialInstructions,
      });

      // Send OTP to receiver
      await sendDeliveryOTPEmail({
        receiverEmail,
        receiverMobile,
        otp,
        orderNumber: salesOrder.so_number,
        expiresAt: otpExpiresAt.toLocaleString(),
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails
    }

    // ✅ REDUCE STOCK NOW - Call the reduce-items endpoint
    console.log('🔥 Calling reduce-items API to reduce stock...');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const reduceResponse = await fetch(`${baseUrl}/api/erp/sales/orders/${salesOrderId}/reduce-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
      });

      if (reduceResponse.ok) {
        const reduceData = await reduceResponse.json();
        console.log('✅ Stock reduced successfully:', reduceData);
      } else {
        const reduceError = await reduceResponse.json();
        console.error('❌ Failed to reduce stock:', reduceError);
        // Don't fail the delivery assignment if stock reduction fails
      }
    } catch (reduceError) {
      console.error('❌ Error calling reduce-items API:', reduceError);
      // Don't fail the delivery assignment if stock reduction fails
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery partner assigned successfully! Emails have been sent.',
      deliveryAssignmentId,
    });
  } catch (error) {
    console.error('Error assigning delivery partner:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
