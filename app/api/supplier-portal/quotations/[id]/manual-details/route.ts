import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifySupplierToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.type !== 'supplier') {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

// GET /api/supplier-portal/quotations/[id]/manual-details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if it's supplier or ERP user
  const supplier = await verifySupplierToken(req);
  let isErpUser = false;
  let erpUser = null;

  if (!supplier) {
    const { user, error } = await requireErpAccess(req);
    if (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    erpUser = user;
    isErpUser = true;
  }

  try {
    const { id: quotationId } = await params;

    // Fetch manual quotation details
    const manualQuotationResult = await erpDb.execute(sql`
      SELECT 
        mq.*,
        s.name as supplier_name,
        s.code as supplier_code,
        sq.submission_number,
        sq.rfq_id,
        rfq.rfq_number,
        rfq.title as rfq_title
      FROM manual_quotations mq
      LEFT JOIN suppliers s ON mq.supplier_id = s.id
      LEFT JOIN supplier_quotation_submissions sq ON mq.quotation_id = sq.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      WHERE mq.quotation_id = ${quotationId}
    `);

    const manualQuotation = Array.from(manualQuotationResult)[0];

    if (!manualQuotation) {
      return NextResponse.json(
        { error: 'Manual quotation not found' },
        { status: 404 }
      );
    }

    // Verify access
    if (supplier && manualQuotation.supplier_id !== supplier.supplierId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (isErpUser && erpUser && manualQuotation.erp_organization_id !== erpUser.erpOrganizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch manual quotation items
    const itemsResult = await erpDb.execute(sql`
      SELECT * FROM manual_quotation_items
      WHERE manual_quotation_id = ${manualQuotation.id}
      ORDER BY created_at
    `);

    const items = Array.from(itemsResult);

    return NextResponse.json({
      manualQuotation,
      items,
    });
  } catch (error: any) {
    console.error('Error fetching manual quotation details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
