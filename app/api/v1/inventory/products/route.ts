import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/inventory/products
 * List all products with pagination and filtering
 * Requires: JWT token with 'read' scope
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    // Filters
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const inStock = searchParams.get('in_stock');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    
    // Build query with organization filter
    let conditions = sql`p.erp_organization_id = ${user.erpOrganizationId}`;
      
      if (search) {
        conditions = sql`${conditions} AND (
          LOWER(p.name) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(p.sku) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(p.barcode) LIKE LOWER(${'%' + search + '%'})
        )`;
      }
      
      if (category) {
        conditions = sql`${conditions} AND p.product_category_id = ${category}`;
      }
      
      // Stock tracking is done via stock_quants table, not directly on products
      // Removed in_stock filter as it doesn't apply to this schema
      
      if (minPrice) {
        conditions = sql`${conditions} AND p.sale_price >= ${parseFloat(minPrice)}`;
      }
      
      if (maxPrice) {
        conditions = sql`${conditions} AND p.sale_price <= ${parseFloat(maxPrice)}`;
      }
      
      // Get total count
      const countResult = await erpDb.execute(sql`
        SELECT COUNT(*) as total
        FROM products p
        WHERE ${conditions}
      `);
      
      const total = parseInt((countResult[0] as any).total);
      
      // Get products
      const productsResult = await erpDb.execute(sql`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.sku,
          p.barcode,
          p.product_category_id,
          p.sale_price,
          p.cost_price,
          p.reorder_point,
          p.reorder_quantity,
          p.product_type,
          p.tracking_type,
          p.image_url,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM products p
        WHERE ${conditions}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
      
      const products = productsResult.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        sku: row.sku,
        barcode: row.barcode,
        categoryId: row.product_category_id,
        salePrice: row.sale_price ? parseFloat(row.sale_price) : 0,
        costPrice: row.cost_price ? parseFloat(row.cost_price) : 0,
        reorderPoint: row.reorder_point ? parseFloat(row.reorder_point) : 0,
        reorderQuantity: row.reorder_quantity ? parseFloat(row.reorder_quantity) : 0,
        productType: row.product_type,
        trackingType: row.tracking_type,
        imageUrl: row.image_url,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      return NextResponse.json({
        success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch products'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/inventory/products
 * Create a new product
 * Requires: JWT token with 'write' scope
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    console.log('Product creation - Request body:', JSON.stringify(body, null, 2));
    
    const {
      name,
      description,
      sku,
      barcode,
      category,
      unitPrice,
      costPrice,
      stockQuantity = 0,
      reorderLevel = 0,
      unitOfMeasure = 'pcs',
      imageUrl
    } = body;
    
    console.log('Product creation - Extracted fields:', { name, sku, category });
    
    // Validation
    if (!name || !sku || !category) {
      console.error('Product creation - Validation failed:', { name, sku, category });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name, SKU, and category are required',
            details: {
              name: !name ? 'Name is required' : null,
              sku: !sku ? 'SKU is required' : null,
              category: !category ? 'Category is required' : null
            }
          }
        },
        { status: 400 }
      );
    }
    
    console.log('Product creation - Checking for duplicate SKU');
    // Check if SKU already exists IN THIS ORGANIZATION
    const existingProduct = await erpDb.execute(sql`
      SELECT id FROM products
      WHERE sku = ${sku} AND erp_organization_id = ${user.erpOrganizationId}
    `);
    
    console.log('Product creation - Existing product check:', existingProduct.length);
    
    if (existingProduct && existingProduct.length > 0) {
      console.error('Product creation - Duplicate SKU found:', existingProduct[0]);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SKU',
            message: 'A product with this SKU already exists in your organization'
          }
        },
        { status: 409 }
      );
    }
    
    console.log('Product creation - Inserting product');
    // Insert product
    const result = await erpDb.execute(sql`
      INSERT INTO products (
        erp_organization_id,
        name,
        description,
        sku,
        barcode,
        product_category_id,
        sale_price,
        cost_price,
        product_type,
        tracking_type,
        reorder_point,
        reorder_quantity,
        image_url,
        created_by
      ) VALUES (
        ${user.erpOrganizationId},
        ${name},
        ${description || null},
        ${sku},
        ${barcode || null},
        ${category},
        ${unitPrice || 0},
        ${costPrice || 0},
        'storable',
        'none',
        ${reorderLevel || 0},
        ${stockQuantity || 0},
        ${imageUrl || null},
        ${user.userId}
      )
      RETURNING *
    `);
    
    const product = result[0] as any;
    
    return NextResponse.json(
      {
        success: true,
        message: 'Product created successfully',
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.product_category_id,
          salePrice: product.sale_price ? parseFloat(product.sale_price) : 0,
          costPrice: product.cost_price ? parseFloat(product.cost_price) : 0,
          reorderPoint: product.reorder_point ? parseFloat(product.reorder_point) : 0,
          reorderQuantity: product.reorder_quantity ? parseFloat(product.reorder_quantity) : 0,
          productType: product.product_type,
          trackingType: product.tracking_type,
          imageUrl: product.image_url,
          isActive: product.is_active,
          createdAt: product.created_at
        }
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create product'
        }
      },
      { status: 500 }
    );
  }
}
