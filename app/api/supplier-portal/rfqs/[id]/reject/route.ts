import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

interface Params {
  id: string; // rfq_supplier_id
}

// POST /api/supplier-portal/rfqs/[id]/reject - Reject RFQ
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    const { id: rfqSupplierId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    // Verify access
    const rfqSupplierResult = await db.execute(sql`
      SELECT * FROM rfq_suppliers
      WHERE id = ${rfqSupplierId} AND supplier_id = ${supplier.id}
    `);

    if (!rfqSupplierResult || Array.from(rfqSupplierResult).length === 0) {
      return NextResponse.json({ error: 'RFQ not found or no access' }, { status: 404 });
    }

    const rfqSupplier = Array.from(rfqSupplierResult)[0] as any;

    // Check if already rejected or accepted
    if (rfqSupplier.response_status !== 'pending') {
      return NextResponse.json(
        { error: `RFQ already ${rfqSupplier.response_status}` },
        { status: 400 }
      );
    }

    // Update rfq_suppliers record
    await db.execute(sql`
      UPDATE rfq_suppliers
      SET 
        response_status = 'rejected',
        response_date = NOW(),
        rejected_at = NOW(),
        responded = true,
        response_notes = ${notes || 'Declined to quote'}
      WHERE id = ${rfqSupplierId}
    `);

    return NextResponse.json({
      message: 'RFQ rejected successfully',
      rfqSupplierId: rfqSupplierId,
    });
  } catch (error: any) {
    console.error('Error rejecting RFQ:', error);
    return NextResponse.json(
      { error: 'Failed to reject RFQ', details: error.message },
      { status: 500 }
    );
  }
}
