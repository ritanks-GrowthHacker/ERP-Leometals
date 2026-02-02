import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "rihina.techorzo@gmail.com",
    pass: "wdufgyawvizccnwc",
  },
});

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mailOptions = {
      from: "rihina.techorzo@gmail.com",
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html || "",
    };

    const response = await transporter.sendMail(mailOptions);

    console.log("Email sent:", response.messageId);
    return { 
      success: true, 
      messageId: response.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Delivery Module Email Functions

interface DeliveryAssignmentEmailData {
  deliveryPartnerName: string;
  deliveryPartnerEmail: string;
  orderNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryLink: string;
  specialInstructions?: string;
}

interface DeliveryOTPEmailData {
  receiverEmail: string;
  receiverMobile: string;
  otp: string;
  orderNumber: string;
  expiresAt: string;
}

export async function sendDeliveryAssignmentEmail(data: DeliveryAssignmentEmailData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Assignment</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📦 Delivery Assignment</h1>
          <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">New Order for Delivery</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0;">Hello ${data.deliveryPartnerName},</h3>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            You have been assigned a new delivery. Please review the details below and proceed with the pickup.
          </p>

          <!-- Order Details -->
          <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 15px 0; color: #1f2937;">Order Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Order Number:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${data.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${data.customerName}</td>
              </tr>
            </table>
          </div>

          <!-- Addresses -->
          <div style="margin-bottom: 25px;">
            <div style="background-color: #dbeafe; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
              <h5 style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px;">📍 Pickup Address</h5>
              <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${data.pickupAddress}</p>
            </div>
            <div style="background-color: #fef3c7; border-radius: 6px; padding: 15px;">
              <h5 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">🎯 Delivery Address</h5>
              <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${data.deliveryAddress}</p>
            </div>
          </div>

          ${data.specialInstructions ? `
          <div style="background-color: #fef9c3; border-left: 4px solid #eab308; padding: 15px; margin-bottom: 25px;">
            <h5 style="margin: 0 0 10px 0; color: #854d0e;">⚠️ Special Instructions</h5>
            <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${data.specialInstructions}</p>
          </div>
          ` : ''}

          <!-- Important Notes -->
          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 25px;">
            <h5 style="margin: 0 0 10px 0; color: #991b1b;">Important Notes</h5>
            <ul style="margin: 0; padding-left: 20px; color: #1f2937; font-size: 14px; line-height: 1.6;">
              <li>Use the link below to access your delivery portal</li>
              <li>Mark the order as "Picked Up" when you collect it</li>
              <li>Ask the receiver for the OTP when delivering</li>
              <li>This link will expire after 7 days or once delivery is completed</li>
            </ul>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.deliveryLink}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Access Delivery Portal
            </a>
          </div>

          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 25px;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${data.deliveryLink}" style="color: #10b981; word-break: break-all;">${data.deliveryLink}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.deliveryPartnerEmail,
    subject: `🚚 Delivery Assignment - Order ${data.orderNumber}`,
    html,
  });
}

export async function sendDeliveryOTPEmail(data: DeliveryOTPEmailData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery OTP</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 Delivery OTP</h1>
          <p style="color: #ede9fe; margin: 10px 0 0 0; font-size: 16px;">Your Order Verification Code</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            Your order <strong>${data.orderNumber}</strong> is out for delivery. Please use this OTP to verify delivery with the delivery partner.
          </p>

          <!-- OTP Display -->
          <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 25px;">
            <p style="color: #78350f; margin: 0 0 10px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
            <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 15px 0;">
              <p style="margin: 0; font-size: 42px; font-weight: bold; color: #1f2937; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${data.otp}
              </p>
            </div>
            <p style="color: #78350f; margin: 10px 0 0 0; font-size: 12px;">
              Valid until: ${data.expiresAt}
            </p>
          </div>

          <!-- Instructions -->
          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px;">
            <h5 style="margin: 0 0 10px 0; color: #1e40af;">📋 Instructions</h5>
            <ol style="margin: 0; padding-left: 20px; color: #1f2937; font-size: 14px; line-height: 1.8;">
              <li>The delivery partner will ask for this OTP</li>
              <li>Verify the order details before sharing the OTP</li>
              <li>Do not share this OTP with anyone else</li>
              <li>Once verified, your order will be marked as delivered</li>
            </ol>
          </div>

          <!-- Warning -->
          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px;">
            <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
              ⚠️ <strong>Security Notice:</strong> This OTP is confidential. Only share it with the delivery partner at the time of delivery. If you did not place this order, please contact us immediately.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 25px;">
            Contact: ${data.receiverMobile}
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.receiverEmail,
    subject: `🔐 Delivery OTP for Order ${data.orderNumber}`,
    html,
  });
}

// Warehouse Allocation Email Function

interface WarehouseAllocationEmailData {
  managerEmail: string;
  warehouseName: string;
  salesOrderNumber: string;
  quotationNumber: string;
  allocations: Array<{
    locationName: string;
    productId: string;
    quantity: string;
  }>;
}

export async function sendWarehouseAllocationEmail(data: WarehouseAllocationEmailData) {
  const allocationsRows = data.allocations
    .map(
      (allocation) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">
            ${allocation.locationName}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">
            ${allocation.productId}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <strong>${allocation.quantity}</strong>
          </td>
        </tr>
      `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 650px; margin: 30px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
            🏭 Warehouse Allocation Notice
          </h1>
          <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 15px;">
            Products Reserved for Sales Order
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 35px 30px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Dear Warehouse Manager,
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Products from <strong style="color: #2563eb;">${data.warehouseName}</strong> have been automatically allocated to a new sales order created from an accepted quotation.
          </p>

          <!-- Order Details Box -->
          <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Sales Order Number:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">
                  ${data.salesOrderNumber}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From Quotation:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">
                  ${data.quotationNumber}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Warehouse:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">
                  ${data.warehouseName}
                </td>
              </tr>
            </table>
          </div>

          <!-- Allocated Products Table -->
          <h3 style="color: #111827; font-size: 18px; margin: 30px 0 15px 0; font-weight: 600;">
            📦 Allocated Products:
          </h3>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                  Location
                </th>
                <th style="padding: 12px; text-align: left; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                  Product ID
                </th>
                <th style="padding: 12px; text-align: center; color: #374151; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                  Quantity Reserved
                </th>
              </tr>
            </thead>
            <tbody>
              ${allocationsRows}
            </tbody>
          </table>

          <!-- Action Box -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 18px; margin: 25px 0; border-radius: 8px;">
            <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
              <strong>⚠️ Action Required:</strong> Please ensure the allocated products are prepared and ready for order fulfillment. Stock will be automatically deducted when the delivery partner is assigned.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
            Thank you for your prompt attention to this matter.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated notification from your ERP system.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.managerEmail,
    subject: `🏭 Warehouse Allocation: ${data.salesOrderNumber} - ${data.warehouseName}`,
    html,
  });
}
