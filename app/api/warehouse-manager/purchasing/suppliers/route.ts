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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get suppliers (read-only for warehouse managers)
    let query;
    if (search) {
      query = sql`
        SELECT 
          id,
          name,
          code,
          email,
          phone,
          address,
          country,
          tax_id,
          payment_terms,
          is_active as status
        FROM suppliers
        WHERE erp_organization_id = ${user.organizationId}
          AND (
            LOWER(name) LIKE LOWER(${'%' + search + '%'})
            OR LOWER(email) LIKE LOWER(${'%' + search + '%'})
            OR LOWER(phone) LIKE LOWER(${'%' + search + '%'})
          )
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT 
          id,
          name,
          code,
          email,
          phone,
          address,
          country,
          tax_id,
          payment_terms,
          is_active as status
        FROM suppliers
        WHERE erp_organization_id = ${user.organizationId}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const suppliers = await erpDb.execute(query);

    // Get total count
    const countQuery = search
      ? sql`
          SELECT COUNT(*) as count
          FROM suppliers
          WHERE erp_organization_id = ${user.organizationId}
            AND (
              LOWER(name) LIKE LOWER(${'%' + search + '%'})
              OR LOWER(email) LIKE LOWER(${'%' + search + '%'})
              OR LOWER(phone) LIKE LOWER(${'%' + search + '%'})
            )
        `
      : sql`
          SELECT COUNT(*) as count
          FROM suppliers
          WHERE erp_organization_id = ${user.organizationId}
        `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      suppliers: Array.from(suppliers),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      readOnly: true, // Indicate this is read-only for warehouse managers
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error.message },
      { status: 500 }
    );
  }
}
