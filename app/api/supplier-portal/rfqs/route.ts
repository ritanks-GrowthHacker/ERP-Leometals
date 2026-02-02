import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

// GET /api/supplier-portal/rfqs - Get all RFQs for supplier
export async function GET(request: NextRequest) {
  try {
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    const rfqsResult = await db.execute(sql`
      SELECT 
        rs.id as rfq_supplier_id,
        rfq.id as rfq_id,
        rfq.rfq_number,
        rfq.rfq_date,
        rfq.deadline_date,
        rfq.title,
        rfq.description,
        rfq.status as rfq_status,
        rfq.currency_code,
        rs.invited_date,
        rs.response_status,
        rs.response_date,
        rs.accepted_at,
        rs.rejected_at,
        rs.response_notes,
        (SELECT COUNT(*) FROM rfq_lines WHERE rfq_id = rfq.id) as product_count,
        (SELECT COUNT(*) > 0 FROM supplier_quotation_submissions 
         WHERE rfq_id = rfq.id AND supplier_id = rs.supplier_id) as has_quotation,
        (SELECT id FROM supplier_quotation_submissions 
         WHERE rfq_id = rfq.id AND supplier_id = rs.supplier_id 
         ORDER BY submission_date DESC LIMIT 1) as quotation_id
      FROM rfq_suppliers rs
      JOIN request_for_quotations rfq ON rs.rfq_id = rfq.id
      WHERE rs.supplier_id = ${supplier.id}
        AND rfq.status IN ('sent', 'in_progress', 'received')
      ORDER BY rfq.rfq_date DESC, rfq.created_at DESC
    `);

    const rfqs = Array.from(rfqsResult);

    return NextResponse.json({ rfqs });
  } catch (error: any) {
    console.error('Error fetching supplier RFQs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFQs', details: error.message },
      { status: 500 }
    );
  }
}
