import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get purchase orders for this warehouse
    const query = sql`
      SELECT 
        po.id,
        po.po_number,
        po.po_date,
        po.expected_delivery_date,
        po.status,
        po.total_amount,
        po.currency_code,
        s.name as supplier_name,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM purchase_order_lines WHERE purchase_order_id = po.id) as line_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      WHERE po.warehouse_id = ${user.warehouseId}
      ORDER BY po.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const purchaseOrders = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM purchase_orders
      WHERE warehouse_id = ${user.warehouseId}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      purchaseOrders: Array.from(purchaseOrders),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching warehouse purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { supplierId, warehouseId, expectedDeliveryDate, notes, lines } = body;

    // Validate warehouse manager can only create POs for their warehouse
    if (warehouseId !== user.warehouseId) {
      return NextResponse.json({ error: 'Can only create POs for your assigned warehouse' }, { status: 403 });
    }

    if (!supplierId || !lines || lines.length === 0) {
      return NextResponse.json({ error: 'Supplier and line items are required' }, { status: 400 });
    }

    // Generate PO number
    const poNumberResult = await erpDb.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1 as next_number
      FROM purchase_orders
      WHERE erp_organization_id = ${user.organizationId}
    `);
    const nextNumber = (poNumberResult as any)[0]?.next_number || 1;
    const poNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

    // Calculate total
    const totalAmount = lines.reduce((sum: number, line: any) => 
      sum + (line.quantity * line.unitPrice), 0
    );

    // Insert PO
    const poResult = await erpDb.execute(sql`
      INSERT INTO purchase_orders (
        po_number, supplier_id, warehouse_id, po_date, expected_delivery_date,
        status, total_amount, currency_code, notes, erp_organization_id, created_by
      ) VALUES (
        ${poNumber}, ${supplierId}, ${warehouseId}, NOW(), ${expectedDeliveryDate || null},
        'draft', ${totalAmount}, 'INR', ${notes || null}, ${user.organizationId}, ${user.id}
      ) RETURNING id
    `);
    const poId = (poResult as any)[0]?.id;

    // Insert lines
    for (const line of lines) {
      await erpDb.execute(sql`
        INSERT INTO purchase_order_lines (
          purchase_order_id, product_id, quantity_ordered, unit_price
        ) VALUES (
          ${poId}, ${line.productId}, ${line.quantity}, ${line.unitPrice}
        )
      `);
    }

    return NextResponse.json({ 
      success: true, 
      poId,
      poNumber,
      message: 'Purchase order created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating PO:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order', details: error.message },
      { status: 500 }
    );
  }
}
