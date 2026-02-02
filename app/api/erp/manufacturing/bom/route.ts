import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { boms, bomComponents, products } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';

// GET /api/erp/manufacturing/bom - List all BOMs
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view BOMs' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;

    const bomList = await db
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
        updatedAt: boms.updatedAt,
      })
      .from(boms)
      .leftJoin(products, eq(boms.productId, products.id))
      .where(eq(boms.erpOrganizationId, erpOrganizationId))
      .orderBy(desc(boms.createdAt));

    return NextResponse.json({ boms: bomList });
  } catch (error) {
    console.error('Error fetching BOMs:', error);
    return NextResponse.json({ error: 'Failed to fetch BOMs' }, { status: 500 });
  }
}

// POST /api/erp/manufacturing/bom - Create new BOM
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'create')) {
    return NextResponse.json({ error: 'No permission to create BOMs' }, { status: 403 });
  }

  try {
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

    const erpOrganizationId = user.erpOrganizationId;
    const createdBy = user.id;

    // Insert BOM
    const [newBom] = await db
      .insert(boms)
      .values({
        erpOrganizationId,
        bomNumber,
        productId,
        version: version || '1.0',
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        scrapPercentage: scrapPercentage || '0',
        notes,
        status: status || 'active',
        createdBy,
      })
      .returning();

    // Insert BOM Components if provided
    if (components && components.length > 0) {
      await db.insert(bomComponents).values(
        components.map((comp: any, index: number) => ({
          bomId: newBom.id,
          componentProductId: comp.componentProductId,
          quantity: comp.quantity,
          scrapPercentage: comp.scrapPercentage || '0',
          componentType: comp.componentType || 'raw_material',
          sequence: comp.sequence || index + 1,
          notes: comp.notes,
        }))
      );
    }

    return NextResponse.json(newBom, { status: 201 });
  } catch (error) {
    console.error('Error creating BOM:', error);
    return NextResponse.json({ error: 'Failed to create BOM' }, { status: 500 });
  }
}
