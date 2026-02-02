import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { products } from '@/lib/db/schema/inventory';
import { eq, and, sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    const productType = searchParams.get('type');
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    
    if (search) {
      whereConditions.push(sql`(
        p.name ILIKE ${`%${search}%`} OR 
        p.sku ILIKE ${`%${search}%`}
      )`);
    }
    
    if (category) {
      whereConditions.push(eq(products.productCategoryId, category));
    }

    if (productType) {
      whereConditions.push(eq(products.productType, productType));
    }

    // Get products from warehouse's stock levels with location details
    const query = sql`
      SELECT DISTINCT 
        p.id,
        p.name,
        p.sku,
        p.description,
        p.product_type,
        p.sale_price,
        p.cost_price,
        p.reorder_point,
        p.reorder_quantity,
        p.is_active,
        p.product_category_id,
        p.image_url,
        p.created_at,
        pc.name as category_name,
        pc.code as category_code,
        COALESCE(SUM(sl.quantity_on_hand), 0) as stock_quantity,
        COALESCE(SUM(sl.quantity_on_hand), 0) as available_quantity,
        COALESCE(SUM(sl.quantity_reserved), 0) as reserved_quantity,
        CASE 
          WHEN COALESCE(SUM(sl.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
          WHEN COALESCE(SUM(sl.quantity_on_hand), 0) <= p.reorder_point THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN product_categories pc ON p.product_category_id = pc.id
      LEFT JOIN stock_levels sl ON p.id = sl.product_id AND sl.warehouse_id = ${user.warehouseId}
      WHERE p.erp_organization_id = ${user.organizationId}
      ${whereConditions.length > 0 ? sql`AND ${sql.join(whereConditions, sql` AND `)}` : sql``}
      GROUP BY p.id, p.name, p.sku, p.description, p.product_type, p.sale_price, p.cost_price, 
               p.reorder_point, p.reorder_quantity, p.is_active, p.product_category_id, p.image_url, 
               p.created_at, pc.name, pc.code
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const productsData = await erpDb.execute(query);

    // Get warehouse stock with locations for each product
    const productsWithLocations = await Promise.all(
      (Array.from(productsData) as any[]).map(async (product) => {
        // Get warehouse stock with locations for this specific warehouse
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
          WHERE sl.product_id = ${product.id} AND sl.warehouse_id = ${user.warehouseId}
          ORDER BY wl.name
        `);
        
        // Group locations by warehouse (should only be one warehouse for warehouse_manager)
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
          warehouseStock,
        };
      })
    );

    // Get total count
    const countQuery = sql`
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id AND sl.warehouse_id = ${user.warehouseId}
      WHERE p.erp_organization_id = ${user.organizationId}
      ${whereConditions.length > 0 ? sql`AND ${sql.join(whereConditions, sql` AND `)}` : sql``}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      products: productsWithLocations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching warehouse products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { name, sku, description, productCategoryId, productType, costPrice, salePrice, reorderPoint, reorderQuantity, imageUrl, isActive } = body;

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
        eq(products.erpOrganizationId, user.organizationId),
        eq(products.sku, sku)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Product with this SKU already exists' },
        { status: 409 }
      );
    }

    // Create product
    const [newProduct] = await erpDb.insert(products).values({
      erpOrganizationId: user.organizationId,
      name,
      sku,
      description,
      productCategoryId: productCategoryId || null,
      productType,
      trackingType: 'none',
      costPrice: costPrice ? costPrice.toString() : '0',
      salePrice: salePrice ? salePrice.toString() : '0',
      reorderPoint: reorderPoint ? reorderPoint.toString() : '0',
      reorderQuantity: reorderQuantity ? reorderQuantity.toString() : '0',
      imageUrl: imageUrl || null,
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Create stock level for this warehouse with no location assigned
    await erpDb.execute(sql`
      INSERT INTO stock_levels (product_id, warehouse_id, location_id, quantity_on_hand, quantity_reserved, updated_at)
      VALUES (${newProduct.id}, ${user.warehouseId}, NULL, 0, 0, NOW())
    `);

    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product', details: error.message },
      { status: 500 }
    );
  }
}
