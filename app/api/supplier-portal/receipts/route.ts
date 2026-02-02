import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

export async function GET(request: NextRequest) {
  // Verify supplier authentication
  const { supplier, error } = await verifySupplierAuth(request);
  if (error) return error;

  try {

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');

    // Build query with filters
    const receiptsResult = await db.execute(sql`
      SELECT 
        r.id,
        r.receipt_number,
        r.receipt_date,
        r.amount,
        r.payment_method,
        r.payment_reference,
        r.status,
        r.notes,
        r.downloaded_at,
        r.created_at,
        si.invoice_number,
        si.invoice_date,
        si.due_date,
        si.total_amount as invoice_amount,
        'Organization' as organization_name
      FROM supplier_invoice_receipts r
      JOIN supplier_invoices si ON r.invoice_id = si.id
      WHERE r.supplier_id = ${supplier.id}
        ${status ? sql`AND r.status = ${status}` : sql``}
      ORDER BY r.receipt_date DESC, r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM supplier_invoice_receipts
      WHERE supplier_id = ${supplier.id}
        ${status ? sql`AND status = ${status}` : sql``}
    `);

    const receipts = Array.from(receiptsResult);
    const total = (Array.from(countResult)[0] as any)?.total || 0;

    return NextResponse.json({
      receipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching receipts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receipts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
