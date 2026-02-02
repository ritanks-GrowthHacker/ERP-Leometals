import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { createRazorpayOrder } from '@/lib/razorpayService';

// POST /api/payment/supplier/create-order - Create Razorpay order for supplier invoice payment
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to make payments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get supplier invoice details
    const invoiceResult = await erpDb.execute(sql`
      SELECT 
        si.id,
        si.invoice_number,
        si.total_amount,
        si.paid_amount,
        si.payment_status,
        sq.submission_number as quotation_number,
        po.po_number,
        rfq.rfq_number,
        s.id as supplier_id,
        s.name as supplier_name,
        s.email as supplier_email
      FROM supplier_invoices si
      LEFT JOIN supplier_quotation_submissions sq ON si.quotation_id = sq.id
      LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      WHERE si.id = ${invoiceId}
        AND si.erp_organization_id = ${user.erpOrganizationId}
    `);

    const invoiceArray = Array.from(invoiceResult);
    if (invoiceArray.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoice = invoiceArray[0] as any;

    if (invoice.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Invoice is already paid' },
        { status: 400 }
      );
    }

    const amountToPay = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0');
    
    if (amountToPay <= 0) {
      return NextResponse.json(
        { error: 'No amount due for this invoice' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const result = await createRazorpayOrder(
      amountToPay,
      'INR',
      invoice.invoice_number,
      {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        supplier_name: invoice.supplier_name,
        supplier_email: invoice.supplier_email,
        po_number: invoice.po_number || invoice.rfq_number,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to create payment order', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: amountToPay,
        supplierName: invoice.supplier_name,
        poNumber: invoice.po_number || invoice.rfq_number,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Error creating supplier payment order:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
