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

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all categories (read-only for warehouse managers)
    const query = sql`
      SELECT 
        id,
        name,
        code,
        description,
        parent_category_id,
        is_active,
        created_at
      FROM product_categories
      WHERE erp_organization_id = ${user.organizationId}
      ORDER BY name ASC
    `;

    const categories = await erpDb.execute(query);

    return NextResponse.json({
      categories: Array.from(categories),
      readOnly: true, // Warehouse managers cannot add categories
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}
