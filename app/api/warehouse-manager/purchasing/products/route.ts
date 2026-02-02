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

    if (user.role !== 'warehouse_manager') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build search condition
    const searchCondition = search 
      ? sql`AND (p.name ILIKE ${`%${search}%`} OR p.sku ILIKE ${`%${search}%`})`
      : sql``;

    // Get products for this organization
    const query = sql`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.description,
        p.cost_price,
        p.sale_price,
        p.product_type,
        p.is_active
      FROM products p
      WHERE p.erp_organization_id = ${user.organizationId}
      AND p.is_active = true
      ${searchCondition}
      ORDER BY p.name ASC
      LIMIT ${limit}
    `;

    const result = await erpDb.execute(query);
    const products = Array.from(result);

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}
