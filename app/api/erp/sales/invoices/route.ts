import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesInvoices, salesInvoiceLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { notifyCustomerInvoiceGenerated } from '@/lib/customerNotifications';
import { notifySalesInvoiceGenerated } from '@/lib/warehouseNotifications';

// GET /api/erp/sales/invoices
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view invoices' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    const conditions = [eq(salesInvoices.erpOrganizationId, user.organizationId)];

    if (status) {
      conditions.push(eq(salesInvoices.status, status));
    }

    if (search) {
      conditions.push(
        like(salesInvoices.invoiceNumber, `%${search}%`)
      );
    }

    const invoicesList = await erpDb.query.salesInvoices.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(salesInvoices.createdAt)],
      limit,
      offset,
    });

    const [countResult] = await erpDb
      .select({ count: sql<number>`count(*)::int` })
      .from(salesInvoices)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    return NextResponse.json({
      invoices: invoicesList,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    logDatabaseError('Fetching sales invoices', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/sales/invoices
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create invoices' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      customerId,
      salesOrderId,
      dueDate,
      paymentTerms,
      notes,
      lines,
    } = body;

    if (!customerId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Customer and at least one line item are required' },
        { status: 400 }
      );
    }

    // Generate invoice number
    const lastInvoice = await erpDb.query.salesInvoices.findFirst({
      where: eq(salesInvoices.erpOrganizationId, user.organizationId),
      orderBy: [desc(salesInvoices.createdAt)],
    });

    const invoiceNumber = `INV${String(
      (lastInvoice ? parseInt(lastInvoice.invoiceNumber.replace('INV', '')) : 0) + 1
    ).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const lineTotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
      const discount = lineTotal * (parseFloat(line.discount || 0) / 100);
      const afterDiscount = lineTotal - discount;
      subtotal += afterDiscount;
      const lineTax = afterDiscount * (parseFloat(line.taxRate || 0) / 100);
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const [newInvoice] = await erpDb
      .insert(salesInvoices)
      .values({
        erpOrganizationId: user.organizationId,
        customerId,
        salesOrderId: salesOrderId || null,
        invoiceNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: dueDate || null,
        status: 'draft',
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paidAmount: '0',
        balanceAmount: totalAmount.toFixed(2),
        paymentTerms: paymentTerms || 30,
        notes: notes || null,
        createdBy: user.id,
      })
      .returning();

    // Create invoice lines
    const invoiceLines = await erpDb
      .insert(salesInvoiceLines)
      .values(
        lines.map((line: any) => ({
          salesInvoiceId: newInvoice.id,
          productId: line.productId,
          productVariantId: line.productVariantId,
          description: line.description,
          quantity: line.quantity,
          uomId: line.uomId,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate || '0',
          discount: line.discount || '0',
          notes: line.notes,
        }))
      )
      .returning();

    // Send invoice generation notifications
    console.log('🔔 Sending invoice generation notifications...');
    try {
      // Get customer and warehouse details
      const detailsResult = await erpDb.execute(sql`
        SELECT 
          c.id as customer_id,
          c.name as customer_name,
          so.warehouse_id
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        LEFT JOIN sales_orders so ON si.sales_order_id = so.id
        WHERE si.id = ${newInvoice.id}
      `);
      
      const details = Array.from(detailsResult)[0] as any;
      
      if (details) {
        // Email to customer with payment link
        await notifyCustomerInvoiceGenerated(
          details.customer_id,
          invoiceNumber,
          parseFloat(totalAmount.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          dueDate,
          newInvoice.id // Pass invoice ID for payment link
        );
        console.log('✅ Customer notification sent for invoice generation');

        // Email to warehouse if associated with sales order
        if (details.warehouse_id) {
          await notifySalesInvoiceGenerated(
            details.warehouse_id,
            invoiceNumber,
            details.customer_name || 'Unknown Customer',
            parseFloat(totalAmount.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
          );
          console.log('✅ Warehouse notification sent for invoice generation');
        }
      }
    } catch (emailError) {
      console.error('❌ Failed to send invoice generation emails:', emailError);
      // Don't fail the API call if email fails
    }

    return NextResponse.json(
      { invoice: { ...newInvoice, lines: invoiceLines } },
      { status: 201 }
    );
  } catch (error: any) {
    logDatabaseError('Creating sales invoice', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
