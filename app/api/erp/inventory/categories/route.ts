import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productCategories } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, like, isNull, desc } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/inventory/categories
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view categories' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const parentId = searchParams.get('parentId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const conditions = [eq(productCategories.erpOrganizationId, user.erpOrganizationId)];
    
    if (search) {
      conditions.push(like(productCategories.name, `%${search}%`));
    }
    
    if (parentId === 'null' || parentId === '') {
      conditions.push(isNull(productCategories.parentCategoryId));
    } else if (parentId) {
      conditions.push(eq(productCategories.parentCategoryId, parentId));
    }
    
    if (!includeInactive) {
      conditions.push(eq(productCategories.isActive, true));
    }

    const categories = await erpDb.query.productCategories.findMany({
      where: and(...conditions),
      orderBy: [desc(productCategories.createdAt)],
    });

    return NextResponse.json({ categories });
  } catch (error: any) {
    logDatabaseError('Fetching categories', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/inventory/categories
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create categories' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, code, description, parentCategoryId, imageUrl } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Check if code exists
    if (code) {
      const existing = await erpDb.query.productCategories.findFirst({
        where: and(
          eq(productCategories.erpOrganizationId, user.erpOrganizationId),
          eq(productCategories.code, code)
        ),
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Category with this code already exists' },
          { status: 409 }
        );
      }
    }

    const [newCategory] = await erpDb
      .insert(productCategories)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        name,
        code,
        description,
        parentCategoryId: sanitizeUuid(parentCategoryId),
        imageUrl: sanitizeUuid(imageUrl),
        isActive: true,
      })
      .returning();

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating category', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
