import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { vendorInvoices, vendorInvoiceLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql, desc } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/purchasing/invoices
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view invoices' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');

    const result = await erpDb.execute(sql`
      SELECT 
        vi.*,
        s.name as supplier_name,
        po.po_number,
        COUNT(vil.id) as line_count
      FROM vendor_invoices vi
      LEFT JOIN suppliers s ON vi.supplier_id = s.id
      LEFT JOIN purchase_orders po ON vi.purchase_order_id = po.id
      LEFT JOIN vendor_invoice_lines vil ON vi.id = vil.vendor_invoice_id
      WHERE vi.erp_organization_id = ${user.erpOrganizationId}
      ${status ? sql`AND vi.status = ${status}` : sql``}
      ${supplierId ? sql`AND vi.supplier_id = ${supplierId}` : sql``}
      GROUP BY vi.id, s.name, po.po_number
      ORDER BY vi.created_at DESC
    `);

    return NextResponse.json({ invoices: Array.from(result) });
  } catch (error: any) {
    logDatabaseError('Fetching invoices', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/purchasing/invoices
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create invoices' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { 
      supplierId, 
      purchaseOrderId, 
      invoiceNumber, 
      invoiceDate, 
      dueDate,
      shippingCharges,
      discountAmount,
      notes, 
      lines 
    } = body;

    if (!supplierId || !invoiceNumber || !invoiceDate || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    
    lines.forEach((line: any) => {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      const discount = parseFloat(line.discountPercentage || 0);
      const lineTotal = qty * price * (1 - discount / 100);
      subtotal += lineTotal;
      taxAmount += lineTotal * (parseFloat(line.taxRate || 0) / 100);
    });

    const totalAmount = subtotal + taxAmount + parseFloat(shippingCharges || 0) - parseFloat(discountAmount || 0);

    // Create invoice
    const invoiceResult = await erpDb.insert(vendorInvoices).values({
      erpOrganizationId: user.erpOrganizationId,
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      invoiceNumber,
      invoiceDate,
      dueDate,
      status: 'pending',
      currencyCode: 'INR',
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: discountAmount?.toString() || '0',
      shippingCharges: shippingCharges?.toString() || '0',
      totalAmount: totalAmount.toString(),
      amountPaid: '0',
      notes,
      createdBy: user.id,
    }).returning();

    // Create invoice lines
    const lineValues = lines.map((line: any) => {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      const discount = parseFloat(line.discountPercentage || 0);
      const lineTotal = qty * price * (1 - discount / 100);
      
      return {
        vendorInvoiceId: invoiceResult[0].id,
        purchaseOrderLineId: line.purchaseOrderLineId || null,
        productId: line.productId,
        productVariantId: line.productVariantId || null,
        description: line.description || '',
        quantity: line.quantity.toString(),
        uomId: line.uomId || null,
        unitPrice: line.unitPrice.toString(),
        taxRate: line.taxRate?.toString() || '0',
        discountPercentage: line.discountPercentage?.toString() || '0',
        lineTotal: lineTotal.toString(),
        notes: line.notes || '',
      };
    });

    await erpDb.insert(vendorInvoiceLines).values(lineValues);

    return NextResponse.json({ 
      invoice: invoiceResult[0],
      message: 'Invoice created successfully'
    });
  } catch (error: any) {
    logDatabaseError('Creating invoice', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
