import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockLevels } from '@/lib/db/schema';
import { requireErpAccess } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// PATCH /api/erp/inventory/stock-levels/[stockLevelId]/reserved
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stockLevelId: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const { quantityReserved } = await req.json();
    const { stockLevelId } = await params;

    if (quantityReserved === undefined || quantityReserved === null) {
      return NextResponse.json(
        { error: 'quantityReserved is required' },
        { status: 400 }
      );
    }

    // Validate quantity
    const qty = parseFloat(quantityReserved);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { error: 'Invalid quantity reserved value' },
        { status: 400 }
      );
    }

    // Update the stock level
    const [updated] = await erpDb
      .update(stockLevels)
      .set({
        quantityReserved: qty.toString(),
        updatedAt: new Date(),
      })
      .where(eq(stockLevels.id, stockLevelId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Stock level not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      stockLevel: updated,
    });
  } catch (error: any) {
    logDatabaseError('Updating stock level reserved quantity', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
