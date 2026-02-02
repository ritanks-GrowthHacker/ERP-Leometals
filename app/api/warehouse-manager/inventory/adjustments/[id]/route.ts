import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockAdjustments } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id } = params;

    if (!id || id.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid adjustment ID' },
        { status: 400 }
      );
    }

    const adjustment = await erpDb.query.stockAdjustments.findFirst({
      where: and(
        eq(stockAdjustments.id, id),
        eq(stockAdjustments.erpOrganizationId, user.organizationId),
        eq(stockAdjustments.warehouseId, user.warehouseId)
      ),
      with: {
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!adjustment) {
      return NextResponse.json(
        { error: 'Stock adjustment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ adjustment });
  } catch (error: any) {
    console.error('Error fetching stock adjustment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock adjustment', details: error.message },
      { status: 500 }
    );
  }
}
