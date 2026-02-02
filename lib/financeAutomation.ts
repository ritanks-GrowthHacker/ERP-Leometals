import { erpDb } from './db';
import { customerInvoices, customerInvoiceLines, paymentAllocations } from './db/schema/finance';
import { salesOrders } from './db/schema/purchasing-sales';
import { eq } from 'drizzle-orm';
import { sendEmail } from './emailServices';

interface InvoiceLine {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRate?: number;
}

/**
 * Automatically generate invoice from sales order
 */
export async function generateInvoiceFromSalesOrder(
  salesOrderId: string,
  organizationId: string,
  userId: string
) {
  try {
    // Fetch sales order with items and customer
    const salesOrder = await erpDb.query.salesOrders.findFirst({
      where: eq(salesOrders.id, salesOrderId),
      with: {
        lines: true,
        customer: true,
      },
    });

    if (!salesOrder) {
      throw new Error('Sales order not found');
    }

    if (!salesOrder.customer || Array.isArray(salesOrder.customer)) {
      throw new Error('Customer not found for sales order');
    }

    // Check if invoice already exists for this sales order
    const existingInvoice = await erpDb.query.customerInvoices.findFirst({
      where: eq(customerInvoices.salesOrderId, salesOrderId),
    });

    if (existingInvoice) {
      return { success: false, message: 'Invoice already exists for this sales order', invoiceId: existingInvoice.id };
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(organizationId);

    // Calculate due date (default: 30 days from order date)
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const invoiceLines: any[] = [];

    if (salesOrder.lines && Array.isArray(salesOrder.lines)) {
      for (const item of salesOrder.lines) {
        const lineTotal = item.quantity * item.unitPrice;
        const lineTax = lineTotal * (item.taxRate || 0) / 100;
        
        subtotal += lineTotal;
        taxAmount += lineTax;

        invoiceLines.push({
          productId: item.productId,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: item.taxRate || 0,
          taxAmount: lineTax,
          lineTotal: lineTotal + lineTax,
        });
      }
    }

    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const [invoice] = await erpDb.insert(customerInvoices).values({
      erpOrganizationId: organizationId,
      invoiceNumber,
      customerId: salesOrder.customerId,
      salesOrderId: salesOrderId,
      invoiceDate: invoiceDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: '0',
      totalAmount: totalAmount.toString(),
      paidAmount: '0',
      outstandingAmount: totalAmount.toString(),
      status: 'draft',
      createdBy: userId,
    }).returning();

    // Insert invoice lines
    const linesToInsert = invoiceLines.map(line => ({
      ...line,
      invoiceId: invoice.id,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent.toString(),
      discountAmount: line.discountAmount.toString(),
      taxRate: line.taxRate.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
    }));

    await erpDb.insert(customerInvoiceLines).values(linesToInsert);

    // Send invoice email to customer
    if (salesOrder.customer && !Array.isArray(salesOrder.customer)) {
      await sendInvoiceEmail(invoice.id, salesOrder.customer);
    }

    return {
      success: true,
      message: 'Invoice generated successfully',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw error;
  }
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get the count of invoices for this organization
  const invoices = await erpDb.query.customerInvoices.findMany({
    where: eq(customerInvoices.erpOrganizationId, organizationId),
  });

  const count = invoices.length + 1;
  return `INV-${year}${month}-${String(count).padStart(5, '0')}`;
}

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(invoiceId: string, customer: any) {
  try {
    // Fetch invoice with lines
    const invoice = await erpDb.query.customerInvoices.findFirst({
      where: eq(customerInvoices.id, invoiceId),
      with: {
        lines: true,
        customer: true,
      },
    });

    if (!invoice || !invoice.customer) {
      throw new Error('Invoice or customer not found');
    }

    const customer = invoice.customer;
    const customerEmail = customer && !Array.isArray(customer) && 'email' in customer ? customer.email : null;
    
    if (!customerEmail) {
      console.log('Customer email not found, skipping email notification');
      return;
    }

    // Generate HTML email content
    const emailContent = generateInvoiceEmailHtml(invoice);

    await sendEmail({
      to: customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} from Your Company`,
      html: emailContent,
    });

    // Update sent_at timestamp
    await erpDb.update(customerInvoices)
      .set({ sentAt: new Date() })
      .where(eq(customerInvoices.id, invoiceId));

    console.log(`Invoice email sent to ${customerEmail}`);
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
}

/**
 * Generate HTML content for invoice email
 */
function generateInvoiceEmailHtml(invoice: any): string {
  const lines = invoice.lines || [];
  
  const lineItemsHtml = lines.map((line: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${line.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${line.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(line.unitPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(line.lineTotal).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 28px;">Invoice</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px;">#${invoice.invoiceNumber}</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="margin-bottom: 30px;">
          <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Payment Terms:</strong> ${invoice.paymentTerms || 'Net 30'}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #667eea; margin-bottom: 10px;">Bill To:</h3>
          <p style="margin: 5px 0;"><strong>${invoice.customer.name}</strong></p>
          <p style="margin: 5px 0;">${invoice.customer.email}</p>
          ${invoice.customer.phone ? `<p style="margin: 5px 0;">${invoice.customer.phone}</p>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 20px;">
          <p style="margin: 8px 0;"><strong>Subtotal:</strong> ₹${parseFloat(invoice.subtotal).toFixed(2)}</p>
          <p style="margin: 8px 0;"><strong>Tax:</strong> ₹${parseFloat(invoice.taxAmount).toFixed(2)}</p>
          ${parseFloat(invoice.discountAmount) > 0 ? `<p style="margin: 8px 0;"><strong>Discount:</strong> -₹${parseFloat(invoice.discountAmount).toFixed(2)}</p>` : ''}
          <p style="margin: 12px 0; font-size: 20px; color: #667eea;"><strong>Total Amount:</strong> ₹${parseFloat(invoice.totalAmount).toFixed(2)}</p>
          ${parseFloat(invoice.outstandingAmount) > 0 ? `<p style="margin: 8px 0; color: #dc2626;"><strong>Amount Due:</strong> ₹${parseFloat(invoice.outstandingAmount).toFixed(2)}</p>` : ''}
        </div>

        ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 5px;">
          <h4 style="margin: 0 0 10px 0;">Notes:</h4>
          <p style="margin: 0;">${invoice.notes}</p>
        </div>
        ` : ''}

        ${invoice.termsAndConditions ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 3px;">
          <h4 style="margin: 0 0 10px 0;">Terms & Conditions:</h4>
          <p style="margin: 0; font-size: 14px;">${invoice.termsAndConditions}</p>
        </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p style="margin: 5px 0;">Thank you for your business!</p>
          <p style="margin: 5px 0;">If you have any questions about this invoice, please contact us.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send payment reminder email for overdue invoices
 */
export async function sendPaymentReminderEmail(invoiceId: string) {
  try {
    const invoice = await erpDb.query.customerInvoices.findFirst({
      where: eq(customerInvoices.id, invoiceId),
      with: {
        customer: true,
      },
    });

    if (!invoice || !invoice.customer) {
      return;
    }

    const customer = invoice.customer;
    const customerEmail = customer && !Array.isArray(customer) && 'email' in customer ? customer.email : null;
    const customerName = customer && !Array.isArray(customer) && 'name' in customer ? customer.name : 'Valued Customer';
    
    if (!customerEmail) {
      return;
    }

    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Reminder</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; padding: 20px; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">Payment Reminder</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Dear ${customerName},</p>
          
          <p>This is a friendly reminder that invoice <strong>#${invoice.invoiceNumber}</strong> is now <strong>${daysOverdue} days overdue</strong>.</p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> ₹${parseFloat(invoice.outstandingAmount).toFixed(2)}</p>
          </div>

          <p>We kindly request that you process this payment at your earliest convenience.</p>
          
          <p>If you have already made the payment, please disregard this reminder. If you have any questions or concerns, please don't hesitate to contact us.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>Accounts Receivable Team</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: customerEmail,
      subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} is Overdue`,
      html: emailContent,
    });

    console.log(`Payment reminder sent for invoice ${invoice.invoiceNumber}`);
  } catch (error) {
    console.error('Error sending payment reminder:', error);
  }
}

/**
 * Check and send reminders for overdue invoices (to be run daily via cron)
 */
export async function checkOverdueInvoices(organizationId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const allInvoices = await erpDb.query.customerInvoices.findMany({
      where: eq(customerInvoices.erpOrganizationId, organizationId),
      with: {
        customer: true,
      },
    });

    const overdueInvoices = allInvoices.filter((inv: any) => {
      return inv.dueDate < today && parseFloat(inv.outstandingAmount) > 0;
    });

    for (const invoice of overdueInvoices) {
      // Update status to overdue
      await erpDb.update(customerInvoices)
        .set({ status: 'overdue' })
        .where(eq(customerInvoices.id, invoice.id));

      // Send reminder email
      await sendPaymentReminderEmail(invoice.id);
    }

    console.log(`Processed ${overdueInvoices.length} overdue invoices`);
  } catch (error) {
    console.error('Error checking overdue invoices:', error);
  }
}
