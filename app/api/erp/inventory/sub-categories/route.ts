import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productSubCategories } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/erp/inventory/sub-categories
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view sub categories' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');

    const conditions = [eq(productSubCategories.erpOrganizationId, user.erpOrganizationId)];
    
    if (categoryId) {
      conditions.push(eq(productSubCategories.productCategoryId, categoryId));
    }

    const subCategoriesList = await erpDb.query.productSubCategories.findMany({
      where: and(...conditions),
      orderBy: [desc(productSubCategories.createdAt)],
    });

    return NextResponse.json({
      subCategories: subCategoriesList,
    });
  } catch (err: any) {
    console.error('Error fetching sub categories:', err);
    return NextResponse.json(
      { error: 'Failed to fetch sub categories' },
      { status: 500 }
    );
  }
}

// POST /api/erp/inventory/sub-categories
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create sub categories' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, code, description, productCategoryId, imageUrl, isActive } = body;

    if (!name || !productCategoryId) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      );
    }

    const newSubCategory = await erpDb.insert(productSubCategories).values({
      erpOrganizationId: user.erpOrganizationId,
      productCategoryId,
      name,
      code: code || null,
      description: description || null,
      imageUrl: imageUrl || null,
      isActive: isActive !== false,
    }).returning();

    return NextResponse.json({
      subCategory: newSubCategory[0],
      message: 'Sub category created successfully',
    });
  } catch (err: any) {
    console.error('Error creating sub category:', err);
    return NextResponse.json(
      { error: 'Failed to create sub category' },
      { status: 500 }
    );
  }
}
