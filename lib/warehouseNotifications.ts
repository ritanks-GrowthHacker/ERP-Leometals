// Warehouse Notification Service
// Sends email notifications to warehouse managers and warehouse email addresses

import { sendEmail } from './emailServices';
import { erpDb } from './db';
import { eq } from 'drizzle-orm';
import { warehouses } from './db/schema';

interface NotificationParams {
  warehouseId: string;
  subject: string;
  message: string;
  htmlContent?: string;
  eventType: string;
}

export async function sendWarehouseNotification({
  warehouseId,
  subject,
  message,
  htmlContent,
  eventType,
}: NotificationParams): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Fetch warehouse details with manager
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
      with: {
        manager: true,
      },
    });

    if (!warehouse) {
      errors.push('Warehouse not found');
      return { success: false, errors };
    }

    const emailsToSend: string[] = [];

    // Add warehouse email if exists
    if (warehouse.email) {
      emailsToSend.push(warehouse.email);
    }

    // Add manager email if exists (check if manager is an object and has email)
    if (warehouse.manager && !Array.isArray(warehouse.manager) && 'email' in warehouse.manager && warehouse.manager.email) {
      emailsToSend.push(warehouse.manager.email);
    }

    if (emailsToSend.length === 0) {
      const msg = `⚠️ No emails configured for warehouse: ${warehouse.name} (${warehouse.id})`;
      console.warn(msg);
      console.warn(`  - Warehouse email: ${warehouse.email || 'NOT SET'}`);
      console.warn(`  - Manager email: ${(warehouse.manager && !Array.isArray(warehouse.manager) && 'email' in warehouse.manager) ? warehouse.manager.email : 'NOT SET'}`);
      errors.push(msg);
      return { success: false, errors };
    }

    console.log(`📧 Preparing to send warehouse notification to ${emailsToSend.length} recipient(s):`);
    console.log(`   Warehouse: ${warehouse.name} (${warehouse.code})`);
    console.log(`   Recipients: ${emailsToSend.join(', ')}`);
    console.log(`   Subject: ${subject}`);

    // Prepare email content
    const emailHtml = htmlContent || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Warehouse Notification</h1>
            <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 14px;">${warehouse.name} (${warehouse.code})</p>
          </div>
          <div style="padding: 30px;">
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1e40af; font-weight: 600;">${eventType}</p>
            </div>
            <div style="color: #374151; line-height: 1.6;">
              ${message}
            </div>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              This is an automated notification from ERP System
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails to all recipients
    const sendPromises = emailsToSend.map(async (email) => {
      try {
        console.log(`  → Sending to: ${email}...`);
        const result = await sendEmail({
          to: email,
          subject: `[${warehouse.code}] ${subject}`,
          html: emailHtml,
        });
        
        if (!result.success) {
          console.error(`  ✗ Failed to send to ${email}: ${result.error}`);
          errors.push(`Failed to send to ${email}: ${result.error}`);
        } else {
          console.log(`  ✓ Successfully sent to ${email}`);
        }
        
        return result.success;
      } catch (error) {
        console.error(`  ✗ Error sending to ${email}:`, error);
        errors.push(`Error sending to ${email}: ${error}`);
        return false;
      }
    });

    const results = await Promise.all(sendPromises);
    const allSuccess = results.every((r) => r);

    if (allSuccess) {
      console.log(`✅ All warehouse notification emails sent successfully`);
    } else {
      console.error(`⚠️ Some warehouse notification emails failed. Errors:`, errors);
    }

    return {
      success: allSuccess,
      errors,
    };
  } catch (error) {
    console.error('Error sending warehouse notification:', error);
    errors.push(`System error: ${error}`);
    return { success: false, errors };
  }
}

// Specific notification functions for different events

export async function notifyLowStock(warehouseId: string, productName: string, currentQty: number, reorderPoint: number) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Low Stock Alert',
    message: `
      <p><strong>Alert:</strong> Stock level is below reorder point.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Product:</td>
          <td style="padding: 8px 0; font-weight: 600;">${productName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Current Quantity:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${currentQty}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Reorder Point:</td>
          <td style="padding: 8px 0; font-weight: 600;">${reorderPoint}</td>
        </tr>
      </table>
      <p style="margin-top: 20px; color: #991b1b; font-weight: 600;">Action Required: Please review and place a purchase order.</p>
    `,
    eventType: '⚠️ Low Stock Alert',
  });
}

export async function notifyProcurementAccepted(warehouseId: string, poNumber: string, supplierName: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Procurement Accepted',
    message: `
      <p>A purchase order has been accepted by the supplier and will be delivered to your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">PO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
          <td style="padding: 8px 0; font-weight: 600;">${supplierName}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please prepare for receiving the goods.</p>
    `,
    eventType: '✅ Procurement Accepted',
  });
}

export async function notifyQuotationSent(warehouseId: string, poNumber: string, supplierName: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Quotation Sent Against PO',
    message: `
      <p>A quotation has been sent to the supplier for purchase order.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">PO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
          <td style="padding: 8px 0; font-weight: 600;">${supplierName}</td>
        </tr>
      </table>
    `,
    eventType: '📤 Quotation Sent',
  });
}

