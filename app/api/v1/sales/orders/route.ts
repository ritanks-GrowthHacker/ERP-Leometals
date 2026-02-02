import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/sales/orders
 * List all sales orders
 * Requires: JWT token with 'read' scope
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const warehouseId = searchParams.get('warehouse_id');

    let conditions = sql`so.erp_organization_id = ${user.erpOrganizationId}`;

    if (status) {
      conditions = sql`${conditions} AND so.status = ${status}`;
    }

    if (customerId) {
      conditions = sql`${conditions} AND so.customer_id = ${customerId}`;
    }

    if (warehouseId) {
      conditions = sql`${conditions} AND so.warehouse_id = ${warehouseId}`;
    }

    const result = await erpDb.execute(sql`
      SELECT 
        so.*,
        c.name as customer_name,
        c.email as customer_email,
        w.name as warehouse_name,
        w.code as warehouse_code
      FROM sales_orders so
      INNER JOIN customers c ON so.customer_id = c.id
      INNER JOIN warehouses w ON so.warehouse_id = w.id
      WHERE ${conditions}
      ORDER BY so.so_date DESC, so.created_at DESC
    `);

    const salesOrders = result.map((row: any) => ({
      id: row.id,
      soNumber: row.so_number,
      soDate: row.so_date,
      expectedDeliveryDate: row.expected_delivery_date,
      status: row.status,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      warehouseCode: row.warehouse_code,
      currencyCode: row.currency_code,
      subtotal: row.subtotal,
      taxAmount: row.tax_amount,
      totalAmount: row.total_amount,
      paymentTerms: row.payment_terms,
      shippingAddress: row.shipping_address,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: salesOrders
    });

  } catch (error: any) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales orders', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/sales/orders
 * Create a new sales order with order lines
 * Requires: JWT token with 'write' scope
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { 
      customerId,
      warehouseId,
      soNumber,
      soDate,
      expectedDeliveryDate,
      currencyCode,
      paymentTerms,
      shippingAddress,
      notes,
      lines
    } = body;

    // Helper function to convert empty strings to null
    const sanitizeValue = (value: any) => {
      if (value === '' || value === undefined || value === null) return null;
      return value;
    };

    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validate required fields
    if (!customerId || !warehouseId || !soNumber) {
      return NextResponse.json(
        { success: false, error: 'Customer ID, Warehouse ID, and SO Number are required' },
        { status: 400 }
      );
    }

    // Validate UUIDs
    if (!uuidRegex.test(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    if (!uuidRegex.test(warehouseId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid warehouse ID format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one order line is required' },
        { status: 400 }
      );
    }

    // Validate all product IDs in lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId || !uuidRegex.test(line.productId)) {
        return NextResponse.json(
          { success: false, error: `Invalid product ID format in line ${i + 1}. Must be a valid UUID.` },
          { status: 400 }
        );
      }
      
      const sanitizedVariantId = sanitizeValue(line.productVariantId);
      if (sanitizedVariantId && !uuidRegex.test(sanitizedVariantId)) {
        return NextResponse.json(
          { success: false, error: `Invalid product variant ID format in line ${i + 1}. Must be a valid UUID.` },
          { status: 400 }
        );
      }
      
      const sanitizedUomId = sanitizeValue(line.uomId);
      if (sanitizedUomId && !uuidRegex.test(sanitizedUomId)) {
        return NextResponse.json(
          { success: false, error: `Invalid UOM ID format in line ${i + 1}. Must be a valid UUID.` },
          { status: 400 }
        );
      }
    }

    // Verify customer exists and belongs to organization
    const customerCheck = await erpDb.execute(sql`
      SELECT id FROM customers 
      WHERE id = ${customerId} 
      AND erp_organization_id = ${user.erpOrganizationId}
    `);

    if (!customerCheck || customerCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Verify warehouse exists and belongs to organization
    const warehouseCheck = await erpDb.execute(sql`
      SELECT id FROM warehouses 
      WHERE id = ${warehouseId} 
      AND erp_organization_id = ${user.erpOrganizationId}
    `);

    if (!warehouseCheck || warehouseCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Warehouse not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if SO number already exists
    const existingSO = await erpDb.execute(sql`
      SELECT id FROM sales_orders 
      WHERE so_number = ${soNumber} 
      AND erp_organization_id = ${user.erpOrganizationId}
    `);

    if (existingSO && existingSO.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Sales Order number already exists' },
        { status: 409 }
      );
    }

    // Verify all products exist before creating order
    for (const line of lines) {
      const productCheck = await erpDb.execute(sql`
        SELECT id, name, sku 
        FROM products 
        WHERE id = ${line.productId}
        AND erp_organization_id = ${user.erpOrganizationId}
      `);

      if (!productCheck || productCheck.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Product with ID ${line.productId} not found or does not belong to your organization`
          },
          { status: 404 }
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const line of lines) {
      if (!line.productId || !line.quantityOrdered || line.unitPrice === undefined || line.unitPrice === null) {
        return NextResponse.json(
          { success: false, error: 'Each line must have productId, quantityOrdered, and unitPrice' },
          { status: 400 }
        );
      }

      const lineSubtotal = parseFloat(line.quantityOrdered) * parseFloat(line.unitPrice);
      const lineTax = lineSubtotal * (parseFloat(line.taxRate || 0) / 100);
      
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    // Create sales order
    const salesOrderResult = await erpDb.execute(sql`
      INSERT INTO sales_orders (
        erp_organization_id,
        customer_id,
        warehouse_id,
        so_number,
        so_date,
        expected_delivery_date,
        status,
        currency_code,
        subtotal,
        tax_amount,
        total_amount,
        payment_terms,
        shipping_address,
        notes,
        created_by
      )
      VALUES (
        ${user.erpOrganizationId},
        ${customerId},
        ${warehouseId},
        ${soNumber},
        ${sanitizeValue(soDate) || new Date().toISOString().split('T')[0]},
        ${sanitizeValue(expectedDeliveryDate)},
        'draft',
        ${sanitizeValue(currencyCode) || 'USD'},
        ${subtotal},
        ${taxAmount},
        ${totalAmount},
        ${paymentTerms || 30},
        ${sanitizeValue(shippingAddress)},
        ${sanitizeValue(notes)},
        ${user.userId}
      )
      RETURNING *
    `);

    const salesOrder = salesOrderResult[0] as any;

    // Create sales order lines
    const linesData = [];
    for (const line of lines) {
      const lineResult = await erpDb.execute(sql`
        INSERT INTO sales_order_lines (
          sales_order_id,
          product_id,
          product_variant_id,
          description,
          quantity_ordered,
          uom_id,
          unit_price,
          tax_rate,
          notes
        )
        VALUES (
          ${salesOrder.id},
          ${line.productId},
          ${sanitizeValue(line.productVariantId)},
          ${sanitizeValue(line.description)},
          ${line.quantityOrdered},
          ${sanitizeValue(line.uomId)},
          ${line.unitPrice},
          ${line.taxRate || 0},
          ${sanitizeValue(line.notes)}
        )
        RETURNING *
      `);

      const orderLine = lineResult[0] as any;
      const lineSubtotal = parseFloat(line.quantityOrdered) * parseFloat(line.unitPrice);
      const lineTax = lineSubtotal * (parseFloat(line.taxRate || 0) / 100);
      const lineTotal = lineSubtotal + lineTax;

      linesData.push({
        id: orderLine.id,
        productId: orderLine.product_id,
        productVariantId: orderLine.product_variant_id,
        description: orderLine.description,
        quantityOrdered: parseFloat(orderLine.quantity_ordered),
        quantityDelivered: parseFloat(orderLine.quantity_delivered || 0),
        uomId: orderLine.uom_id,
        unitPrice: parseFloat(orderLine.unit_price),
        taxRate: parseFloat(orderLine.tax_rate),
        lineTotal: lineTotal,
        notes: orderLine.notes,
        createdAt: orderLine.created_at
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sales order created successfully',
      data: {
        id: salesOrder.id,
        soNumber: salesOrder.so_number,
        soDate: salesOrder.so_date,
        expectedDeliveryDate: salesOrder.expected_delivery_date,
        status: salesOrder.status,
        customerId: salesOrder.customer_id,
        warehouseId: salesOrder.warehouse_id,
        currencyCode: salesOrder.currency_code,
        subtotal: parseFloat(salesOrder.subtotal),
        taxAmount: parseFloat(salesOrder.tax_amount),
        totalAmount: parseFloat(salesOrder.total_amount),
        paymentTerms: salesOrder.payment_terms,
        shippingAddress: salesOrder.shipping_address,
        notes: salesOrder.notes,
        createdAt: salesOrder.created_at,
        updatedAt: salesOrder.updated_at,
        lines: linesData
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating sales order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sales order', details: error.message },
      { status: 500 }
    );
  }
}