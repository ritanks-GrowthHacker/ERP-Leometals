import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { id: invoiceId } = await context.params;

    // Verify supplier authentication
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    // Check if receipt exists for this invoice
    const receiptResult = await db.execute(sql`
      SELECT r.id, r.receipt_number, r.status, r.receipt_date
      FROM supplier_invoice_receipts r
      JOIN supplier_invoices si ON r.invoice_id = si.id
      WHERE si.id = ${invoiceId}
        AND si.supplier_id = ${supplier.id}
    `);

    const receipt = Array.from(receiptResult)[0] as any;

    if (receipt) {
      return NextResponse.json({
        hasReceipt: true,
        receiptId: receipt.id,
        receiptNumber: receipt.receipt_number,
        status: receipt.status,
        receiptDate: receipt.receipt_date
      });
    } else {
      return NextResponse.json({
        hasReceipt: false
      });
    }

  } catch (error) {
    console.error('Error checking receipt status:', error);
    return NextResponse.json(
      { error: 'Failed to check receipt status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
