import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';

// Core function to send email to customer
async function sendCustomerNotification({
  customerId,
  subject,
  message,
  eventType,
}: {
  customerId: string;
  subject: string;
  message: string;
  eventType: string;
}): Promise<boolean> {
  try {
    console.log(`🔔 Sending customer notification: ${eventType}`);
    console.log('Customer ID:', customerId);

    // Get customer details
    const customerResult = await erpDb.execute(sql`
      SELECT id, name, email
      FROM customers
      WHERE id = ${customerId}
    `);

    const customerArray = Array.from(customerResult);
    if (customerArray.length === 0) {
      console.warn('⚠️ Customer not found:', customerId);
      return false;
    }

    const customer = customerArray[0] as any;
    
    if (!customer.email) {
      console.warn('⚠️ Customer has no email configured:', customer.name);
      return false;
    }

    console.log('📧 Preparing to send email to customer:', customer.name);
    console.log('Email address:', customer.email);

    // Orange/amber gradient theme for customer emails
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
                <!-- Header with orange gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #fb923c 0%, #f97316 100%); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
                      ${eventType}
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px;">
                      Dear ${customer.name},
                    </p>
                    
                    ${message}
                    
                    <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      If you have any questions, please don't hesitate to contact us.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      This is an automated notification from your ERP System.<br>
                      Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail({
      to: customer.email,
      subject,
      html: htmlContent,
    });

    console.log('✅ Customer notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send customer notification:', error);
    return false;
  }
}

// Notify customer when quotation is accepted
export async function notifyCustomerQuotationAccepted(
  customerId: string,
  quotationNumber: string,
  totalAmount: string
): Promise<boolean> {
  console.log('📧 Notifying customer of quotation acceptance:', { customerId, quotationNumber });
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Your Quotation Has Been Accepted',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Great news! Your quotation has been accepted.
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Quotation Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${quotationNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #fb923c; font-size: 18px;">₹${totalAmount}</td>
        </tr>
      </table>
      <p style="margin: 20px 0 0 0; color: #374151; font-size: 14px;">
        We will begin processing your order shortly.
      </p>
    `,
    eventType: '✅ Quotation Accepted',
  });
}

// Notify customer when sales order is created
export async function notifyCustomerSalesOrder(
  customerId: string,
  salesOrderNumber: string,
  totalAmount: string,
  expectedDeliveryDate?: string
): Promise<boolean> {
  console.log('📧 Notifying customer of sales order:', { customerId, salesOrderNumber });
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Your Sales Order Has Been Created',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Your sales order has been successfully created and is being processed.
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Sales Order Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${salesOrderNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #fb923c; font-size: 18px;">₹${totalAmount}</td>
        </tr>
        ${expectedDeliveryDate ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Expected Delivery:</td>
          <td style="padding: 8px 0; font-weight: 600;">${new Date(expectedDeliveryDate).toLocaleDateString('en-IN')}</td>
        </tr>
        ` : ''}
      </table>
      <p style="margin: 20px 0 0 0; color: #374151; font-size: 14px;">
        You will receive updates as your order progresses.
      </p>
    `,
    eventType: '📦 Sales Order Created',
  });
}

// Notify customer when order is picked for delivery
export async function notifyCustomerOrderPicked(
  customerId: string,
  salesOrderNumber: string,
  deliveryPartnerName?: string
): Promise<boolean> {
  console.log('📧 Notifying customer of order pickup:', { customerId, salesOrderNumber });
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Your Order Is Out for Delivery',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Your order has been picked up and is on its way to you!
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Sales Order Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${salesOrderNumber}</td>
        </tr>
        ${deliveryPartnerName ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Delivery Partner:</td>
          <td style="padding: 8px 0; font-weight: 600;">${deliveryPartnerName}</td>
        </tr>
        ` : ''}
      </table>
      <p style="margin: 20px 0 0 0; color: #374151; font-size: 14px;">
        🚚 Your order is in transit and will be delivered soon.
      </p>
    `,
    eventType: '🚚 Out for Delivery',
  });
}

// Notify customer when order is delivered
export async function notifyCustomerOrderDelivered(
  customerId: string,
  salesOrderNumber: string,
  deliveredDate: string
): Promise<boolean> {
  console.log('📧 Notifying customer of delivery:', { customerId, salesOrderNumber });
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Your Order Has Been Delivered',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        🎉 Your order has been successfully delivered!
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Sales Order Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${salesOrderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Delivered On:</td>
          <td style="padding: 8px 0; font-weight: 600;">${new Date(deliveredDate).toLocaleDateString('en-IN')}</td>
        </tr>
      </table>
      <p style="margin: 20px 0 0 0; color: #374151; font-size: 14px;">
        Thank you for your business! We hope you enjoy your order.
      </p>
    `,
    eventType: '✅ Order Delivered',
  });
}

// Notify customer when invoice is generated
export async function notifyCustomerInvoiceGenerated(
  customerId: string,
  invoiceNumber: string,
  totalAmount: string,
  dueDate?: string,
  invoiceId?: string
): Promise<boolean> {
  console.log('📧 Notifying customer of invoice:', { customerId, invoiceNumber });
  
  // Create payment link if invoiceId provided
  const paymentLink = invoiceId 
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/customer/${invoiceId}`
    : undefined;
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Your Invoice Is Ready',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Your invoice has been generated and is ready for payment.
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
        </tr>
        ${dueDate ? `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${new Date(dueDate).toLocaleDateString('en-IN')}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #fb923c; font-size: 20px;">₹${totalAmount}</td>
        </tr>
      </table>
      ${paymentLink ? `
      <div style="margin: 25px 0; text-align: center;">
        <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #fb923c 0%, #f97316 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Pay Now
        </a>
      </div>
      ` : ''}
      <p style="margin: 20px 0 0 0; color: #374151; font-size: 14px;">
        Please ensure timely payment to avoid any service interruptions.
      </p>
    `,
    eventType: '🧾 Invoice Generated',
  });
}

// Notify customer when invoice is sent
export async function notifyCustomerInvoiceSent(
  customerId: string,
  invoiceNumber: string,
  totalAmount: string,
  dueDate?: string,
  invoiceId?: string
): Promise<boolean> {
  console.log('📧 Notifying customer of invoice sent:', { customerId, invoiceNumber });
  
  // Create payment link if invoiceId provided
  const paymentLink = invoiceId 
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/customer/${invoiceId}`
    : undefined;
  
  return await sendCustomerNotification({
    customerId,
    subject: 'Invoice Payment Required',
    message: `
      <p style="margin: 0 0 15px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        ⚠️ Your invoice requires payment. Please pay at your earliest convenience.
      </p>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
        </tr>
        ${dueDate ? `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${new Date(dueDate).toLocaleDateString('en-IN')}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Amount Due:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #dc2626; font-size: 20px;">₹${totalAmount}</td>
        </tr>
      </table>
      ${paymentLink ? `
      <div style="margin: 25px 0; text-align: center;">
        <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Pay Now
        </a>
      </div>
      ` : ''}
      <p style="margin: 20px 0 0 0; color: #dc2626; font-size: 14px; font-weight: 600;">
        Payment is now due. Please pay immediately to avoid late fees.
      </p>
    `,
    eventType: '⚠️ Payment Required',
  });
}
