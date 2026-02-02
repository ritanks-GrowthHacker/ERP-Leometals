import { NextRequest, NextResponse } from 'next/server';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

type RouteParams = {
  params: Promise<{ locationId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stock' },
      { status: 403 }
    );
  }

  try {
    const { locationId } = await params;

    // Fetch stock items in this location
    const stockItemsQuery = await erpDb.execute(sql`
      SELECT 
        sl.id,
        sl.product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        sl.quantity_on_hand,
        sl.quantity_reserved,
        sl.bin_position,
        sl.rack_number
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      WHERE sl.location_id = ${locationId}
        AND CAST(sl.quantity_on_hand AS DECIMAL) > 0
      ORDER BY p.name ASC
    `);

    const stockItems = Array.from(stockItemsQuery).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productSku: item.product_sku,
      productImage: item.product_image,
      quantityOnHand: item.quantity_on_hand,
      quantityReserved: item.quantity_reserved || '0',
      binPosition: item.bin_position,
      rackNumber: item.rack_number,
    }));

    return NextResponse.json({ stockItems });
  } catch (error: any) {
    console.error('Error fetching stock items:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock items' },
      { status: 500 }
    );
  }
}
