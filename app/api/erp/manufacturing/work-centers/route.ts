import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { workCenters } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, desc } from 'drizzle-orm';

// GET /api/erp/manufacturing/work-centers - List all Work Centers
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view work centers' }, { status: 403 });
  }

  try {
    const erpOrganizationId = user.erpOrganizationId;

    const centerList = await db
      .select()
      .from(workCenters)
      .where(eq(workCenters.erpOrganizationId, erpOrganizationId))
      .orderBy(workCenters.code);

    return NextResponse.json(centerList);
  } catch (error) {
    console.error('Error fetching work centers:', error);
    return NextResponse.json({ error: 'Failed to fetch work centers' }, { status: 500 });
  }
}

// POST /api/erp/manufacturing/work-centers - Create new Work Center
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'create')) {
    return NextResponse.json({ error: 'No permission to create work centers' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const erpOrganizationId = user.erpOrganizationId;

    const [newCenter] = await db
      .insert(workCenters)
      .values({
        erpOrganizationId,
        ...body,
      })
      .returning();

    return NextResponse.json(newCenter, { status: 201 });
  } catch (error) {
    console.error('Error creating work center:', error);
    return NextResponse.json({ error: 'Failed to create work center' }, { status: 500 });
  }
}
