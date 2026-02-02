import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productSuppliers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// GET /api/erp/inventory/products/[id]/suppliers
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view product suppliers' },
      { status: 403 }
    );
  }

  try {
    const productId = id;

    const suppliers = await erpDb.query.productSuppliers.findMany({
      where: eq(productSuppliers.productId, productId),
      with: {
        supplier: true,
      },
    });

    return NextResponse.json({ suppliers });
  } catch (err: any) {
    console.error('Error fetching product suppliers:', err);
    return NextResponse.json(
      { error: 'Failed to fetch product suppliers' },
      { status: 500 }
    );
  }
}

// POST /api/erp/inventory/products/[id]/suppliers
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to add product suppliers' },
      { status: 403 }
    );
  }

  try {
    const productId = id;
    const body = await req.json();
    const {
      supplierId,
      supplierSku,
      supplierProductName,
      unitPrice,
      minimumOrderQuantity,
      leadTimeDays,
      isPrimary,
      notes,
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    // Check if this product-supplier combination already exists
    const existing = await erpDb.query.productSuppliers.findFirst({
      where: and(
        eq(productSuppliers.productId, productId),
        eq(productSuppliers.supplierId, supplierId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This supplier is already linked to this product' },
        { status: 409 }
      );
    }

    // If this is primary, unset other primary suppliers for this product
    if (isPrimary) {
      await erpDb
        .update(productSuppliers)
        .set({ isPrimary: false })
        .where(eq(productSuppliers.productId, productId));
    }

    const [newProductSupplier] = await erpDb
      .insert(productSuppliers)
      .values({
        productId,
        supplierId,
        supplierSku,
        supplierProductName,
        unitPrice,
        minimumOrderQuantity,
        leadTimeDays,
        isPrimary: isPrimary || false,
        notes,
      })
      .returning();

    // Fetch with relations
    const result = await erpDb.query.productSuppliers.findFirst({
      where: eq(productSuppliers.id, newProductSupplier.id),
      with: {
        supplier: true,
      },
    });

    return NextResponse.json({ productSupplier: result }, { status: 201 });
  } catch (err: any) {
    console.error('Error adding product supplier:', err);
    return NextResponse.json(
      { error: 'Failed to add product supplier' },
      { status: 500 }
    );
  }
}
