import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { suppliers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/supplier-portal/auth/send-otp
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, supplierId } = body;

    if (!email && !supplierId) {
      return NextResponse.json(
        { error: 'Email or Supplier ID is required' },
        { status: 400 }
      );
    }

    // Find supplier by email or ID
    const whereClause = email 
      ? eq(suppliers.email, email.toLowerCase())
      : eq(suppliers.id, supplierId);

    const supplier = await erpDb.query.suppliers.findFirst({
      where: whereClause,
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    if (!supplier.isActive) {
      return NextResponse.json(
        { error: 'Supplier account is inactive' },
        { status: 403 }
      );
    }

    if (!supplier.email) {
      return NextResponse.json(
        { error: 'Supplier email not configured' },
        { status: 400 }
      );
    }

    // Generate OTP and set expiration (10 minutes)
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update supplier with OTP
    await erpDb
      .update(suppliers)
      .set({
        otp,
        otpExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplier.id));

    // Send OTP via email
    const emailSent = await sendEmail({
      to: supplier.email,
      subject: 'Supplier Portal - OTP Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔐 Supplier Portal Access</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${supplier.name}</strong>,</p>
              <p>You have requested access to the Supplier Portal. Use the following OTP to authenticate:</p>
              
              <div class="otp-box">
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Your One-Time Password</div>
                <div class="otp-code">${otp}</div>
                <div style="color: #999; font-size: 12px; margin-top: 10px;">Valid for 10 minutes</div>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
              </div>

              <p>If you didn't request this OTP, please ignore this email or contact support if you have concerns.</p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>ERP System Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} ERP System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send OTP email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully to your email',
      supplierId: supplier.id,
      email: supplier.email,
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
