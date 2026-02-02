import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { verifyRazorpaySignature, fetchPaymentDetails } from '@/lib/razorpayService';
import { notifySupplierPaymentMade } from '@/lib/supplierNotifications';

// POST /api/payment/supplier/verify - Verify supplier payment and update invoice
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
    const paymentDate = new Date((payment.created_at || 0) * 1000).toISOString().split('T')[0];

    // Get current invoice details
    const invoiceResult = await erpDb.execute(sql`
      SELECT 
        si.id,
        si.invoice_number,
        si.total_amount,
        si.paid_amount,
        si.supplier_id,
        sq.submission_number as quotation_number,
        po.po_number,
        rfq.rfq_number,
        s.name as supplier_name
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
    const currentPaidAmount = parseFloat(invoice.paid_amount || '0');
    const newPaidAmount = currentPaidAmount + amountPaid;
    const totalAmount = parseFloat(invoice.total_amount);
    const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial';

    // Update supplier invoice with payment details
    await erpDb.execute(sql`
      UPDATE supplier_invoices
      SET 
        paid_amount = ${newPaidAmount.toFixed(2)},
        payment_status = ${newStatus},
        payment_method = 'razorpay',
        payment_reference = ${razorpay_payment_id},
        payment_date = ${paymentDate},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `);

    // Log payment transaction
    await erpDb.execute(sql`
      INSERT INTO supplier_invoice_payments (
        supplier_invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes,
        created_by,
        created_at
      ) VALUES (
        ${invoiceId},
        ${paymentDate},
        ${amountPaid.toFixed(2)},
        'razorpay',
        ${razorpay_payment_id},
        'Payment via Razorpay',
        ${user.id},
        NOW()
      )
    `);

    // Create supplier portal notification
    await erpDb.execute(sql`
      INSERT INTO supplier_portal_notifications (
        supplier_id,
        notification_type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        ${invoice.supplier_id},
        'payment_received',
        'Payment Received',
        ${`Payment of ₹${amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received for invoice ${invoice.invoice_number}`},
        'invoice',
        ${invoiceId}
      )
    `);

    // Send email notification to supplier
    console.log('🔔 Sending payment notification email to supplier...');
    try {
      await notifySupplierPaymentMade(
        invoice.supplier_id,
        razorpay_payment_id,
        amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        paymentDate,
        invoice.po_number || invoice.rfq_number || 'N/A'
      );
      console.log('✅ Supplier payment notification sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send payment email:', emailError);
      // Don't fail the API call if email fails
    }

    console.log(`✅ Supplier payment verified: Invoice ${invoice.invoice_number}, Amount: ₹${amountPaid}`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and invoice updated successfully',
      payment: {
        invoiceNumber: invoice.invoice_number,
        supplierName: invoice.supplier_name,
        amountPaid,
        newPaidAmount,
        status: newStatus,
        paymentId: razorpay_payment_id,
        paymentDate,
      },
    });
  } catch (error: any) {
    console.error('Error verifying supplier payment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
