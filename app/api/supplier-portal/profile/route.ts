import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { suppliers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifySupplierToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.type !== 'supplier') {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

// GET /api/supplier-portal/profile
export async function GET(req: NextRequest) {
  const supplier = await verifySupplierToken(req);
  
  if (!supplier) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supplierData = await erpDb.query.suppliers.findFirst({
      where: eq(suppliers.id, supplier.supplierId as string),
      with: {
        contacts: true,
      },
    });

    if (!supplierData) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      supplier: {
        id: supplierData.id,
        name: supplierData.name,
        code: supplierData.code,
        email: supplierData.email,
        phone: supplierData.phone,
        website: supplierData.website,
        address: supplierData.address,
        city: supplierData.city,
        state: supplierData.state,
        country: supplierData.country,
        postalCode: supplierData.postalCode,
        taxId: supplierData.taxId,
        profileImage: supplierData.profileImage,
        paymentTerms: supplierData.paymentTerms,
        currencyCode: supplierData.currencyCode,
        contacts: supplierData.contacts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching supplier profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/supplier-portal/profile
export async function PUT(req: NextRequest) {
  const supplier = await verifySupplierToken(req);
  
  if (!supplier) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { phone, address, city, state, country, postalCode, profileImage, website } = body;

    // Update supplier profile
    const [updated] = await erpDb
      .update(suppliers)
      .set({
        phone: phone || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        postalCode: postalCode || undefined,
        profileImage: profileImage || undefined,
        website: website || undefined,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplier.supplierId as string))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      supplier: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        email: updated.email,
        phone: updated.phone,
        website: updated.website,
        address: updated.address,
        city: updated.city,
        state: updated.state,
        country: updated.country,
        postalCode: updated.postalCode,
        profileImage: updated.profileImage,
      },
    });
  } catch (error: any) {
    console.error('Error updating supplier profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
