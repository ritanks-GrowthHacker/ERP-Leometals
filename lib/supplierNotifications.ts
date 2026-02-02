// Supplier Notification Service
// Sends email notifications to suppliers for procurement activities

import { sendEmail } from './emailServices';
import { erpDb } from './db';
import { eq } from 'drizzle-orm';
import { suppliers } from './db/schema';

interface SupplierNotificationParams {
  supplierId: string;
  subject: string;
  message: string;
  eventType: string;
}

export async function sendSupplierNotification({
  supplierId,
  subject,
  message,
  eventType,
}: SupplierNotificationParams): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Fetch supplier details
    const supplier = await erpDb.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
    });

    if (!supplier) {
      errors.push('Supplier not found');
      console.error(`Supplier not found: ${supplierId}`);
      return { success: false, errors };
    }

    if (!supplier.email) {
      const msg = `No email configured for supplier: ${supplier.name}`;
      console.log(msg);
      errors.push(msg);
      return { success: false, errors };
    }

    // Create professional HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Supplier Notification</h1>
            <p style="color: #ddd6fe; margin: 10px 0 0 0; font-size: 14px;">${supplier.name} (${supplier.code})</p>
          </div>
          <div style="padding: 30px;">
            <div style="background-color: #faf5ff; border-left: 4px solid #8b5cf6; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #6d28d9; font-weight: 600;">${eventType}</p>
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

    // Send email
    const result = await sendEmail({
      to: supplier.email,
      subject: `[${supplier.code}] ${subject}`,
      html: emailHtml,
    });
    
    if (!result.success) {
      errors.push(`Failed to send to ${supplier.email}: ${result.error}`);
      console.error('Email send failed:', result.error);
      return { success: false, errors };
    }

    console.log(`✅ Supplier notification sent to ${supplier.email}: ${subject}`);
    return { success: true, errors: [] };

  } catch (error: any) {
    console.error('Error sending supplier notification:', error);
    errors.push(error.message || 'Unknown error');
    return { success: false, errors };
  }
}

// RFQ Sent to Supplier
export async function notifySupplierRFQReceived(supplierId: string, rfqNumber: string, issueDate: string, deadline: string) {
  return sendSupplierNotification({
    supplierId,
    subject: 'New Request for Quotation',
    message: `
      <p><strong>You have received a new Request for Quotation (RFQ).</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">RFQ Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${rfqNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Issue Date:</td>
          <td style="padding: 8px 0; font-weight: 600;">${issueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Response Deadline:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${deadline}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please log in to your supplier portal to view the RFQ details and submit your quotation.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal/rfqs" 
           style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View RFQ
        </a>
      </div>
    `,
    eventType: '📨 New RFQ',
  });
}

// Purchase Order Sent to Supplier
export async function notifySupplierPOReceived(supplierId: string, poNumber: string, orderDate: string, expectedDate: string, totalAmount: string) {
  return sendSupplierNotification({
    supplierId,
    subject: 'New Purchase Order',
    message: `
      <p><strong>You have received a new Purchase Order.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">PO Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Order Date:</td>
          <td style="padding: 8px 0; font-weight: 600;">${orderDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Expected Delivery:</td>
          <td style="padding: 8px 0; font-weight: 600;">${expectedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #059669; font-size: 18px;">₹${totalAmount}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Please log in to your supplier portal to view the purchase order details and confirm acceptance.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal/purchase-orders" 
           style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Purchase Order
        </a>
      </div>
    `,
    eventType: '📋 New Purchase Order',
  });
}

// Quotation Accepted by Buyer
export async function notifySupplierQuotationAccepted(supplierId: string, quotationNumber: string, poNumber: string) {
  return sendSupplierNotification({
    supplierId,
    subject: 'Quotation Accepted - PO Generated',
    message: `
      <p><strong>Congratulations! Your quotation has been accepted.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Quotation Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${quotationNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Purchase Order:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #059669;">${poNumber}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">A purchase order has been generated based on your quotation. Please log in to view details and confirm acceptance.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal/purchase-orders" 
           style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Purchase Order
        </a>
      </div>
    `,
    eventType: '✅ Quotation Accepted',
  });
}

// Payment Made
export async function notifySupplierPaymentMade(supplierId: string, paymentNumber: string, amount: string, paymentDate: string, poNumber: string) {
  return sendSupplierNotification({
    supplierId,
    subject: 'Payment Processed',
    message: `
      <p><strong>A payment has been processed for your invoice.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Payment Reference:</td>
          <td style="padding: 8px 0; font-weight: 600;">${paymentNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Purchase Order:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Payment Date:</td>
          <td style="padding: 8px 0; font-weight: 600;">${paymentDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #059669; font-size: 20px;">₹${amount}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">The payment has been successfully processed. Please check your bank account within 2-3 business days.</p>
    `,
    eventType: '💰 Payment Processed',
  });
}

// Goods Receipt Created
export async function notifySupplierGoodsReceived(supplierId: string, grNumber: string, poNumber: string, receivedDate: string) {
  return sendSupplierNotification({
    supplierId,
    subject: 'Goods Receipt Confirmed',
    message: `
      <p><strong>Your delivery has been received and confirmed.</strong></p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Goods Receipt:</td>
          <td style="padding: 8px 0; font-weight: 600;">${grNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Purchase Order:</td>
          <td style="padding: 8px 0; font-weight: 600;">${poNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Received Date:</td>
          <td style="padding: 8px 0; font-weight: 600;">${receivedDate}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">The goods have been inspected and received successfully. Invoice processing will begin shortly.</p>
    `,
    eventType: '📦 Goods Received',
  });
}
