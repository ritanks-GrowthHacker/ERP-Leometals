import { NextRequest, NextResponse } from 'next/server';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { requireErpAccess } from '@/lib/auth';
import { erpDb as db } from '@/lib/db';
import { products, stockLevels, productSuppliers } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    // Verify ERP authentication
    const { user, error } = await requireErpAccess(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const warehouseId = searchParams.get('warehouseId');
    const locationId = searchParams.get('locationId');
    const supplierId = searchParams.get('supplierId');

    // Build base conditions
    const conditions = [eq(products.erpOrganizationId, user.erpOrganizationId)];
    
    // Add search condition
    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.sku, `%${search}%`),
          like(products.description, `%${search}%`)
        )!
      );
    }

    // If warehouse or location filter is applied, join with stock_levels
    if (warehouseId || locationId) {
      const stockConditions = [];
      if (warehouseId) stockConditions.push(eq(stockLevels.warehouseId, warehouseId));
      if (locationId) stockConditions.push(eq(stockLevels.locationId, locationId));
      
      // Query products with stock
      const productsWithStock = await db
        .selectDistinct({
          id: products.id,
          name: products.name,
          sku: products.sku,
          description: products.description,
          cost_price: products.costPrice,
          gst_rate: sql`COALESCE(${products.defaultGstRate}, 18)`.as('gst_rate'),
        })
        .from(products)
        .innerJoin(stockLevels, eq(products.id, stockLevels.productId))
        .where(and(...conditions, ...stockConditions, sql`${stockLevels.quantityOnHand} > 0`))
        .orderBy(products.name)
        .limit(limit);

      return NextResponse.json({ products: productsWithStock });
    }

    // If supplier filter is applied
    if (supplierId) {
      const productsWithSupplier = await db
        .selectDistinct({
          id: products.id,
          name: products.name,
          sku: products.sku,
          description: products.description,
          cost_price: products.costPrice,
          gst_rate: sql`COALESCE(${products.defaultGstRate}, 18)`.as('gst_rate'),
        })
        .from(products)
        .innerJoin(productSuppliers, eq(products.id, productSuppliers.productId))
        .where(and(...conditions, eq(productSuppliers.supplierId, supplierId)))
        .orderBy(products.name)
        .limit(limit);

      return NextResponse.json({ products: productsWithSupplier });
    }

    // Default: just search products
    const productsList = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        description: products.description,
        cost_price: products.costPrice,
        gst_rate: sql`COALESCE(${products.defaultGstRate}, 18)`.as('gst_rate'),
      })
      .from(products)
      .where(and(...conditions))
      .orderBy(products.name)
      .limit(limit);

    return NextResponse.json({ products: productsList });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
