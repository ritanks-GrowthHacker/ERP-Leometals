import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { suppliers } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

// POST /api/supplier-portal/auth/verify-otp
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { supplierId, email, otp } = body;

    console.log('=== OTP Verification Debug ===');
    console.log('Received supplierId:', supplierId);
    console.log('Received email:', email);
    console.log('Received OTP:', otp);

    if ((!supplierId && !email) || !otp) {
      return NextResponse.json(
        { error: 'Supplier ID/Email and OTP are required' },
        { status: 400 }
      );
    }

    // Trim and normalize OTP
    const normalizedOtp = otp.toString().trim();

    // First, find the supplier to check their stored OTP
    const supplierLookup = email
      ? await erpDb.query.suppliers.findFirst({
          where: eq(suppliers.email, email.toLowerCase()),
        })
      : await erpDb.query.suppliers.findFirst({
          where: eq(suppliers.id, supplierId),
        });

    console.log('Found supplier:', supplierLookup?.id);
    console.log('Stored OTP:', supplierLookup?.otp);
    console.log('OTP Expires At:', supplierLookup?.otpExpiresAt);
    console.log('Current Time:', new Date());

    // Find supplier with valid OTP
    const whereClause = email
      ? and(
          eq(suppliers.email, email.toLowerCase()),
          eq(suppliers.otp, normalizedOtp),
          gt(suppliers.otpExpiresAt, new Date())
        )
      : and(
          eq(suppliers.id, supplierId),
          eq(suppliers.otp, normalizedOtp),
          gt(suppliers.otpExpiresAt, new Date())
        );

    const supplier = await erpDb.query.suppliers.findFirst({
      where: whereClause,
    });

    if (!supplier) {
      console.log('OTP verification failed - no matching supplier found');
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 401 }
      );
    }

    console.log('OTP verification successful for supplier:', supplier.id);

    // Clear OTP and update last login
    await erpDb
      .update(suppliers)
      .set({
        otp: null,
        otpExpiresAt: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplier.id));

    // Generate JWT token for supplier portal
    const token = await new SignJWT({
      supplierId: supplier.id,
      supplierCode: supplier.code,
      supplierName: supplier.name,
      email: supplier.email,
      type: 'supplier',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        country: supplier.country,
        postalCode: supplier.postalCode,
        profileImage: supplier.profileImage,
      },
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
