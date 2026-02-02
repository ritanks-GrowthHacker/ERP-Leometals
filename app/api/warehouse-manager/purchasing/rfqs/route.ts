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

    // Get RFQs - warehouse managers can see RFQs they created
    const query = sql`
      SELECT 
        rfq.id,
        rfq.rfq_number,
        rfq.rfq_date,
        rfq.deadline_date,
        rfq.title,
        rfq.status,
        (SELECT COUNT(*) FROM rfq_suppliers WHERE rfq_id = rfq.id) as supplier_count,
        (SELECT COUNT(*) FROM rfq_lines WHERE rfq_id = rfq.id) as line_count
      FROM request_for_quotations rfq
      WHERE rfq.erp_organization_id = ${user.organizationId}
      ORDER BY rfq.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rfqs = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM request_for_quotations
      WHERE erp_organization_id = ${user.organizationId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      rfqs: Array.from(rfqs),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching RFQs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFQs', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { rfqNumber, supplierIds, issueDate, responseDeadline, deliveryDate, notes, items } = body;

    if (!supplierIds || supplierIds.length === 0 || !items || items.length === 0) {
      return NextResponse.json({ error: 'Suppliers and line items are required' }, { status: 400 });
    }

    // Generate RFQ number if not provided
    let finalRfqNumber = rfqNumber;
    if (!finalRfqNumber) {
      const rfqNumberResult = await erpDb.execute(sql`
        SELECT COALESCE(MAX(CAST(SUBSTRING(rfq_number FROM 5) AS INTEGER)), 0) + 1 as next_number
        FROM request_for_quotations
        WHERE erp_organization_id = ${user.organizationId}
      `);
      const nextNumber = (rfqNumberResult as any)[0]?.next_number || 1;
      finalRfqNumber = `RFQ-${String(nextNumber).padStart(6, '0')}`;
    }

    // Insert RFQ
    const rfqResult = await erpDb.execute(sql`
      INSERT INTO request_for_quotations (
        rfq_number, rfq_date, deadline_date, title, status,
        notes, erp_organization_id, created_by
      ) VALUES (
        ${finalRfqNumber}, ${issueDate || 'NOW()'}, ${responseDeadline},
        ${notes || 'RFQ'}, 'draft', ${notes || null}, ${user.organizationId}, ${user.id}
      ) RETURNING id
    `);
    const rfqId = (rfqResult as any)[0]?.id;

    // Insert suppliers
    for (const supplierId of supplierIds) {
      await erpDb.execute(sql`
        INSERT INTO rfq_suppliers (rfq_id, supplier_id)
        VALUES (${rfqId}, ${supplierId})
      `);
    }

    // Insert lines
    for (const item of items) {
      await erpDb.execute(sql`
        INSERT INTO rfq_lines (rfq_id, product_id, quantity_requested, notes)
        VALUES (${rfqId}, ${item.productId}, ${item.quantity}, ${item.notes || null})
      `);
    }

    return NextResponse.json({ 
      success: true, 
      rfqId,
      rfqNumber: finalRfqNumber,
      message: 'RFQ created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating RFQ:', error);
    return NextResponse.json(
      { error: 'Failed to create RFQ', details: error.message },
      { status: 500 }
    );
  }
}
