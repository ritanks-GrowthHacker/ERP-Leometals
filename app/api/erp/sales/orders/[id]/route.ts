import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesOrders, salesOrderLines, salesHistory, stockLevels, products } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { notifyCustomerOrderPicked, notifyCustomerOrderDelivered } from '@/lib/customerNotifications';
import { notifySalesOrderPicked, notifySalesOrderDelivered } from '@/lib/warehouseNotifications';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/erp/sales/orders/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view sales orders' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    const order = await erpDb.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        customer: true,
        warehouse: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check if there's a delivery assignment
    let deliveryAssignment = null;
    try {
      const deliveryResult = await erpDb.execute(sql`
        SELECT 
          id,
          delivery_partner_name as partner_name,
          delivery_partner_mobile as partner_mobile,
          delivery_partner_email as partner_email,
          status,
          assigned_at,
          picked_up_at,
          delivered_at
         FROM delivery_assignments
         WHERE sales_order_id = ${id}
           AND erp_organization_id = ${user.erpOrganizationId}
      `);
      
      const deliveryResultArray = Array.from(deliveryResult);
      if (deliveryResultArray.length > 0) {
        const delivery = deliveryResultArray[0] as any;
        deliveryAssignment = {
          id: delivery.id,
          partnerName: delivery.partner_name,
          partnerMobile: delivery.partner_mobile,
          partnerEmail: delivery.partner_email,
          status: delivery.status,
          assigned_at: delivery.assigned_at,
          picked_up_at: delivery.picked_up_at,
          delivered_at: delivery.delivered_at,
        };
      }
    } catch (deliveryError) {
      // If delivery_assignments table doesn't exist yet, ignore the error
      console.log('Delivery assignment query failed (table might not exist yet):', deliveryError);
    }

    return NextResponse.json({ 
      salesOrder: {
        ...order,
        deliveryAssignment
      }
    });
  } catch (error: any) {
    logDatabaseError('Fetching sales order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/sales/orders/[id] - Update order status (including delivery)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  console.log('🔥🔥🔥 PUT /api/erp/sales/orders/[id] CALLED 🔥🔥🔥');
  
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to edit sales orders' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, deliveryDate, notes } = body;
    
    console.log(`📝 Request body:`, { id, status, deliveryDate, notes });

    // Get existing order
    const existingOrder = await erpDb.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.erpOrganizationId, user.erpOrganizationId)
      ),
      with: {
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // If status is being changed to 'delivered', record sales history and deduct stock
    console.log(`🚚 Processing delivery for order ${id}, status change: ${existingOrder.status} → ${status}`);
    
    if (status === 'delivered' && existingOrder.status !== 'delivered') {
      console.log(`✅ Confirmed: Order is being delivered. Starting stock deduction...`);
      const deliveryDateObj = deliveryDate ? new Date(deliveryDate) : new Date();
      
      // Calculate period (start of month to end of month for delivered date)
      const periodStart = new Date(deliveryDateObj.getFullYear(), deliveryDateObj.getMonth(), 1);
      const periodEnd = new Date(deliveryDateObj.getFullYear(), deliveryDateObj.getMonth() + 1, 0);

      // Record sales history for each line item
      for (const line of existingOrder.lines) {
        const quantitySold = parseFloat(line.quantityOrdered);
        const unitPrice = parseFloat(line.unitPrice);
        const revenue = quantitySold * unitPrice;

        // Check if sales history already exists for this product/period
        const periodStartStr = periodStart.toISOString().split('T')[0];
        const periodEndStr = periodEnd.toISOString().split('T')[0];
        
        const existingHistory = await erpDb.query.salesHistory.findFirst({
          where: and(
            eq(salesHistory.productId, line.productId),
            eq(salesHistory.warehouseId, existingOrder.warehouseId),
            sql`${salesHistory.periodStart} = ${periodStartStr}`,
            sql`${salesHistory.periodEnd} = ${periodEndStr}`
          ),
        });

        if (existingHistory) {
          // Update existing record
          await erpDb
            .update(salesHistory)
            .set({
              quantitySold: sql`${salesHistory.quantitySold} + ${quantitySold}`,
              revenue: sql`${salesHistory.revenue} + ${revenue}`,
              numberOfOrders: sql`${salesHistory.numberOfOrders} + 1`,
            })
            .where(eq(salesHistory.id, existingHistory.id));
        } else {
          // Insert new record
          await erpDb.insert(salesHistory).values({
            erpOrganizationId: user.erpOrganizationId,
            productId: line.productId,
            warehouseId: existingOrder.warehouseId,
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
            quantitySold: quantitySold.toString(),
            revenue: revenue.toString(),
            numberOfOrders: 1,
            averageOrderQuantity: quantitySold.toString(),
          });
        }

        // Deduct from stock levels - use specific location if provided
        console.log(`📦 Deducting ${quantitySold} units of product ${line.productId} from warehouse ${existingOrder.warehouseId}`);
        console.log(`📍 Line warehouseLocationId: ${line.warehouseLocationId || 'NOT SET'}`);
        console.log(`📋 Full line object:`, JSON.stringify(line, null, 2));
        
        // Build query conditions
        const stockQueryConditions = [
          eq(stockLevels.productId, line.productId),
          eq(stockLevels.warehouseId, existingOrder.warehouseId)
        ];
        
        // If line has a specific location, use it
        if (line.warehouseLocationId) {
          stockQueryConditions.push(eq(stockLevels.locationId, line.warehouseLocationId));
          console.log(`✅ Using specific location: ${line.warehouseLocationId}`);
        } else {
          console.log(`⚠️ No warehouse location ID found in line - will search all locations in warehouse`);
        }
        
        console.log(`🔍 Querying stock_levels with conditions:`, {
          productId: line.productId,
          warehouseId: existingOrder.warehouseId,
          locationId: line.warehouseLocationId || 'ANY'
        });
        
        const stockLevelRecords = await erpDb.query.stockLevels.findMany({
          where: and(...stockQueryConditions),
        });

        console.log(`Found ${stockLevelRecords.length} stock level record(s) for this product`);
        if (stockLevelRecords.length > 0) {
          stockLevelRecords.forEach((rec, idx) => {
            console.log(`  Record ${idx + 1}: locationId=${rec.locationId}, quantityOnHand=${rec.quantityOnHand}`);
          });
        }

        if (stockLevelRecords.length > 0) {
          let remainingToDeduct = quantitySold;
          
          for (const stockLevelRecord of stockLevelRecords) {
            if (remainingToDeduct <= 0) break;
            
            const currentQty = parseFloat(stockLevelRecord.quantityOnHand ?? '0');
            const deductAmount = Math.min(remainingToDeduct, currentQty);
            
            console.log(`🔻 Deducting ${deductAmount} from stock_level ID: ${stockLevelRecord.id}`);
            console.log(`   Location: ${stockLevelRecord.locationId || 'NO LOCATION'}`);
            console.log(`   Current qty: ${currentQty} → New qty: ${currentQty - deductAmount}`);
            
            const result = await erpDb
              .update(stockLevels)
              .set({
                quantityOnHand: sql`quantity_on_hand - ${deductAmount}`,
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, stockLevelRecord.id))
              .returning();
            
            console.log(`   ✅ Updated! New quantityOnHand:`, result[0]?.quantityOnHand);
            
            remainingToDeduct -= deductAmount;
          }
          
          if (remainingToDeduct > 0) {
            console.warn(`⚠️ Could not deduct all quantity. Remaining: ${remainingToDeduct}`);
          } else {
            console.log(`✅ Successfully deducted ${quantitySold} units from stock`);
          }
        } else {
          console.error(`❌ No stock level found for product ${line.productId} in warehouse ${existingOrder.warehouseId}`);
          console.error(`   Searched with locationId: ${line.warehouseLocationId || 'ANY'}`);
          console.error(`   Please check if stock levels exist for this product-warehouse-location combination`);
        }
      }
      console.log(`🎉 Stock deduction complete for all ${existingOrder.lines.length} line items`);
    } else if (status === 'delivered') {
      console.log(`⚠️ Order already delivered, skipping stock deduction`);
    } else {
      console.log(`ℹ️ Status is ${status}, not 'delivered', skipping stock deduction`);
    }

    // Update sales order
    const [updatedOrder] = await erpDb
      .update(salesOrders)
      .set({
        status: status || existingOrder.status,
        notes: notes || existingOrder.notes,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id))
      .returning();

    // Send email notifications based on status change
    if (status && status !== existingOrder.status) {
      console.log('🔔 Sending sales order status change notifications...');
      try {
        const customerResult = await erpDb.execute(sql`
          SELECT id, name FROM customers WHERE id = ${existingOrder.customerId}
        `);
        const customer = Array.from(customerResult)[0] as any;
        const customerName = customer?.name || 'Unknown Customer';

        // Get delivery partner details if available
        let deliveryPartnerName = undefined;
        try {
          const deliveryResult = await erpDb.execute(sql`
            SELECT delivery_partner_name 
            FROM delivery_assignments
            WHERE sales_order_id = ${id}
            LIMIT 1
          `);
          const delivery = Array.from(deliveryResult)[0] as any;
          deliveryPartnerName = delivery?.delivery_partner_name;
        } catch (e) {
          // Ignore if delivery table doesn't exist
        }

        if (status === 'picked' || status === 'in_transit') {
          // Order picked up for delivery
          await notifyCustomerOrderPicked(
            existingOrder.customerId,
            existingOrder.soNumber,
            deliveryPartnerName
          );
          await notifySalesOrderPicked(
            existingOrder.warehouseId,
            existingOrder.soNumber,
            customerName,
            deliveryPartnerName
          );
          console.log('✅ Order pickup notifications sent');
        } else if (status === 'delivered' || status === 'completed') {
          // Order delivered
          await notifyCustomerOrderDelivered(
            existingOrder.customerId,
            existingOrder.soNumber,
            new Date().toISOString()
          );
          await notifySalesOrderDelivered(
            existingOrder.warehouseId,
            existingOrder.soNumber,
            customerName,
            new Date().toISOString()
          );
          console.log('✅ Order delivery notifications sent');
        }
      } catch (emailError) {
        console.error('❌ Failed to send order status emails:', emailError);
        // Don't fail the API call if email fails
      }
    }

    return NextResponse.json({ salesOrder: updatedOrder });
  } catch (error: any) {
    logDatabaseError('Updating sales order', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
