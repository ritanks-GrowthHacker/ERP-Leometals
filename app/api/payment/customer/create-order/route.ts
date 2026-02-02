import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createRazorpayOrder } from '@/lib/razorpayService';

// POST /api/payment/customer/create-order - Create Razorpay order for customer invoice payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get invoice details
    const invoiceResult = await erpDb.execute(sql`
      SELECT 
        si.id,
        si.invoice_number,
        si.total_amount,
        si.paid_amount,
        si.balance_amount,
        si.status,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ${invoiceId}
    `);

    const invoiceArray = Array.from(invoiceResult);
    if (invoiceArray.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoice = invoiceArray[0] as any;

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Invoice is already paid' },
        { status: 400 }
      );
    }

    // Calculate actual balance amount dynamically
    const totalAmount = parseFloat(invoice.total_amount || '0');
    const paidAmount = parseFloat(invoice.paid_amount || '0');
    const amountToPay = totalAmount - paidAmount;
    
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
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
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
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Error creating customer payment order:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
