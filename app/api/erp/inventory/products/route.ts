import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { products,  productSuppliers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';


// GET /api/erp/inventory/products
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  // Check permissions
  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view inventory' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [eq(products.erpOrganizationId, user.erpOrganizationId)];
    
    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }
    
    if (categoryId) {
      conditions.push(eq(products.productCategoryId, categoryId));
    }
    
    if(subCategoryId) {
      conditions.push(eq(products.productSubCategoryId, subCategoryId));
    }
    if (isActive !== null) {
      conditions.push(eq(products.isActive, isActive === 'true'));
    }

    const productsList = await erpDb.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
        subCategory: true,
      },
      limit,
      offset,
      orderBy: [desc(products.createdAt)],
    });

    // Get available quantity and warehouse stock for each product
    const productsWithStock = await Promise.all(
      productsList.map(async (product) => {
        // Get total available quantity (never negative)
        const stockResult = await erpDb.execute(sql`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as available_quantity
          FROM stock_levels
          WHERE product_id = ${product.id}
        `);
        
        const availableQty = stockResult[0]?.available_quantity;
        
        // Get warehouse stock with locations
        const warehouseStockResult = await erpDb.execute(sql`
          SELECT 
            w.id as warehouse_id,
            w.name as warehouse_name,
            sl.quantity_on_hand,
            wl.id as location_id,
            wl.name as location_name,
            wl.code as location_code
          FROM stock_levels sl
          JOIN warehouses w ON sl.warehouse_id = w.id
          LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
          WHERE sl.product_id = ${product.id}
          ORDER BY w.name, wl.name
        `);
        
        // Group locations by warehouse
        const warehouseMap = new Map<string, any>();
        warehouseStockResult.forEach((row: any) => {
          const warehouseId = row.warehouse_id;
          if (!warehouseMap.has(warehouseId)) {
            warehouseMap.set(warehouseId, {
              warehouseId: row.warehouse_id,
              warehouseName: row.warehouse_name,
              quantityOnHand: 0,
              locations: []
            });
          }
          
          const warehouseEntry = warehouseMap.get(warehouseId);
          warehouseEntry.quantityOnHand += parseFloat(String(row.quantity_on_hand || 0));
          
          if (row.location_id) {
            warehouseEntry.locations.push({
              id: row.location_id,
              name: row.location_name,
              code: row.location_code
            });
          }
        });
        
        const warehouseStock = Array.from(warehouseMap.values());
        
        return {
          ...product,
          availableQuantity: typeof availableQty === 'number' ? availableQty : parseFloat(String(availableQty || 0)),
          warehouseStock,
        };
      })
    );

    return NextResponse.json({
      products: productsWithStock,
      pagination: {
        page,
        limit,
        total: productsWithStock.length,
      },
    });
  } catch (error: any) {
    logDatabaseError('Fetching products', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/inventory/products
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create products' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      name,
      sku,
      barcode,
      description,
      productType,
      trackingType,
      productCategoryId,
      productSubCategoryId,
      costPrice,
      salePrice,
      reorderPoint,
      reorderQuantity,
      leadTimeDays,
      imageUrl,
      notes,
      suppliers,
      unitOfMeasure,
      unitWeight,
      hsnSacCode,
      taxCategory,
      defaultGstRate,
      defaultPurchaseTaxId,
      defaultSalesTaxId,
    } = body;

    // Validate required fields
    if (!name || !sku || !productType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sku, productType' },
        { status: 400 }
      );
    }

    // Check if SKU already exists
    const existing = await erpDb.query.products.findFirst({
      where: and(
        eq(products.erpOrganizationId, user.erpOrganizationId),
        eq(products.sku, sku)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Product with this SKU already exists' },
        { status: 409 }
      );
    }

    // Auto-generate barcode if not provided
    const generatedBarcode = barcode || `${name.substring(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${sku.toUpperCase()}-WH00`;

    // Create product
    const [newProduct] = await erpDb
      .insert(products)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        name,
        sku,
        barcode: generatedBarcode,
        description,
        productType,
        trackingType: trackingType || 'none',
        productCategoryId: sanitizeUuid(productCategoryId),
        productSubCategoryId: sanitizeUuid(productSubCategoryId),
        costPrice: costPrice || '0',
        salePrice: salePrice || '0',
        reorderPoint: reorderPoint || '0',
        reorderQuantity: reorderQuantity || '0',
        leadTimeDays: leadTimeDays || 0,
        imageUrl: sanitizeUuid(imageUrl),
        notes,
        unitOfMeasure: unitOfMeasure || null,
        unitWeight: unitWeight || null,
        hsnSacCode: hsnSacCode || null,
        taxCategory: taxCategory || null,
        defaultGstRate: defaultGstRate || null,
        defaultPurchaseTaxId: sanitizeUuid(defaultPurchaseTaxId),
        defaultSalesTaxId: sanitizeUuid(defaultSalesTaxId),
        createdBy: user.id,
        isActive: true,
      })
      .returning();

    // Add suppliers if provided
    if (suppliers && Array.isArray(suppliers) && suppliers.length > 0) {
      const supplierValues = suppliers.map((sup: any) => ({
        productId: newProduct.id,
        supplierId: sup.supplierId,
        supplierSku: sup.supplierSku || null,
        supplierProductName: sup.supplierProductName || null,
        unitPrice: sup.unitPrice,
        leadTimeDays: parseInt(sup.leadTimeDays) || 0,
        minimumOrderQuantity: sup.minimumOrderQuantity || '1',
        isPrimary: sup.isPrimary || false,
        isActive: sup.isActive !== false,
      }));

      await erpDb.insert(productSuppliers).values(supplierValues);
    }

    return NextResponse.json({ product: newProduct }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating product', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
