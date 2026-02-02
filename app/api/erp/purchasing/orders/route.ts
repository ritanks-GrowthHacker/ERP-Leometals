import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { purchaseOrders, purchaseOrderLines, suppliers, warehouses } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sanitizeUuid } from '@/lib/utils/sanitize-uuid';

// GET /api/erp/purchasing/orders
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view purchase orders' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');

    const conditions = [eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId)];
    
    if (status) {
      conditions.push(eq(purchaseOrders.status, status));
    }
    
    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    const orders = await erpDb.query.purchaseOrders.findMany({
      where: and(...conditions),
      with: {
        supplier: true,
        warehouse: true,
        location: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(purchaseOrders.createdAt)],
    });

    // Add hasReceipt flag by checking if PO has any receipts
    const ordersWithReceipts = await Promise.all(
      orders.map(async (order) => {
        const receiptResult = await erpDb.execute(sql`
          SELECT COUNT(*) as count
          FROM po_goods_receipts
          WHERE purchase_order_id = ${order.id}
        `);
        const hasReceipt = parseInt((Array.from(receiptResult)[0] as any).count || '0') > 0;
        return { ...order, hasReceipt };
      })
    );

    return NextResponse.json({ purchaseOrders: ordersWithReceipts });
  } catch (error: any) {
    logDatabaseError('Fetching purchase orders', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/purchasing/orders
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create purchase orders' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      supplierId,
      warehouseId,
      locationId,
      expectedDeliveryDate,
      notes,
      lines,
      gstNumber,
      placeOfSupply,
    } = body;

    // For draft POs without supplier, allow creation
    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Generate PO number with retry logic
    let poNumber = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const lastPO = await erpDb.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId),
        orderBy: [desc(purchaseOrders.poNumber)],
      });

      const nextNum = (lastPO ? parseInt(lastPO.poNumber.replace('PO', '')) : 0) + 1;
      poNumber = `PO${String(nextNum).padStart(6, '0')}`;
      
      // Check if exists
      const existing = await erpDb.query.purchaseOrders.findFirst({
        where: and(
          eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId),
          eq(purchaseOrders.poNumber, poNumber)
        ),
      });
      
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique PO number' }, { status: 500 });
    }

    // Calculate totals including GST
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    // Get warehouse state for GST calculation
    let warehouseState = null;
    if (warehouseId) {
      const warehouse = await erpDb.query.warehouses.findFirst({
        where: eq(warehouses.id, warehouseId),
      });
      warehouseState = warehouse?.state;
    }

    // Get supplier state for GST calculation
    let supplierState = null;
    if (supplierId) {
      const supplier = await erpDb.query.suppliers.findFirst({
        where: eq(suppliers.id, supplierId),
      });
      supplierState = supplier?.gstState || supplier?.state;
    }

    for (const line of lines) {
      const quantity = parseFloat(line.quantity || line.quantityOrdered || 0);
      const unitPrice = parseFloat(line.unitPrice || 0);
      const gstRate = parseFloat(line.gstRate || line.taxRate || 0);
      
      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;

      // Calculate GST based on state (intra-state: CGST+SGST, inter-state: IGST)
      const gstAmount = lineTotal * (gstRate / 100);
      
      if (warehouseState && supplierState && warehouseState.toUpperCase() === supplierState.toUpperCase()) {
        // Same state: CGST + SGST
        totalCgst += gstAmount / 2;
        totalSgst += gstAmount / 2;
      } else {
        // Different state or unknown: IGST
        totalIgst += gstAmount;
      }
    }

    const taxAmount = totalCgst + totalSgst + totalIgst;

    // Create purchase order
    const [newPO] = await erpDb
      .insert(purchaseOrders)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        supplierId: sanitizeUuid(supplierId),
        warehouseId: sanitizeUuid(warehouseId),
        locationId: sanitizeUuid(locationId),
        poNumber,
        expectedDeliveryDate: expectedDeliveryDate || null,
        status: 'draft',
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        cgstAmount: totalCgst.toFixed(2),
        sgstAmount: totalSgst.toFixed(2),
        igstAmount: totalIgst.toFixed(2),
        totalAmount: (subtotal + taxAmount).toFixed(2),
        gstNumber: gstNumber || null,
        placeOfSupply: placeOfSupply || supplierState || null,
        notes,
        createdBy: user.id,
      })
      .returning();

    // Create PO lines with GST calculations
    const poLines = await erpDb
      .insert(purchaseOrderLines)
      .values(
        lines.map((line: any) => {
          const quantity = parseFloat(line.quantity || line.quantityOrdered || 0);
          const unitPrice = parseFloat(line.unitPrice || 0);
          const gstRate = parseFloat(line.gstRate || line.taxRate || 0);
          const lineTotal = quantity * unitPrice;
          const gstAmount = lineTotal * (gstRate / 100);

          let cgstRate = 0, sgstRate = 0, igstRate = 0;
          let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

          // Determine if intra-state or inter-state
          if (warehouseState && supplierState && warehouseState.toUpperCase() === supplierState.toUpperCase()) {
            // Same state: split GST into CGST + SGST
            cgstRate = gstRate / 2;
            sgstRate = gstRate / 2;
            cgstAmount = gstAmount / 2;
            sgstAmount = gstAmount / 2;
          } else {
            // Different state: IGST
            igstRate = gstRate;
            igstAmount = gstAmount;
          }

          return {
            purchaseOrderId: newPO.id,
            productId: line.productId,
            productVariantId: sanitizeUuid(line.productVariantId),
            description: line.description,
            quantityOrdered: line.quantity,
            uomId: sanitizeUuid(line.uomId),
            unitPrice: line.unitPrice,
            taxRate: gstRate.toFixed(2),
            cgstRate: cgstRate.toFixed(2),
            sgstRate: sgstRate.toFixed(2),
            igstRate: igstRate.toFixed(2),
            cgstAmount: cgstAmount.toFixed(2),
            sgstAmount: sgstAmount.toFixed(2),
            igstAmount: igstAmount.toFixed(2),
            hsnCode: line.hsnCode || line.hsn_code || null,
            expectedDeliveryDate: line.expectedDeliveryDate || null,
            notes: line.notes,
          };
        })
      )
      .returning();

    return NextResponse.json(
      { purchaseOrder: { ...newPO, lines: poLines } },
      { status: 201 }
    );
  } catch (error: any) {
    logDatabaseError('Creating purchase order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
