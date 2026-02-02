import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

interface Params {
  id: string;
}

// GET /api/supplier-portal/rfqs/[id]/lines - Get RFQ lines
export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    const { id: rfqId } = await context.params;

    // Verify supplier has access to this RFQ
    const accessCheck = await db.execute(sql`
      SELECT id FROM rfq_suppliers 
      WHERE rfq_id = ${rfqId} AND supplier_id = ${supplier.id}
    `);

    if (!accessCheck || Array.from(accessCheck).length === 0) {
      return NextResponse.json({ error: 'RFQ not found or no access' }, { status: 404 });
    }

    // Fetch RFQ lines with product details
    const linesResult = await db.execute(sql`
      SELECT 
        rl.id,
        rl.description,
        rl.quantity_requested,
        rl.target_price,
        rl.notes,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        uom.name as uom_name
      FROM rfq_lines rl
      JOIN products p ON rl.product_id = p.id
      LEFT JOIN units_of_measure uom ON rl.uom_id = uom.id
      WHERE rl.rfq_id = ${rfqId}
      ORDER BY rl.created_at
    `);

    const lines = Array.from(linesResult);

    return NextResponse.json({ lines });
  } catch (error: any) {
    console.error('Error fetching RFQ lines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFQ lines', details: error.message },
      { status: 500 }
    );
  }
}
