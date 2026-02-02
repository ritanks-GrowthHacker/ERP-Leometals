import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { products, stockLevels, warehouses } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/erp/inventory/products/[id]/lifecycle
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req);
  if (error || !user) return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view products' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Verify product exists and belongs to user's organization
    const product = await erpDb.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const productName = product.name;
    const productSku = product.sku;
    const productReorderPoint = parseFloat(product.reorderPoint || '0');
    const productReorderQuantity = parseFloat(product.reorderQuantity || '0');

    // Fetch warehouse stock levels using Drizzle ORM
    const warehouseStockLevels = await erpDb
      .select({
        id: warehouses.id,
        name: warehouses.name,
        code: warehouses.code,
        quantityOnHand: stockLevels.quantityOnHand,
        quantityReserved: stockLevels.quantityReserved,
        reorderPoint: products.reorderPoint,
        lastUpdated: stockLevels.updatedAt,
      })
      .from(stockLevels)
      .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
      .innerJoin(products, eq(stockLevels.productId, products.id))
      .where(
        and(
          eq(stockLevels.productId, id),
          eq(warehouses.erpOrganizationId, user.erpOrganizationId)
        )
      )
      .orderBy(desc(stockLevels.updatedAt));

    // Calculate available quantity for each warehouse
    const warehouseData = warehouseStockLevels.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      quantityOnHand: parseFloat(item.quantityOnHand || '0'),
      quantityReserved: parseFloat(item.quantityReserved || '0'),
      quantityAvailable: 
        parseFloat(item.quantityOnHand || '0') - 
        parseFloat(item.quantityReserved || '0'),
      reorderPoint: parseFloat(item.reorderPoint || '0'),
      lastUpdated: item.lastUpdated,
    }));

    // Calculate total inventory across all warehouses
    const totalOnHand = warehouseData.reduce(
      (sum, wh) => sum + wh.quantityOnHand, 
      0
    );
    const totalReserved = warehouseData.reduce(
      (sum, wh) => sum + wh.quantityReserved, 
      0
    );
    const totalAvailable = totalOnHand - totalReserved;

    return NextResponse.json({
      productId: id,
      productName,
      productSku,
      summary: {
        totalOnHand,
        totalReserved,
        totalAvailable,
        reorderPoint: productReorderPoint,
        reorderQuantity: productReorderQuantity,
      },
      warehouses: warehouseData,
    });
  } catch (err: any) {
    console.error('Error fetching product lifecycle:', err);
    return NextResponse.json(
      { error: 'Failed to fetch product lifecycle data' },
      { status: 500 }
    );
  }
}

// PUT /api/erp/inventory/products/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req);
  if (error || !user) return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit products' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();

    // Verify product exists and belongs to user's organization
    const existingProduct = await erpDb.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Clean up data - convert empty strings to null for UUID fields
    const cleanedBody = {
      ...body,
      productCategoryId: body.productCategoryId === '' ? null : body.productCategoryId,
      productSubCategoryId: body.productSubCategoryId === '' ? null : body.productSubCategoryId,
      uomId: body.uomId === '' ? null : body.uomId,
      purchaseUomId: body.purchaseUomId === '' ? null : body.purchaseUomId,
      saleUomId: body.saleUomId === '' ? null : body.saleUomId,
      unitOfMeasure: body.unitOfMeasure === '' ? null : body.unitOfMeasure,
      unitWeight: body.unitWeight === '' ? null : body.unitWeight,
      hsnSacCode: body.hsnSacCode === '' ? null : body.hsnSacCode,
      taxCategory: body.taxCategory === '' ? null : body.taxCategory,
      defaultGstRate: body.defaultGstRate === '' ? null : body.defaultGstRate,
      defaultPurchaseTaxId: body.defaultPurchaseTaxId === '' ? null : body.defaultPurchaseTaxId,
      defaultSalesTaxId: body.defaultSalesTaxId === '' ? null : body.defaultSalesTaxId,
    };

    // Remove suppliers from body before updating product
    const { suppliers, ...productData } = cleanedBody;

    // Update product
    const [updatedProduct] = await erpDb
      .update(products)
      .set({
        ...productData,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(products.id, id))
      .returning();

    // Handle suppliers if provided
    if (suppliers && Array.isArray(suppliers)) {
      // Import productSuppliers schema
      const { productSuppliers } = await import('@/lib/db/schema');
      
      // Delete existing suppliers for this product
      await erpDb.delete(productSuppliers).where(eq(productSuppliers.productId, id));
      
      // Add new suppliers
      if (suppliers.length > 0) {
        await erpDb.insert(productSuppliers).values(
          suppliers.map((s: any) => ({
            productId: id,
            supplierId: s.supplierId,
            supplierSku: s.supplierSku || null,
            supplierProductName: s.supplierProductName || null,
            unitPrice: s.unitPrice,
            minimumOrderQuantity: s.minimumOrderQuantity,
            leadTimeDays: s.leadTimeDays,
            isPrimary: s.isPrimary || false,
            isActive: s.isActive !== false,
            notes: s.notes || null,
          }))
        );
      }
    }

    return NextResponse.json({ product: updatedProduct });
  } catch (err: any) {
    console.error('Error updating product:', err);
    logDatabaseError('Update product', err);
    const dbError = handleDatabaseError(err);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}