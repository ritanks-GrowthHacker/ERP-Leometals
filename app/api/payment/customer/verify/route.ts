import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { verifyRazorpaySignature, fetchPaymentDetails } from '@/lib/razorpayService';

// POST /api/payment/customer/verify - Verify customer payment and update invoice
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return NextResponse.json(
        { error: 'Missing required payment details' },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error('Invalid Razorpay signature');
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Fetch payment details from Razorpay
    const paymentResult = await fetchPaymentDetails(razorpay_payment_id);
    
    if (!paymentResult.success || !paymentResult.payment) {
      return NextResponse.json(
        { error: 'Failed to fetch payment details' },
        { status: 500 }
      );
    }

    const payment = paymentResult.payment as any;
    const amountPaid = (payment.amount || 0) / 100; // Convert from paise to rupees

    // Get current invoice details
    const invoiceResult = await erpDb.execute(sql`
      SELECT 
        id,
        invoice_number,
        total_amount,
        paid_amount,
        balance_amount
      FROM sales_invoices
      WHERE id = ${invoiceId}
    `);

    const invoiceArray = Array.from(invoiceResult);
    if (invoiceArray.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoice = invoiceArray[0] as any;
    const currentPaidAmount = parseFloat(invoice.paid_amount || '0');
    const newPaidAmount = currentPaidAmount + amountPaid;
    const totalAmount = parseFloat(invoice.total_amount);
    const newBalanceAmount = totalAmount - newPaidAmount;
    const newStatus = newBalanceAmount <= 0 ? 'paid' : 'partial';

    // Update invoice with payment details
    await erpDb.execute(sql`
      UPDATE sales_invoices
      SET 
        paid_amount = ${newPaidAmount.toFixed(2)},
        balance_amount = ${newBalanceAmount.toFixed(2)},
        status = ${newStatus},
        payment_method = 'razorpay',
        payment_reference = ${razorpay_payment_id},
        payment_date = NOW(),
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `);

    // Log payment transaction
    await erpDb.execute(sql`
      INSERT INTO sales_invoice_payments (
        sales_invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes,
        created_at
      ) VALUES (
        ${invoiceId},
        NOW(),
        ${amountPaid.toFixed(2)},
        'razorpay',
        ${razorpay_payment_id},
        'Online payment via Razorpay',
        NOW()
      )
    `);

    console.log(`✅ Customer payment verified: Invoice ${invoice.invoice_number}, Amount: ₹${amountPaid}`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and invoice updated successfully',
      payment: {
        invoiceNumber: invoice.invoice_number,
        amountPaid,
        newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
        paymentId: razorpay_payment_id,
      },
    });
  } catch (error: any) {
    console.error('Error verifying customer payment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
