import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouses, warehouseManagers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expiresAt: number; warehouseId: string; productId: string }>();

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/erp/inventory/restock/send-otp
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to restock inventory' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { warehouseId, productId, productName } = body;

    if (!warehouseId || !productId) {
      return NextResponse.json(
        { error: 'Warehouse ID and Product ID are required' },
        { status: 400 }
      );
    }

    // Get warehouse details with manager email
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
      with: {
        manager: true,
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    if (!warehouse.email) {
      return NextResponse.json(
        { error: 'Warehouse email not configured. Please add warehouse email to settings.' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    const otpKey = `${warehouseId}-${productId}-${user.id}`;
    otpStore.set(otpKey, { otp, expiresAt, warehouseId, productId });

    // Clean up expired OTPs
    for (const [key, value] of otpStore.entries()) {
      if (value.expiresAt < Date.now()) {
        otpStore.delete(key);
      }
    }

    // Send OTP email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restock Authorization OTP</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 Restock Authorization</h1>
            <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Digital Signature Required</p>
          </div>

          <!-- OTP Section -->
          <div style="padding: 40px 30px; text-align: center;">
            <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <p style="margin: 0 0 10px 0; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
              <div style="font-size: 48px; font-weight: bold; color: #059669; letter-spacing: 8px; font-family: monospace;">
                ${otp}
              </div>
            </div>

            <!-- Details -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: left;">
              <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Restock Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Warehouse:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${warehouse.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Product:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${productName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Requested By:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${user.name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valid Until:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${new Date(expiresAt).toLocaleTimeString('en-IN')}</td>
                </tr>
              </table>
            </div>

            <!-- Warning -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; text-align: left;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> This OTP is valid for 10 minutes. Do not share this code with anyone.
              </p>
            </div>

            <!-- Instructions -->
            <div style="text-align: left;">
              <p style="color: #4b5563; font-size: 14px; margin: 10px 0;">
                Enter this OTP in the restock form to authorize the inventory movement. This digital signature confirms your approval for restocking operations.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              This is an automated message from your ERP system. If you did not request this OTP, please contact your system administrator immediately.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: warehouse.email,
      subject: 'Restock Authorization OTP - Digital Signature Required',
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP sent to warehouse email',
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/erp/inventory/restock/verify-otp
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { warehouseId, productId, otp } = body;

    if (!warehouseId || !productId || !otp) {
      return NextResponse.json(
        { error: 'Warehouse ID, Product ID, and OTP are required' },
        { status: 400 }
      );
    }

    // Verify OTP
    const otpKey = `${warehouseId}-${productId}-${user.id}`;
    const storedOTP = otpStore.get(otpKey);

    if (!storedOTP) {
      return NextResponse.json(
        { error: 'OTP not found or expired. Please request a new OTP.' },
        { status: 400 }
      );
    }

    if (storedOTP.expiresAt < Date.now()) {
      otpStore.delete(otpKey);
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new OTP.' },
        { status: 400 }
      );
    }

    if (storedOTP.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      );
    }

    // OTP verified successfully - remove it from store
    otpStore.delete(otpKey);

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP', details: error.message },
      { status: 500 }
    );
  }
}
