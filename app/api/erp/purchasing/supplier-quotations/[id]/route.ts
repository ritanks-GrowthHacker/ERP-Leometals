import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/purchasing/supplier-quotations/[id] - Get quotation details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    if (!hasPermission(user, 'purchasing', 'view')) {
      return NextResponse.json(
        { error: 'No permission to view quotations' },
        { status: 403 }
      );
    }

    const { id: quotationId } = await params;

    const result = await erpDb.execute(sql`
      SELECT 
        sq.*,
        s.name as supplier_name,
        s.code as supplier_code,
        s.email as supplier_email,
        s.phone as supplier_phone,
        rfq.rfq_number,
        rfq.title as rfq_title,
        po.po_number
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
      WHERE sq.id = ${quotationId}
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    const quotations = Array.from(result);
    if (quotations.length === 0) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quotations[0];

    // Get quotation items if manual entry type
    if (quotation.quotation_type === 'manual_entry' && quotation.manual_quotation_data) {
      const items = typeof quotation.manual_quotation_data === 'string' 
        ? JSON.parse(quotation.manual_quotation_data)
        : quotation.manual_quotation_data;
      return NextResponse.json({
        quotation,
        items,
      });
    }

    return NextResponse.json({ quotation });
  } catch (error: any) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch quotation' }, { status: 500 });
  }
}
