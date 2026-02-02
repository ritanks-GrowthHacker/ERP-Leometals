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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get sales quotations - full access for warehouse managers
    const query = sql`
      SELECT 
        q.id,
        q.quotation_number,
        q.quotation_date,
        q.valid_until,
        q.status,
        q.total_amount,
        q.currency_code,
        c.name as customer_name,
        (SELECT COUNT(*) FROM sales_quotation_lines WHERE sales_quotation_id = q.id) as line_count
      FROM sales_quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.erp_organization_id = ${user.organizationId}
      ORDER BY q.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const quotations = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM sales_quotations
      WHERE erp_organization_id = ${user.organizationId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      quotations: Array.from(quotations),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      fullAccess: true, // Warehouse managers have full quotation access
    });
  } catch (error: any) {
    console.error('Error fetching sales quotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales quotations', details: error.message },
      { status: 500 }
    );
  }
}
