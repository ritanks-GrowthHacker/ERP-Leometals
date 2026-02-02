import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productCategories } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// GET /api/erp/inventory/categories/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view categories' },
      { status: 403 }
    );
  }

  try {
    const category = await erpDb.query.productCategories.findFirst({
      where: and(
        eq(productCategories.id, id),
        eq(productCategories.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (err: any) {
    console.error('Error fetching category:', err);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// PUT /api/erp/inventory/categories/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit categories' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, code, description, parentCategoryId, imageUrl, isActive } = body;

    // Check if category exists and belongs to org
    const existing = await erpDb.query.productCategories.findFirst({
      where: and(
        eq(productCategories.id, id),
        eq(productCategories.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const [updated] = await erpDb
      .update(productCategories)
      .set({
        name: name ?? existing.name,
        code: code ?? existing.code,
        description: description ?? existing.description,
        parentCategoryId: parentCategoryId !== undefined ? parentCategoryId : existing.parentCategoryId,
        imageUrl: imageUrl ?? existing.imageUrl,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    return NextResponse.json({ category: updated });
  } catch (err: any) {
    console.error('Error updating category:', err);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// DELETE /api/erp/inventory/categories/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete categories' },
      { status: 403 }
    );
  }

  try {
    const existing = await erpDb.query.productCategories.findFirst({
      where: and(
        eq(productCategories.id, id),
        eq(productCategories.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    await erpDb
      .delete(productCategories)
      .where(eq(productCategories.id, id));

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting category:', err);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
