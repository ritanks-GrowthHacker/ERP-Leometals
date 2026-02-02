import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { warehouseManagers, warehouseLocations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Check warehouse manager
    const warehouseManager = await erpDb.query.warehouseManagers.findFirst({
      where: eq(warehouseManagers.email, email),
      with: {
        warehouse: true,
      },
    });

    // Check location manager
    const locationManager = await erpDb.execute(sql`
      SELECT wl.*, w.name as warehouse_name, w.erp_organization_id
      FROM warehouse_locations wl
      JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE wl.manager_email = ${email}
      LIMIT 1
    `);

    const locationManagerData = Array.from(locationManager)[0] as any;

    let user: any;
    let managerType: 'warehouse_manager' | 'location_manager';

    if (warehouseManager) {
      // Verify warehouse manager OTP
      if (!warehouseManager.otp || warehouseManager.otp !== otp) {
        return NextResponse.json(
          { error: 'Invalid OTP' },
          { status: 401 }
        );
      }

      // Check if OTP is expired
      if (!warehouseManager.otpExpiresAt || new Date() > new Date(warehouseManager.otpExpiresAt)) {
        return NextResponse.json(
          { error: 'OTP has expired' },
          { status: 401 }
        );
      }

      // Clear OTP and update last login
      await erpDb.update(warehouseManagers)
        .set({
          otp: null,
          otpExpiresAt: null,
          lastLoginAt: new Date(),
        })
        .where(eq(warehouseManagers.id, warehouseManager.id));

      user = {
        id: warehouseManager.id,
        email: warehouseManager.email!,
        name: warehouseManager.name,
        phone: warehouseManager.mobileNumber,
        organizationId: (warehouseManager.warehouse as any)?.erpOrganizationId || '',
        organizationName: (warehouseManager.warehouse as any)?.name || '',
        departmentId: '',
        departmentName: 'Warehouse Management',
        roleId: '',
        role: 'warehouse_manager',
        warehouseId: warehouseManager.warehouseId,
        isWarehouseManager: true,
        managerType: 'warehouse_manager',
      };
      managerType = 'warehouse_manager';
    } else if (locationManagerData) {
      // Verify location manager OTP
      if (!locationManagerData.otp || locationManagerData.otp !== otp) {
        return NextResponse.json(
          { error: 'Invalid OTP' },
          { status: 401 }
        );
      }

      // Check if OTP is expired
      if (!locationManagerData.otp_expires_at || new Date() > new Date(locationManagerData.otp_expires_at)) {
        return NextResponse.json(
          { error: 'OTP has expired' },
          { status: 401 }
        );
      }

      // Clear OTP and update last login
      await erpDb.execute(sql`
        UPDATE warehouse_locations
        SET otp = NULL, otp_expires_at = NULL, last_login_at = NOW()
        WHERE id = ${locationManagerData.id}
      `);

      user = {
        id: locationManagerData.id,
        email: locationManagerData.manager_email!,
        name: locationManagerData.manager_name || 'Location Manager',
        phone: locationManagerData.manager_mobile,
        organizationId: locationManagerData.erp_organization_id || '',
        organizationName: locationManagerData.warehouse_name || '',
        departmentId: '',
        departmentName: 'Location Management',
        roleId: '',
        role: 'location_manager',
        warehouseId: locationManagerData.warehouse_id,
        warehouseLocationId: locationManagerData.id,
        isWarehouseManager: true,
        managerType: 'location_manager',
      };
      managerType = 'location_manager';
    } else {
      return NextResponse.json(
        { error: 'Email not found in our records' },
        { status: 404 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      success: true,
      token,
      user,
      managerType,
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP', details: error.message },
      { status: 500 }
    );
  }
}
