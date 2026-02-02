import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { boms, bomComponents, products } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// GET /api/erp/manufacturing/bom/[id] - Get BOM details with components
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view BOMs' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Get BOM details
    const [bomDetails] = await db
      .select({
        id: boms.id,
        bomNumber: boms.bomNumber,
        productId: boms.productId,
        productName: products.name,
        productSku: products.sku,
        version: boms.version,
        effectiveFrom: boms.effectiveFrom,
        effectiveTo: boms.effectiveTo,
        scrapPercentage: boms.scrapPercentage,
        status: boms.status,
        notes: boms.notes,
        createdAt: boms.createdAt,
      })
      .from(boms)
      .leftJoin(products, eq(boms.productId, products.id))
      .where(eq(boms.id, id));

    if (!bomDetails) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }

    // Get BOM components
    const components = await db
      .select({
        id: bomComponents.id,
        componentProductId: bomComponents.componentProductId,
        componentName: products.name,
        componentSku: products.sku,
        quantity: bomComponents.quantity,
        uom: products.uomId,
        scrapPercentage: bomComponents.scrapPercentage,
        componentType: bomComponents.componentType,
        sequence: bomComponents.sequence,
        notes: bomComponents.notes,
      })
      .from(bomComponents)
      .leftJoin(products, eq(bomComponents.componentProductId, products.id))
      .where(eq(bomComponents.bomId, id))
      .orderBy(bomComponents.sequence);

    return NextResponse.json({
      ...bomDetails,
      components,
    });
  } catch (error) {
    console.error('Error fetching BOM details:', error);
    return NextResponse.json({ error: 'Failed to fetch BOM details' }, { status: 500 });
  }
}

// PUT /api/erp/manufacturing/bom/[id] - Update BOM
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit BOMs' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const {
      bomNumber,
      productId,
      version,
      effectiveFrom,
      effectiveTo,
      scrapPercentage,
      notes,
      status,
      components,
    } = body;

    // Update BOM
    const [updatedBom] = await db
      .update(boms)
      .set({
        bomNumber,
        productId,
        version,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        scrapPercentage,
        notes,
        status,
        updatedAt: new Date(),
      })
      .where(eq(boms.id, id))
      .returning();

    // Update components if provided
    if (components) {
      // Delete existing components
      await db.delete(bomComponents).where(eq(bomComponents.bomId, id));

      // Insert new components
      if (components.length > 0) {
        await db.insert(bomComponents).values(
          components.map((comp: any, index: number) => ({
            bomId: id,
            componentProductId: comp.componentProductId,
            quantity: comp.quantity,
            scrapPercentage: comp.scrapPercentage || '0',
            componentType: comp.componentType || 'raw_material',
            sequence: comp.sequence || index + 1,
            notes: comp.notes,
          }))
        );
      }
    }

    return NextResponse.json(updatedBom);
  } catch (error) {
    console.error('Error updating BOM:', error);
    return NextResponse.json({ error: 'Failed to update BOM' }, { status: 500 });
  }
}

// DELETE /api/erp/manufacturing/bom/[id] - Delete BOM
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete BOMs' }, { status: 403 });
  }

  try {
    const { id } = await params;

    await db.delete(boms).where(eq(boms.id, id));

    return NextResponse.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    return NextResponse.json({ error: 'Failed to delete BOM' }, { status: 500 });
  }
}
