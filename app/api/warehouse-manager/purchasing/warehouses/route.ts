import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return only the warehouse manager's warehouse
    const query = sql`
      SELECT 
        w.id,
        w.name,
        w.code,
        w.address,
        w.city,
        w.state,
        w.country,
        w.postal_code,
        w.phone,
        w.email,
        w.is_active
      FROM warehouses w
      WHERE w.id = ${user.warehouseId}
    `;

    const result = await erpDb.execute(query);
    const warehouses = Array.from(result);

    return NextResponse.json({ warehouses });
  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouses', details: error.message },
      { status: 500 }
    );
  }
}
