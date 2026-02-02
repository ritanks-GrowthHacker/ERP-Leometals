import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/audit/entities
 * Fetch entities for audit dropdown selection
 * Query params:
 * - type: customers | products | warehouses
 * - search: optional search term
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireApiAuth(req);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';

    if (!type || !['customers', 'products', 'warehouses'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be: customers, products, or warehouses' },
        { status: 400 }
      );
    }

    let data: any[] = [];

    if (type === 'customers') {
      const searchCondition = search 
        ? sql`AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})`
        : sql``;

      data = await erpDb.execute(sql`
        SELECT 
          id,
          name,
          email,
          phone
        FROM customers
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${searchCondition}
        AND is_active = true
        ORDER BY name
        LIMIT 50
      `);
    } else if (type === 'products') {
      const searchCondition = search 
        ? sql`AND (name ILIKE ${'%' + search + '%'} OR sku ILIKE ${'%' + search + '%'})`
        : sql``;

      data = await erpDb.execute(sql`
        SELECT 
          id,
          name,
          sku,
          barcode
        FROM products
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${searchCondition}
        AND is_active = true
        ORDER BY name
        LIMIT 50
      `);
    } else if (type === 'warehouses') {
      const searchCondition = search 
        ? sql`AND (name ILIKE ${'%' + search + '%'} OR location ILIKE ${'%' + search + '%'})`
        : sql``;

      data = await erpDb.execute(sql`
        SELECT 
          id,
          name,
          location,
          warehouse_type
        FROM warehouses
        WHERE erp_organization_id = ${user.erpOrganizationId}
        ${searchCondition}
        AND is_active = true
        ORDER BY name
        LIMIT 50
      `);
    }

    return NextResponse.json({
      success: true,
      data,
      type
    });

  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
