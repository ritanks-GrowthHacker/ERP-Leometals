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

    // Get invoices for organization
    const query = sql`
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.status,
        i.total_amount,
        i.currency_code,
        s.name as supplier_name,
        po.po_number
      FROM vendor_invoices i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN purchase_orders po ON i.purchase_order_id = po.id
      WHERE i.erp_organization_id = ${user.organizationId}
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const invoices = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM vendor_invoices
      WHERE erp_organization_id = ${user.organizationId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      invoices: Array.from(invoices),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      readOnly: true, // Warehouse managers cannot record invoices
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices', details: error.message },
      { status: 500 }
    );
  }
}
