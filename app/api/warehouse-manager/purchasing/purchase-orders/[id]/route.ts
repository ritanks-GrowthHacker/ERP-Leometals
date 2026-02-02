import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { purchaseOrders, purchaseOrderLines, products, suppliers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

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

    // Get PO with lines
    const po = await erpDb.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.warehouseId, user.warehouseId)
      ),
      with: {
        supplier: true,
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json(po);
  } catch (error: any) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order', details: error.message },
      { status: 500 }
    );
  }
}
