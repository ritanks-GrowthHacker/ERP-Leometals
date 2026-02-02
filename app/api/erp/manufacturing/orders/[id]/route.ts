import { NextRequest, NextResponse } from 'next/server';
import { erpDb as db } from '@/lib/db';
import { manufacturingOrders, moOperations, materialConsumption, productionOutput, products, workCenters, boms } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// GET /api/erp/manufacturing/orders/[id] - Get MO details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'view')) {
    return NextResponse.json({ error: 'No permission to view orders' }, { status: 403 });
  }

  try {
    // Await params since Next.js 15 requires this
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    // Get MO details
    const orderDetails = await db
      .select({
        id: manufacturingOrders.id,
        moNumber: manufacturingOrders.moNumber,
        productName: products.name,
        bomNumber: boms.bomNumber,
        status: manufacturingOrders.status,
        actualStart: manufacturingOrders.actualStart,
        actualEnd: manufacturingOrders.actualEnd,
        notes: manufacturingOrders.notes,
        createdAt: manufacturingOrders.createdAt,
      })
      .from(manufacturingOrders)
      .leftJoin(products, eq(manufacturingOrders.productId, products.id))
      .leftJoin(boms, eq(manufacturingOrders.bomId, boms.id))
      .where(eq(manufacturingOrders.id, id));

    if (!orderDetails || orderDetails.length === 0) {
      return NextResponse.json({ error: 'Manufacturing order not found' }, { status: 404 });
    }

    // Get operations
    const operations = await db
      .select({
        id: moOperations.id,
        operationName: moOperations.operationName,
        workCenter: workCenters.name,
        workCenterCode: workCenters.code,
        setupTime: moOperations.setupTime,
        runTime: moOperations.runTime,
        actualTime: moOperations.actualTime,
        status: moOperations.status,
        sequence: moOperations.sequence,
      })
      .from(moOperations)
      .leftJoin(workCenters, eq(moOperations.workCenterId, workCenters.id))
      .where(eq(moOperations.moId, id))
      .orderBy(moOperations.sequence);

    // Get material consumption
    const materials = await db
      .select({
        id: materialConsumption.id,
        componentName: products.name,
        componentSku: products.sku,
        requiredQty: materialConsumption.requiredQuantity,
        consumedQty: materialConsumption.consumedQuantity,
        uom: products.uomId,
      })
      .from(materialConsumption)
      .leftJoin(products, eq(materialConsumption.productId, products.id))
      .where(eq(materialConsumption.moId, id));

    // Get production output
    const output = await db
      .select({
        id: productionOutput.id,
        outputDate: productionOutput.outputDate,
        quantity: productionOutput.quantity,
        warehouse: productionOutput.warehouseId,
      })
      .from(productionOutput)
      .where(eq(productionOutput.moId, id));

    return NextResponse.json({
      ...orderDetails[0],
      operations,
      materialConsumption: materials,
      productionOutput: output,
    });
  } catch (error) {
    console.error('Error fetching MO details:', error);
    return NextResponse.json({ error: 'Failed to fetch MO details' }, { status: 500 });
  }
}

// PUT /api/erp/manufacturing/orders/[id] - Update MO
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit orders' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await req.json();

    // Convert empty strings to null for UUID fields
    const updateData = {
      ...body,
      sourceWarehouseId: body.sourceWarehouseId === '' ? null : body.sourceWarehouseId,
      destinationWarehouseId: body.destinationWarehouseId === '' ? null : body.destinationWarehouseId,
      updatedAt: new Date(),
    };

    const updatedOrders = await db
      .update(manufacturingOrders)
      .set(updateData)
      .where(eq(manufacturingOrders.id, id))
      .returning();

    if (!updatedOrders || updatedOrders.length === 0) {
      return NextResponse.json({ error: 'Manufacturing order not found' }, { status: 404 });
    }

    return NextResponse.json(updatedOrders[0]);
  } catch (error) {
    console.error('Error updating MO:', error);
    return NextResponse.json({ error: 'Failed to update MO' }, { status: 500 });
  }
}

// DELETE /api/erp/manufacturing/orders/[id] - Delete MO
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'manufacturing', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete orders' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    await db.delete(manufacturingOrders).where(eq(manufacturingOrders.id, id));

    return NextResponse.json({ message: 'Manufacturing order deleted successfully' });
  } catch (error) {
    console.error('Error deleting MO:', error);
    return NextResponse.json({ error: 'Failed to delete MO' }, { status: 500 });
  }
}