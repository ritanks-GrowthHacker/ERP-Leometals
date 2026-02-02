import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { purchaseOrders, purchaseOrderLines } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/purchasing/orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view purchase orders' },
      { status: 403 }
    );
  }

  try {
    const orderId = id;

    const order = await erpDb.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, orderId),
        eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        supplier: true,
        warehouse: true,
        lines: {
          with: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    logDatabaseError('Fetching purchase order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/purchasing/orders/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit purchase orders' },
      { status: 403 }
    );
  }

  try {
    const orderId = id;
    const body = await req.json();
    const {
      supplierId,
      warehouseId,
      poDate,
      expectedDeliveryDate,
      status,
      notes,
      lines,
    } = body;

    // Verify order exists and belongs to organization
    const existingOrder = await erpDb.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, orderId),
        eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if order can be edited (only draft and sent can be edited)
    if (existingOrder.status && !['draft', 'sent'].includes(existingOrder.status)) {
      return NextResponse.json(
        { error: 'Only draft or sent orders can be edited' },
        { status: 400 }
      );
    }

    // Calculate totals from lines
    let subtotal = 0;
    let taxAmount = 0;
    
    if (lines && Array.isArray(lines) && lines.length > 0) {
      for (const line of lines) {
        // Extract numeric values with fallbacks
        const qty = Number(line.quantity || line.quantityOrdered || 0);
        const price = Number(line.unitPrice || 0);
        const tax = Number(line.taxRate || 0);
        
        // Skip invalid lines
        if (!isNaN(qty) && !isNaN(price) && !isNaN(tax)) {
          const lineTotal = qty * price;
          subtotal += lineTotal;
          taxAmount += (lineTotal * tax) / 100;
        }
      }
    }
    
    // Ensure no NaN values
    const finalSubtotal = isNaN(subtotal) || !isFinite(subtotal) ? 0 : subtotal;
    const finalTaxAmount = isNaN(taxAmount) || !isFinite(taxAmount) ? 0 : taxAmount;
    const finalTotalAmount = finalSubtotal + finalTaxAmount;

    // Update purchase order
    const [updatedOrder] = await erpDb
      .update(purchaseOrders)
      .set({
        supplierId: supplierId || existingOrder.supplierId,
        warehouseId: warehouseId || existingOrder.warehouseId,
        poDate: poDate ? poDate : existingOrder.poDate,
        expectedDeliveryDate: expectedDeliveryDate || existingOrder.expectedDeliveryDate,
        status: status || existingOrder.status,
        notes,
        subtotal: finalSubtotal.toFixed(2),
        taxAmount: finalTaxAmount.toFixed(2),
        totalAmount: finalTotalAmount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId))
      .returning();

    // Update lines if provided
    if (lines && lines.length > 0) {
      // Delete existing lines
      await erpDb
        .delete(purchaseOrderLines)
        .where(eq(purchaseOrderLines.purchaseOrderId, orderId));

      // Insert new lines
      const linesToInsert = lines.map((line: any) => ({
        purchaseOrderId: orderId,
        productId: line.productId,
        productVariantId: line.productVariantId || null,
        description: line.description,
        quantityOrdered: line.quantityOrdered || line.quantity,
        uomId: line.uomId || null,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate || 0,
        expectedDeliveryDate: line.expectedDeliveryDate
          ? new Date(line.expectedDeliveryDate)
          : null,
        notes: line.notes || null,
      }));

      await erpDb.insert(purchaseOrderLines).values(linesToInsert);
    }

    // Fetch updated order with relations
    const finalOrder = await erpDb.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, orderId),
      with: {
        supplier: true,
        warehouse: true,
        lines: {
          with: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    return NextResponse.json({ order: finalOrder });
  } catch (error: any) {
    logDatabaseError('Updating purchase order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// DELETE /api/erp/purchasing/orders/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireErpAccess(req, 'manager');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'delete')) {
    return NextResponse.json(
      { error: 'No permission to delete purchase orders' },
      { status: 403 }
    );
  }

  try {
    const orderId = id;

    // Verify order exists and belongs to organization
    const existingOrder = await erpDb.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, orderId),
        eq(purchaseOrders.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only draft orders can be deleted
    if (existingOrder.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft orders can be deleted' },
        { status: 400 }
      );
    }

    // Delete order (cascade will delete lines)
    await erpDb.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));

    return NextResponse.json({ message: 'Purchase order deleted successfully' });
  } catch (error: any) {
    logDatabaseError('Deleting purchase order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

