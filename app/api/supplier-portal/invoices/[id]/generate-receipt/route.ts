import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { id: invoiceId } = await context.params;

    // Verify supplier authentication
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    // Fetch invoice details
    const invoiceResult = await db.execute(sql`
      SELECT 
        si.*,
        s.id as supplier_id,
        s.name as supplier_name,
        s.email as supplier_email,
        s.erp_organization_id
      FROM supplier_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      WHERE si.id = ${invoiceId}
        AND s.id = ${supplier.id}
    `);

    if (!invoiceResult || Array.from(invoiceResult).length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = Array.from(invoiceResult)[0] as any;

    // Check if invoice is paid
    if (invoice.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Receipt can only be generated for paid invoices' },
        { status: 400 }
      );
    }

    // Check if receipt already exists
    const existingReceiptResult = await db.execute(sql`
      SELECT id, receipt_number, status 
      FROM supplier_invoice_receipts 
      WHERE invoice_id = ${invoiceId}
    `);

    if (existingReceiptResult && Array.from(existingReceiptResult).length > 0) {
      const existingReceipt = Array.from(existingReceiptResult)[0];
      return NextResponse.json({
        message: 'Receipt already exists for this invoice',
        receipt: existingReceipt
      });
    }

    // Generate receipt number
    const receiptNumberResult = await db.execute(sql`
      SELECT generate_receipt_number(${invoice.erp_organization_id}) as receipt_number
    `);
    const receiptNumber = (Array.from(receiptNumberResult)[0] as any).receipt_number;

    // Get payment method from request body (optional)
    const body = await request.json().catch(() => ({}));
    const { payment_method, payment_reference, notes } = body;

    // Create receipt
    const receiptResult = await db.execute(sql`
      INSERT INTO supplier_invoice_receipts (
        receipt_number,
        supplier_id,
        invoice_id,
        erp_organization_id,
        amount,
        payment_method,
        payment_reference,
        notes,
        status
      ) VALUES (
        ${receiptNumber},
        ${invoice.supplier_id},
        ${invoiceId},
        ${invoice.erp_organization_id},
        ${invoice.total_amount},
        ${payment_method || 'bank_transfer'},
        ${payment_reference || null},
        ${notes || null},
        'generated'
      )
      RETURNING *
    `);

    const receipt = Array.from(receiptResult)[0] as any;

    // Update invoice to mark receipt generated
    await db.execute(sql`
      UPDATE supplier_invoices 
      SET updated_at = NOW()
      WHERE id = ${invoiceId}
    `);

    // If invoice is linked to a purchase order, mark it as received (completed)
    if (invoice.purchase_order_id) {
      await db.execute(sql`
        UPDATE purchase_orders 
        SET status = 'received',
            received_date = NOW(),
            updated_at = NOW()
        WHERE id = ${invoice.purchase_order_id}
          AND erp_organization_id = ${invoice.erp_organization_id}
      `);
    }

    return NextResponse.json({
      message: 'Receipt generated successfully',
      receipt: {
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_date: receipt.receipt_date,
        amount: receipt.amount,
        status: receipt.status,
        invoice_number: invoice.invoice_number,
        supplier_name: invoice.supplier_name
      }
    });

  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
