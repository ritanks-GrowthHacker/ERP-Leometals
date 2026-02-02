import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouseManagers, warehouseLocations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';

// Create nodemailer transporter (same config as existing email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rihina.techorzo@gmail.com',
    pass: 'wdufgyawvizccnwc',
  },
});

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if email belongs to a warehouse manager
    const warehouseManager = await erpDb.query.warehouseManagers.findFirst({
      where: eq(warehouseManagers.email, email),
      with: {
        warehouse: true,
      },
    });

    // Check if email belongs to a warehouse location manager
    const locationManager = await erpDb.execute(sql`
      SELECT wl.id, wl.warehouse_id, wl.name, wl.manager_email, w.name as warehouse_name
      FROM warehouse_locations wl
      JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE wl.manager_email = ${email}
      LIMIT 1
    `);

    const locationManagerData = Array.from(locationManager)[0] as any;

    if (!warehouseManager && !locationManagerData) {
      return NextResponse.json(
        { error: 'Email not found in our records' },
        { status: 404 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP directly in the manager table
    if (warehouseManager) {
      // Update warehouse_managers table with OTP
      await erpDb.update(warehouseManagers)
        .set({
          otp: otp,
          otpExpiresAt: expiresAt,
        })
        .where(eq(warehouseManagers.id, warehouseManager.id));
    } else if (locationManagerData) {
      // Update warehouse_locations table with OTP
      await erpDb.execute(sql`
        UPDATE warehouse_locations
        SET otp = ${otp}, otp_expires_at = ${expiresAt}
        WHERE id = ${locationManagerData.id}
      `);
    }

    // Send OTP email
    const managerName = warehouseManager?.name || locationManagerData?.name || 'Manager';
    const warehouseName = (warehouseManager?.warehouse as any)?.name || locationManagerData?.warehouse_name || 'Warehouse';

    await transporter.sendMail({
      from: 'rihina.techorzo@gmail.com',
      to: email,
      subject: 'Your OTP for Warehouse Manager Login',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1E40AF;">Warehouse Manager Login</h2>
          <p>Hello ${managerName},</p>
          <p>Your OTP for logging into <strong>${warehouseName}</strong> is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px;">⏰ This OTP will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 14px;">🔒 If you didn't request this OTP, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} ERP System. All rights reserved.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email',
      managerType: warehouseManager ? 'warehouse_manager' : 'location_manager',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP', details: error.message },
      { status: 500 }
    );
  }
}
