import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { goodsReceipts, goodsReceiptLines, purchaseOrders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id } = params;
    
    // Handle empty body
    let body: any = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      // Empty body is fine
    }

    // Get PO with lines
    const po = await erpDb.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.warehouseId, user.warehouseId)
      ),
      with: {
        lines: true,
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (!po.warehouseId || !po.supplierId) {
      return NextResponse.json({ error: 'Purchase order missing required data' }, { status: 400 });
    }

    const warehouseId = po.warehouseId;
    const supplierId = po.supplierId;

    // Generate receipt number
    const receiptNumber = `GRN${Date.now().toString().slice(-8)}`;
    const receiptDate = new Date().toISOString().split('T')[0];

    // Create goods receipt
    const receiptData = {
      erpOrganizationId: user.organizationId,
      purchaseOrderId: id,
      warehouseId,
      supplierId,
      receiptNumber,
      receiptDate,
      deliveryNoteNumber: null,
      vehicleNumber: null,
      driverName: null,
      status: 'received' as const,
      notes: body.notes || null,
      receivedBy: user.id,
    };
    
    const grResult = await erpDb.insert(goodsReceipts).values(receiptData).returning();

    const receipt = grResult[0];

    // Create receipt lines
    if (!po.lines || po.lines.length === 0) {
      return NextResponse.json({ error: 'Purchase order has no line items' }, { status: 400 });
    }

    const lineValues = po.lines.map((line: any) => ({
      goodsReceiptId: receipt.id,
      purchaseOrderLineId: line.id,
      productId: line.productId,
      productVariantId: null,
      warehouseLocationId: null,
      quantityOrdered: line.quantityOrdered.toString(),
      quantityReceived: line.quantityOrdered.toString(),
      quantityAccepted: line.quantityOrdered.toString(),
      quantityRejected: '0',
      uomId: line.uomId || null,
      rejectionReason: null,
      notes: '',
    }));

    await erpDb.insert(goodsReceiptLines).values(lineValues);

    return NextResponse.json({ 
      receipt,
      message: 'Goods receipt created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating goods receipt:', error);
    return NextResponse.json(
      { error: 'Failed to create goods receipt', details: error.message },
      { status: 500 }
    );
  }
}
