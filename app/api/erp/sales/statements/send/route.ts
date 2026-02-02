import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';
import { generateStatementEmail } from '@/lib/emailTemplates';

// POST /api/erp/sales/statements/send
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to send statements' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { customerId, email, startDate, endDate } = body;

    if (!customerId || !email) {
      return NextResponse.json(
        { error: 'Customer ID and email are required' },
        { status: 400 }
      );
    }

    // Get customer details
    const customerResult = await erpDb.execute(sql`
      SELECT id, name, code, email, phone
      FROM customers
      WHERE id = ${customerId}
        AND erp_organization_id = ${user.erpOrganizationId}
    `);

    if (customerResult.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customer = customerResult[0] as {
      id: string;
      name: string;
      code: string;
      email: string;
      phone: string;
    };

    // Get invoices for the period
    const invoices = await erpDb.execute(sql`
      SELECT 
        invoice_number,
        invoice_date,
        due_date,
        total_amount,
        paid_amount,
        balance_amount,
        status
      FROM sales_invoices
      WHERE customer_id = ${customerId}
        AND erp_organization_id = ${user.erpOrganizationId}
        ${startDate ? sql`AND invoice_date >= CAST(${startDate} AS DATE)` : sql``}
        ${endDate ? sql`AND invoice_date <= CAST(${endDate} AS DATE)` : sql``}
      ORDER BY invoice_date DESC
    `) as any[];

    // Calculate totals
    const totalInvoiced = invoices.reduce((sum, inv: any) => 
      sum + parseFloat(inv.total_amount || '0'), 0
    );
    const totalPaid = invoices.reduce((sum, inv: any) => 
      sum + parseFloat(inv.paid_amount || '0'), 0
    );
    const totalOutstanding = invoices.reduce((sum, inv: any) => 
      sum + parseFloat(inv.balance_amount || '0'), 0
    );

    // Generate email content
    const emailContent = generateStatementEmail({
      customer: {
        name: customer.name,
        code: customer.code,
        email: customer.email,
      },
      invoices: invoices as any,
      startDate: startDate || 'All time',
      endDate: endDate || new Date().toISOString().split('T')[0],
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    });

    // Send email
    await sendEmail({
      to: email,
      subject: `Account Statement - ${customer.name}`,
      html: emailContent,
    });

    return NextResponse.json({ 
      message: 'Statement sent successfully',
      sentTo: email,
      invoiceCount: invoices.length,
    });
  } catch (error: any) {
    console.error('Error sending statement:', error);
    return NextResponse.json(
      { error: 'Failed to send statement', message: error.message },
      { status: 500 }
    );
  }
}
