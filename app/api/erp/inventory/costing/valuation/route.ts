import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Fetch inventory valuation layers for FIFO/LIFO calculation
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    let query = sql`
      SELECT 
        ivl.*,
        p.name as product_name,
        w.name as warehouse_name
      FROM inventory_valuation_layers ivl
      JOIN products p ON p.id = ivl.product_id
      JOIN warehouses w ON w.id = ivl.warehouse_id
      WHERE ivl.product_id = ${productId}
      AND ivl.is_consumed = false
      AND ivl.quantity_remaining > 0
    `;

    if (warehouseId) {
      query = sql`${query} AND ivl.warehouse_id = ${warehouseId}`;
    }

    query = sql`${query} ORDER BY ivl.receipt_date ASC`; // FIFO order

    const layers = await erpDb.execute(query);

    // Calculate total value
    const totalQuantity = layers.reduce(
      (sum: number, layer: any) => sum + parseFloat(layer.quantity_remaining),
      0
    );
    const totalValue = layers.reduce(
      (sum: number, layer: any) => sum + parseFloat(layer.total_cost),
      0
    );
    const weightedAverageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    return NextResponse.json({
      layers,
      summary: {
        totalQuantity,
        totalValue,
        weightedAverageCost,
      },
    });
  } catch (error: any) {
    console.error('Error fetching valuation layers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch valuation layers', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Add new inventory receipt layer
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      productId,
      warehouseId,
      quantityReceived,
      unitCost,
      receiptReference,
      valuationMethod,
      notes,
    } = body;

    if (!productId || !warehouseId || !quantityReceived || !unitCost) {
      return NextResponse.json(
        { error: 'Product, warehouse, quantity, and cost are required' },
        { status: 400 }
      );
    }

    const totalCost = parseFloat(quantityReceived) * parseFloat(unitCost);

    const result = await erpDb.execute(sql`
      INSERT INTO inventory_valuation_layers (
        product_id,
        warehouse_id,
        receipt_date,
        receipt_reference,
        quantity_received,
        quantity_remaining,
        unit_cost,
        total_cost,
        valuation_method,
        notes
      ) VALUES (
        ${productId},
        ${warehouseId},
        NOW(),
        ${receiptReference || null},
        ${quantityReceived},
        ${quantityReceived},
        ${unitCost},
        ${totalCost},
        ${valuationMethod || 'FIFO'},
        ${notes || null}
      )
      RETURNING *
    `);

    return NextResponse.json({ layer: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating valuation layer:', error);
    return NextResponse.json(
      { error: 'Failed to create valuation layer', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Consume inventory (reduce quantity from layers using FIFO/LIFO)
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      productId,
      warehouseId,
      quantityToConsume,
      valuationMethod = 'FIFO',
      transactionType = 'sale',
      referenceId,
    } = body;

    if (!productId || !warehouseId || !quantityToConsume) {
      return NextResponse.json(
        { error: 'Product, warehouse, and quantity are required' },
        { status: 400 }
      );
    }

    let remainingToConsume = parseFloat(quantityToConsume);
    let totalCogs = 0;
    const consumedLayers = [];

    // Fetch layers in order (FIFO = ASC, LIFO = DESC)
    const orderDirection = valuationMethod === 'LIFO' ? 'DESC' : 'ASC';
    const layers = await erpDb.execute(sql`
      SELECT * FROM inventory_valuation_layers
      WHERE product_id = ${productId}
      AND warehouse_id = ${warehouseId}
      AND is_consumed = false
      AND quantity_remaining > 0
      ORDER BY receipt_date ${sql.raw(orderDirection)}
      FOR UPDATE
    `);

    // Consume from layers
    for (const layer of layers) {
      if (remainingToConsume <= 0) break;

      const quantityRemaining = parseFloat((layer as any).quantity_remaining);
      const quantityFromThisLayer = Math.min(remainingToConsume, quantityRemaining);
      const costFromThisLayer = quantityFromThisLayer * parseFloat((layer as any).unit_cost);

      // Update layer
      const newQuantityRemaining = quantityRemaining - quantityFromThisLayer;
      await erpDb.execute(sql`
        UPDATE inventory_valuation_layers
        SET
          quantity_remaining = ${newQuantityRemaining},
          is_consumed = ${newQuantityRemaining === 0},
          updated_at = NOW()
        WHERE id = ${(layer as any).id}
      `);

      remainingToConsume -= quantityFromThisLayer;
      totalCogs += costFromThisLayer;

      consumedLayers.push({
        layerId: (layer as any).id,
        quantityConsumed: quantityFromThisLayer,
        unitCost: (layer as any).unit_cost,
        cost: costFromThisLayer,
      });
    }

    // Record COGS transaction
    await erpDb.execute(sql`
      INSERT INTO cogs_transactions (
        erp_organization_id,
        product_id,
        transaction_type,
        transaction_date,
        reference_id,
        quantity,
        unit_cost,
        total_cost,
        valuation_method,
        warehouse_id
      ) VALUES (
        ${user.erpOrganizationId},
        ${productId},
        ${transactionType},
        NOW(),
        ${referenceId || null},
        ${quantityToConsume},
        ${totalCogs / parseFloat(quantityToConsume)},
        ${totalCogs},
        ${valuationMethod},
        ${warehouseId}
      )
    `);

    return NextResponse.json({
      success: true,
      quantityConsumed: parseFloat(quantityToConsume) - remainingToConsume,
      totalCogs,
      averageUnitCost: totalCogs / (parseFloat(quantityToConsume) - remainingToConsume),
      consumedLayers,
    });
  } catch (error: any) {
    console.error('Error consuming inventory:', error);
    return NextResponse.json(
      { error: 'Failed to consume inventory', details: error.message },
      { status: 500 }
    );
  }
}
