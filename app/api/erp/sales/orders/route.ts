import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesOrders, salesOrderLines, salesHistory, stockLevels } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';import { notifySalesOrder } from '@/lib/warehouseNotifications';

// GET /api/erp/sales/orders
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view sales orders' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const conditions = [eq(salesOrders.erpOrganizationId, user.erpOrganizationId)];
    
    if (status) {
      conditions.push(eq(salesOrders.status, status));
    }
    
    if (customerId) {
      conditions.push(eq(salesOrders.customerId, customerId));
    }

    const orders = await erpDb.query.salesOrders.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(salesOrders.createdAt)],
    });

    return NextResponse.json({ orders: orders, salesOrders: orders });
  } catch (error: any) {
    logDatabaseError('Fetching sales orders', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/sales/orders
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create sales orders' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      customerId,
      warehouseId,
      expectedDeliveryDate,
      shippingAddress,
      notes,
      lines,
    } = body;

    if (!customerId || !warehouseId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate SO number with retry logic
    let soNumber = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const lastSO = await erpDb.query.salesOrders.findFirst({
        where: eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
        orderBy: [desc(salesOrders.soNumber)],
      });

      const nextNum = (lastSO ? parseInt(lastSO.soNumber.replace('SO', '')) : 0) + 1;
      soNumber = `SO${String(nextNum).padStart(6, '0')}`;
      
      // Check if exists
      const existing = await erpDb.query.salesOrders.findFirst({
        where: and(
          eq(salesOrders.erpOrganizationId, user.erpOrganizationId),
          eq(salesOrders.soNumber, soNumber)
        ),
      });
      
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique SO number' }, { status: 500 });
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const lineSubtotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
      const lineDiscount = lineSubtotal * (parseFloat(line.discount || 0) / 100);
      const afterDiscount = lineSubtotal - lineDiscount;
      subtotal += lineSubtotal;
      totalDiscountAmount += lineDiscount;
      taxAmount += afterDiscount * (parseFloat(line.taxRate || 0) / 100);
    }

    // Create sales order
    const [newSO] = await erpDb
      .insert(salesOrders)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        customerId,
        warehouseId,
        soNumber,
        expectedDeliveryDate: expectedDeliveryDate || null,
        status: 'draft',
        subtotal: subtotal.toFixed(2),
        discountAmount: totalDiscountAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: (subtotal - totalDiscountAmount + taxAmount).toFixed(2),
        shippingAddress,
        notes,
        createdBy: user.id,
      })
      .returning();

    // Create SO lines
    const soLines = await erpDb
      .insert(salesOrderLines)
      .values(
        lines.map((line: any) => {
          const lineSubtotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
          const discountAmount = lineSubtotal * (parseFloat(line.discount || 0) / 100);
          return {
            salesOrderId: newSO.id,
            productId: line.productId,
            productVariantId: sanitizeUuid(line.productVariantId),
            warehouseLocationId: sanitizeUuid(line.warehouseLocationId),
            description: line.description,
            quantityOrdered: line.quantity,
            uomId: sanitizeUuid(line.uomId),
            unitPrice: line.unitPrice,
            discountPercentage: line.discount || '0',
            discountAmount: discountAmount.toFixed(2),
            taxRate: line.taxRate || '0',
            notes: line.notes,
          };
        })
      )
      .returning();

    // Send email notification to warehouse
    console.log('🔔 Sending sales order email notification...');
    try {
      const customerResult = await erpDb.execute(sql`
        SELECT name FROM customers WHERE id = ${customerId}
      `);
      const customer = Array.from(customerResult)[0] as any;
      const customerName = customer?.name || 'Customer';
      
      console.log(`Notifying warehouse ${warehouseId} about SO ${soNumber}`);
      await notifySalesOrder(warehouseId, soNumber, customerName);
      console.log('✅ Sales order notification sent');
    } catch (emailError) {
      console.error('❌ Failed to send sales order notification:', emailError);
      // Don't fail the API if email fails
    }

    return NextResponse.json(
      { salesOrder: { ...newSO, lines: soLines } },
      { status: 201 }
    );
  } catch (error: any) {
    logDatabaseError('Creating sales order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
