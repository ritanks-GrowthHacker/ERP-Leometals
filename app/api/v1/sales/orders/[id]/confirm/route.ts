import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * PATCH /api/v1/sales/orders/[id]/confirm
 * Confirm/Accept a sales order (change status from draft to confirmed)
 * Requires: JWT token with 'write' scope
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  // Await params
  const { id: orderId } = await params;

  try {
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Check if order exists and belongs to organization
    const orderCheck = await erpDb.execute(sql`
      SELECT id, status FROM sales_orders 
      WHERE id = ${orderId} 
      AND erp_organization_id = ${user.erpOrganizationId}
      LIMIT 1
    `);

    if (orderCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sales order not found' },
        { status: 404 }
      );
    }

    const currentOrder = orderCheck[0] as any;

    if (currentOrder.status === 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Sales order is already confirmed' },
        { status: 400 }
      );
    }

    if (currentOrder.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Cannot confirm a cancelled sales order' },
        { status: 400 }
      );
    }

    // Update order status to confirmed
    const updateResult = await erpDb.execute(sql`
      UPDATE sales_orders
      SET 
        status = 'confirmed',
        approved_by = ${user.userId},
        updated_at = NOW()
      WHERE id = ${orderId}
      RETURNING *
    `);

    const updatedOrder = updateResult[0] as any;

    // Get order lines
    const linesResult = await erpDb.execute(sql`
      SELECT 
        sol.*,
        p.name as product_name,
        p.sku as product_sku
      FROM sales_order_lines sol
      INNER JOIN products p ON sol.product_id = p.id
      WHERE sol.sales_order_id = ${orderId}
      ORDER BY sol.created_at ASC
    `);

    const lines = linesResult.map((line: any) => ({
      id: line.id,
      productId: line.product_id,
      productName: line.product_name,
      productSku: line.product_sku,
      productVariantId: line.product_variant_id,
      description: line.description,
      quantityOrdered: line.quantity_ordered,
      quantityDelivered: line.quantity_delivered,
      uomId: line.uom_id,
      unitPrice: line.unit_price,
      taxRate: line.tax_rate,
      notes: line.notes,
      createdAt: line.created_at,
      updatedAt: line.updated_at
    }));

    // Get customer details
    const customerResult = await erpDb.execute(sql`
      SELECT name, email, phone FROM customers 
      WHERE id = ${updatedOrder.customer_id}
      LIMIT 1
    `);

    const customer = customerResult[0] as any;

    // Get warehouse details
    const warehouseResult = await erpDb.execute(sql`
      SELECT name, code FROM warehouses 
      WHERE id = ${updatedOrder.warehouse_id}
      LIMIT 1
    `);

    const warehouse = warehouseResult[0] as any;

    return NextResponse.json({
      success: true,
      message: 'Sales order confirmed successfully',
      data: {
        id: updatedOrder.id,
        soNumber: updatedOrder.so_number,
        soDate: updatedOrder.so_date,
        expectedDeliveryDate: updatedOrder.expected_delivery_date,
        status: updatedOrder.status,
        customerId: updatedOrder.customer_id,
        customerName: customer?.name,
        customerEmail: customer?.email,
        warehouseId: updatedOrder.warehouse_id,
        warehouseName: warehouse?.name,
        warehouseCode: warehouse?.code,
        currencyCode: updatedOrder.currency_code,
        subtotal: updatedOrder.subtotal,
        taxAmount: updatedOrder.tax_amount,
        totalAmount: updatedOrder.total_amount,
        paymentTerms: updatedOrder.payment_terms,
        shippingAddress: updatedOrder.shipping_address,
        notes: updatedOrder.notes,
        approvedBy: updatedOrder.approved_by,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at,
        lines: lines
      }
    });

  } catch (error: any) {
    console.error('Error confirming sales order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm sales order', details: error.message },
      { status: 500 }
    );
  }
}