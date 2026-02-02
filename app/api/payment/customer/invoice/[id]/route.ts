import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/payment/customer/invoice/[id] - Public endpoint for customer invoice details
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const invoiceId = params.id;

    // Fetch invoice with customer details
    const invoiceResult = await erpDb.execute(sql`
      SELECT 
        si.id,
        si.invoice_number,
        si.invoice_date,
        si.due_date,
        si.status,
        si.subtotal,
        si.tax_amount,
        si.total_amount,
        si.paid_amount,
        si.balance_amount,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
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

    // Calculate actual balance amount
    const totalAmount = parseFloat(invoice.total_amount || '0');
    const paidAmount = parseFloat(invoice.paid_amount || '0');
    const balanceAmount = (totalAmount - paidAmount).toFixed(2);

    // Return invoice details in a format matching the payment page expectations
    return NextResponse.json({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      subtotal: invoice.subtotal,
      taxAmount: invoice.tax_amount,
      totalAmount: invoice.total_amount,
      paidAmount: invoice.paid_amount || '0',
      balanceAmount: balanceAmount,
      customer: {
        id: invoice.customer_id,
        name: invoice.customer_name,
        email: invoice.customer_email,
        phone: invoice.customer_phone,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoice for payment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
