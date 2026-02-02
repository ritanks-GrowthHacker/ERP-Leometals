import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/inventory/categories
 * List all product categories
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
    const result = await erpDb.execute(sql`
      SELECT 
        id,
        name,
        code,
        description,
        parent_category_id,
        is_active,
        created_at,
        updated_at
      FROM product_categories
      WHERE erp_organization_id = ${user.erpOrganizationId}
        AND is_active = true
      ORDER BY name ASC
    `);

    const categories = result.map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      parentId: row.parent_category_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: categories
    });

  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/inventory/categories
 * Create a new product category
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
    const { name, description, parentId } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    const result = await erpDb.execute(sql`
      INSERT INTO product_categories (erp_organization_id, name, description, parent_category_id)
      VALUES (${user.erpOrganizationId}, ${name}, ${description || null}, ${parentId || null})
      RETURNING *
    `);

    const category = result[0] as any;

    return NextResponse.json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: category.id,
        name: category.name,
        code: category.code,
        description: category.description,
        parentId: category.parent_category_id,
        isActive: category.is_active,
        createdAt: category.created_at,
        updatedAt: category.updated_at
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }
}