export async function notifyGoodsReceipt(warehouseId: string, grNumber: string, poNumber: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Goods Receipt Generated',
    message: `
      <p>A goods receipt has been generated for your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">GR Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${grNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">PO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please verify the received goods against this receipt.</p>
    `,
    eventType: '📦 Goods Receipt',
  });
}

export async function notifyInvoiceGenerated(warehouseId: string, invoiceNumber: string, type: 'purchase' | 'sales') {
  return sendWarehouseNotification({
    warehouseId,
    subject: `${type === 'purchase' ? 'Purchase' : 'Sales'} Invoice Generated`,
    message: `
      <p>A ${type} invoice has been generated involving your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
        </tr>
      </table>
    `,
    eventType: '🧾 Invoice Generated',
  });
}

export async function notifySalesOrder(warehouseId: string, soNumber: string, customerName: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'New Sales Order',
    message: `
      <p>A new sales order has been created for your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">SO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${soNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please prepare for order fulfillment.</p>
    `,
    eventType: '🛒 New Sales Order',
  });
}

export async function notifyStockAdjustment(warehouseId: string, adjustmentNumber: string, adjustmentType: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Stock Adjustment Created',
    message: `
      <p>A stock adjustment has been created for your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Adjustment Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${adjustmentNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Type:</td>
          <td style="padding: 8px 0; font-weight: 600;">${adjustmentType}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please review the adjustment details.</p>
    `,
    eventType: '📊 Stock Adjustment',
  });
}

export async function notifyManufacturingOrder(warehouseId: string, moNumber: string, productName: string) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Manufacturing Order',
    message: `
      <p>A manufacturing order has been created involving your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">MO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${moNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Product:</td>
          <td style="padding: 8px 0; font-weight: 600;">${productName}</td>
        </tr>
      </table>
    `,
    eventType: '🏭 Manufacturing Order',
  });
}

export async function notifyRestock(warehouseId: string, productName: string, quantity: number) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Product Restocked',
    message: `
      <p>A product has been restocked in your warehouse.</p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Product:</td>
          <td style="padding: 8px 0; font-weight: 600;">${productName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Quantity Added:</td>
          <td style="padding: 8px 0; font-weight: 600;">${quantity} units</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">The restock operation has been completed successfully with warehouse manager approval.</p>
    `,
    eventType: '📦 Restock Complete',
  });
}

// Sales-related notifications

export async function notifySalesQuotationAccepted(
  warehouseId: string,
  quotationNumber: string,
  customerName: string,
  totalAmount: string
) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Sales Quotation Accepted',
    message: `
      <p><strong>A sales quotation has been accepted by the customer.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Quotation Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${quotationNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #10b981; font-size: 18px;">₹${totalAmount}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please prepare for order fulfillment.</p>
    `,
    eventType: '✅ Sales Quotation Accepted',
  });
}

export async function notifySalesOrderPicked(
  warehouseId: string,
  salesOrderNumber: string,
  customerName: string,
  deliveryPartner?: string
) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Sales Order Picked Up',
    message: `
      <p><strong>A sales order has been picked up for delivery.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Sales Order Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${salesOrderNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
        ${deliveryPartner ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Delivery Partner:</td>
          <td style="padding: 8px 0; font-weight: 600;">${deliveryPartner}</td>
        </tr>
        ` : ''}
      </table>
      <p style="margin-top: 20px;">🚚 The order is now out for delivery.</p>
    `,
    eventType: '🚚 Order Picked Up',
  });
}

export async function notifySalesOrderDelivered(
  warehouseId: string,
  salesOrderNumber: string,
  customerName: string,
  deliveredDate: string
) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Sales Order Delivered',
    message: `
      <p><strong>A sales order has been successfully delivered.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Sales Order Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${salesOrderNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Delivered On:</td>
          <td style="padding: 8px 0; font-weight: 600;">${new Date(deliveredDate).toLocaleDateString('en-IN')}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">✅ Order fulfillment complete.</p>
    `,
    eventType: '✅ Order Delivered',
  });
}

export async function notifySalesInvoiceGenerated(
  warehouseId: string,
  invoiceNumber: string,
  customerName: string,
  totalAmount: string
) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Sales Invoice Generated',
    message: `
      <p><strong>A sales invoice has been generated.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #10b981; font-size: 18px;">₹${totalAmount}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">The invoice is ready to be sent to the customer.</p>
    `,
    eventType: '🧾 Sales Invoice Generated',
  });
}

export async function notifySalesInvoiceSent(
  warehouseId: string,
  invoiceNumber: string,
  customerName: string,
  totalAmount: string,
  dueDate?: string
) {
  return sendWarehouseNotification({
    warehouseId,
    subject: 'Sales Invoice Sent to Customer',
    message: `
      <p><strong>A sales invoice has been sent to the customer.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
          <td style="padding: 8px 0; font-weight: 600;">${customerName}</td>
        </tr>
        ${dueDate ? `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${new Date(dueDate).toLocaleDateString('en-IN')}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #10b981; font-size: 18px;">₹${totalAmount}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">⚠️ Awaiting customer payment.</p>
    `,
    eventType: '📧 Invoice Sent',
  });
}

