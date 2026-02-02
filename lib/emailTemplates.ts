// Email Templates for ERP System

interface PurchaseOrder {
  poNumber: string;
  poDate: string;
  expectedDeliveryDate?: string;
  supplierName: string;
  supplierEmail: string;
  totalAmount: string;
  currencyCode: string;
  lines: Array<{
    productName: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
}

interface RFQ {
  rfqNumber: string;
  rfqDate: string;
  deadlineDate?: string;
  title: string;
  description?: string;
  organizationName: string;
  lines: Array<{
    productName: string;
    description?: string;
    quantity: string;
    targetPrice?: string;
  }>;
  suppliers: Array<{
    name: string;
    email: string;
  }>;
  supplierEmail?: string; // Add this for single supplier context
}

interface SupplierWelcome {
  supplierName: string;
  organizationName: string;
  organizationLogo?: string;
  contactPerson?: string;
}

export const getPurchaseOrderEmailTemplate = (po: PurchaseOrder, organizationName: string, organizationLogo?: string): string => {
  const lineItemsHtml = po.lines.map((line, index) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${line.productName}</strong>
        ${line.description ? `<br><span style="color: #6b7280; font-size: 0.875rem;">${line.description}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${line.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(line.unitPrice).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong>₹${parseFloat(line.total).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order - ${po.poNumber}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .responsive-table { width: 100% !important; font-size: 12px !important; }
          .responsive-table td, .responsive-table th { padding: 6px !important; }
          .responsive-padding { padding: 15px !important; }
          .responsive-text { font-size: 14px !important; }
          .responsive-title { font-size: 22px !important; }
        }
      </style>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 800px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div class="responsive-padding" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          ${organizationLogo ? `<img src="${organizationLogo}" alt="${organizationName}" style="max-width: 150px; margin-bottom: 15px;">` : ''}
          <h1 class="responsive-title" style="color: #ffffff; margin: 0; font-size: 28px;">${organizationName}</h1>
          <p class="responsive-text" style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Purchase Order</p>
        </div>

        <!-- PO Details -->
        <div class="responsive-padding" style="padding: 30px;">
          <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">PO #${po.poNumber}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">PO Date</p>
                <p style="margin: 5px 0; color: #1f2937; font-weight: 600;">${po.poDate}</p>
              </div>
              ${po.expectedDeliveryDate ? `
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Expected Delivery</p>
                <p style="margin: 5px 0; color: #1f2937; font-weight: 600;">${po.expectedDeliveryDate}</p>
              </div>
              ` : ''}
            </div>
          </div>

          <h3 style="color: #1f2937; margin: 0 0 15px 0;">Dear ${po.supplierName},</h3>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            We are pleased to send you this Purchase Order. Please review the details below and confirm your acceptance at your earliest convenience.
          </p>

          <!-- Line Items Table -->
          <table class="responsive-table" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 5%;">#</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Product</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 12%;">Quantity</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 15%;">Unit Price</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 15%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="padding: 15px; text-align: right; font-weight: 600; color: #1f2937; border-top: 2px solid #e5e7eb;">Total Amount:</td>
                <td style="padding: 15px; text-align: right; font-weight: 700; color: #667eea; font-size: 18px; border-top: 2px solid #e5e7eb;">₹${parseFloat(po.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 0 0 15px 0; color: #1e40af; font-size: 14px;">
              <strong>📋 Next Steps:</strong>
            </p>
            <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
              <li style="margin-bottom: 10px;">Login to your supplier portal to view and manage this purchase order</li>
              <li style="margin-bottom: 10px;">Submit your quotation through the portal</li>
              <li>Confirm receipt and acceptance by replying to this email or contacting us</li>
            </ol>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal?email=${encodeURIComponent(po.supplierEmail)}" 
                 style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Access Supplier Portal
              </a>
            </div>
          </div>

          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 10px;">
            Thank you for your continued partnership.
          </p>
          <p style="color: #4b5563; line-height: 1.6; margin: 0;">
            Best regards,<br>
            <strong>${organizationName}</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated email. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getRFQEmailTemplate = (rfq: RFQ, organizationName: string, organizationLogo?: string): string => {
  const lineItemsHtml = rfq.lines.map((line, index) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${line.productName}</strong>
        ${line.description ? `<br><span style="color: #6b7280; font-size: 0.875rem;">${line.description}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${line.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${line.targetPrice || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Request for Quotation - ${rfq.rfqNumber}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .responsive-table { width: 100% !important; font-size: 12px !important; }
          .responsive-table td, .responsive-table th { padding: 6px !important; }
          .responsive-padding { padding: 15px !important; }
          .responsive-text { font-size: 14px !important; }
          .responsive-title { font-size: 22px !important; }
        }
      </style>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 800px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div class="responsive-padding" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); padding: 30px; text-align: center;">
          ${organizationLogo ? `<img src="${organizationLogo}" alt="${organizationName}" style="max-width: 150px; margin-bottom: 15px;">` : ''}
          <h1 class="responsive-title" style="color: #ffffff; margin: 0; font-size: 28px;">${organizationName}</h1>
          <p class="responsive-text" style="color: #fce7f3; margin: 10px 0 0 0; font-size: 16px;">Request for Quotation</p>
        </div>

        <!-- RFQ Details -->
        <div class="responsive-padding" style="padding: 30px;">
          <div style="background-color: #faf5ff; border-left: 4px solid #a855f7; padding: 20px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 20px;">RFQ #${rfq.rfqNumber}</h2>
            <h3 style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; font-weight: 500;">${rfq.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">RFQ Date</p>
                <p style="margin: 5px 0; color: #1f2937; font-weight: 600;">${rfq.rfqDate}</p>
              </div>
              ${rfq.deadlineDate ? `
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Deadline</p>
                <p style="margin: 5px 0; color: #dc2626; font-weight: 600;">${rfq.deadlineDate}</p>
              </div>
              ` : ''}
            </div>
          </div>

          <h3 style="color: #1f2937; margin: 0 0 15px 0;">Dear Supplier,</h3>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 15px;">
            We are inviting you to submit a quotation for the following items. Please review the requirements carefully and provide your best pricing.
          </p>
          ${rfq.description ? `
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Description:</strong></p>
            <p style="margin: 10px 0 0 0; color: #4b5563; line-height: 1.6;">${rfq.description}</p>
          </div>
          ` : ''}

          <!-- Line Items Table -->
          <table class="responsive-table" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 5%;">#</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Product</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 15%;">Quantity</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 20%;">Target Price</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>

          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">
              <strong>⏰ Important:</strong> ${rfq.deadlineDate ? `Please submit your quotation by <strong>${rfq.deadlineDate}</strong>` : 'Please submit your quotation at your earliest convenience'}.
            </p>
            <p style="margin: 0 0 15px 0; color: #92400e; font-size: 14px;">
              Your quotation should include pricing, delivery time, payment terms, and any other relevant details.
            </p>
            <div style="text-align: center; margin-top: 15px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/supplier-portal${rfq.supplierEmail ? `?email=${encodeURIComponent(rfq.supplierEmail)}` : ''}" 
                 style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Submit via Supplier Portal
              </a>
            </div>
          </div>

          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 10px;">
            We look forward to receiving your competitive quotation.
          </p>
          <p style="color: #4b5563; line-height: 1.6; margin: 0;">
            Best regards,<br>
            <strong>${organizationName}</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated email. Please reply with your quotation.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getSupplierWelcomeEmailTemplate = (data: SupplierWelcome): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${data.organizationName}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 700px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
          ${data.organizationLogo ? `<img src="${data.organizationLogo}" alt="${data.organizationName}" style="max-width: 150px; margin-bottom: 20px; background-color: white; padding: 10px; border-radius: 8px;">` : ''}
          <h1 style="color: #ffffff; margin: 0; font-size: 32px;">🎉 Welcome!</h1>
          <p style="color: #d1fae5; margin: 15px 0 0 0; font-size: 18px;">You're now a valued supplier of ${data.organizationName}</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Congratulations, ${data.supplierName}!</h2>
          
          <p style="color: #4b5563; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            We are delighted to welcome you as an official supplier partner of <strong style="color: #059669;">${data.organizationName}</strong>. 
            This marks the beginning of what we hope will be a long and mutually beneficial business relationship.
          </p>

          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
            <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 18px;">What This Means for You:</h3>
            <ul style="color: #047857; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Direct access to our procurement team</li>
              <li>Regular purchase orders and business opportunities</li>
              <li>Transparent communication and timely payments</li>
              <li>Potential for long-term partnership growth</li>
            </ul>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Next Steps:</h3>
            <ol style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Keep your contact information up to date</li>
              <li>Respond promptly to our RFQs and Purchase Orders</li>
              <li>Maintain the quality standards we expect</li>
              <li>Communicate any potential delays or issues proactively</li>
            </ol>
          </div>

          <p style="color: #4b5563; line-height: 1.8; margin-bottom: 15px; font-size: 16px;">
            We value quality, reliability, and partnership. We're confident that together, we can achieve great success.
          </p>

          <p style="color: #4b5563; line-height: 1.8; margin-bottom: 25px; font-size: 16px;">
            Should you have any questions or need assistance, please don't hesitate to reach out to our procurement team.
          </p>

          <div style="text-align: center; margin: 35px 0 25px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; border-radius: 25px; font-weight: 600; font-size: 16px;">
              🤝 Welcome to the Team!
            </div>
          </div>

          <p style="color: #4b5563; line-height: 1.8; margin: 0; font-size: 16px;">
            Warm regards,<br>
            <strong style="color: #1f2937; font-size: 18px;">${data.organizationName}</strong><br>
            ${data.contactPerson ? `<span style="color: #6b7280;">${data.contactPerson}</span>` : '<span style="color: #6b7280;">Procurement Team</span>'}
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 25px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #059669; font-weight: 600; font-size: 14px;">
            ${data.organizationName}
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated welcome email from our ERP system.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Stock Alert Email Template
interface StockAlert {
  productName: string;
  productSku: string;
  currentQuantity: string;
  reorderPoint: string;
  warehouseName: string;
  suggestedOrderQuantity?: string;
}

export const getStockAlertEmailTemplate = (
  alert: StockAlert,
  organizationName: string,
  organizationLogo?: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Low Stock Alert - ${alert.productName}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%); padding: 30px; text-align: center;">
          ${organizationLogo ? `<img src="${organizationLogo}" alt="${organizationName}" style="max-width: 120px; margin-bottom: 15px; background-color: white; padding: 8px; border-radius: 6px;">` : ''}
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">⚠️ Low Stock Alert</h1>
          <p style="color: #fef3c7; margin: 10px 0 0 0; font-size: 14px;">${organizationName}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 600;">
              ⚡ Action Required: Stock below reorder point
            </p>
          </div>

          <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Product Details</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Product Name:</td>
              <td style="padding: 12px 0; color: #1f2937; font-weight: 600; text-align: right;">${alert.productName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">SKU:</td>
              <td style="padding: 12px 0; color: #1f2937; font-weight: 600; text-align: right;">${alert.productSku}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Warehouse:</td>
              <td style="padding: 12px 0; color: #1f2937; font-weight: 600; text-align: right;">${alert.warehouseName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Current Stock:</td>
              <td style="padding: 12px 0; color: #dc2626; font-weight: 700; text-align: right; font-size: 16px;">${alert.currentQuantity} units</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Reorder Point:</td>
              <td style="padding: 12px 0; color: #1f2937; font-weight: 600; text-align: right;">${alert.reorderPoint} units</td>
            </tr>
            ${alert.suggestedOrderQuantity ? `
            <tr>
              <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Suggested Order:</td>
              <td style="padding: 12px 0; color: #059669; font-weight: 700; text-align: right; font-size: 16px;">${alert.suggestedOrderQuantity} units</td>
            </tr>
            ` : ''}
          </table>

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">📋 Recommended Actions:</p>
            <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.6;">
              <li>Review supplier quotations</li>
              <li>Create purchase order</li>
              <li>Check for pending deliveries</li>
              <li>Consider temporary stock transfer</li>
            </ul>
          </div>

          <p style="color: #4b5563; line-height: 1.6; margin: 0; font-size: 14px;">
            This automated alert helps prevent stock-outs. Please take necessary action to maintain optimal inventory levels.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Automated Inventory Alert from ${organizationName} ERP System
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Quotation Email Template
interface Quotation {
  id?: string; // Add quotation ID for customer response links
  quotationNumber: string;
  quotationDate: string;
  validUntil?: string;
  customerName: string;
  customerEmail: string;
  totalAmount: string;
  currencyCode: string;
  lines: Array<{
    productName: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
  notes?: string;
}

export const getQuotationEmailTemplate = (
  quotation: Quotation,
  organizationName: string,
  organizationLogo?: string
): string => {
  const lineItemsHtml = quotation.lines.map((line, index) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${line.productName}</strong>
        ${line.description ? `<br><span style="color: #6b7280; font-size: 0.875rem;">${line.description}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${line.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(line.unitPrice).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong>₹${parseFloat(line.total).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation - ${quotation.quotationNumber}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .responsive-table { width: 100% !important; font-size: 12px !important; }
          .responsive-table td, .responsive-table th { padding: 6px !important; }
          .responsive-padding { padding: 15px !important; }
          .responsive-text { font-size: 14px !important; }
          .responsive-title { font-size: 22px !important; }
        }
      </style>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 800px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div class="responsive-padding" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          ${organizationLogo ? `<img src="${organizationLogo}" alt="${organizationName}" style="max-width: 150px; margin-bottom: 15px;">` : ''}
          <h1 class="responsive-title" style="color: #ffffff; margin: 0; font-size: 28px;">${organizationName}</h1>
          <p class="responsive-text" style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 16px;">Price Quotation</p>
        </div>

        <!-- Quotation Details -->
        <div class="responsive-padding" style="padding: 30px;">
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">Quotation #${quotation.quotationNumber}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Date</p>
                <p style="margin: 5px 0; color: #1f2937; font-weight: 600;">${quotation.quotationDate}</p>
              </div>
              ${quotation.validUntil ? `
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Valid Until</p>
                <p style="margin: 5px 0; color: #dc2626; font-weight: 600;">${quotation.validUntil}</p>
              </div>
              ` : ''}
            </div>
          </div>

          <h3 style="color: #1f2937; margin: 0 0 15px 0;">Dear ${quotation.customerName},</h3>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            Thank you for your interest in our products. We are pleased to submit the following quotation for your consideration.
          </p>

          <!-- Line Items Table -->
          <table class="responsive-table" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 5%;">#</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Product</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 12%;">Quantity</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 15%;">Unit Price</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; width: 15%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="padding: 15px; text-align: right; font-weight: 600; color: #1f2937; border-top: 2px solid #e5e7eb;">Total Amount:</td>
                <td style="padding: 15px; text-align: right; font-weight: 700; color: #3b82f6; font-size: 18px; border-top: 2px solid #e5e7eb;">₹${parseFloat(quotation.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </tfoot>
          </table>

          ${quotation.notes ? `
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Notes:</strong></p>
            <p style="margin: 10px 0 0 0; color: #4b5563; line-height: 1.6;">${quotation.notes}</p>
          </div>
          ` : ''}

          ${quotation.id ? `
          <div style="background-color: #dcfce7; border: 1px solid #86efac; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 0 0 15px 0; color: #166534; font-size: 14px; font-weight: 600;">
              ✓ This quotation is valid until ${quotation.validUntil || 'further notice'}
            </p>
            <p style="margin: 0 0 15px 0; color: #166534; font-size: 14px;">
              Please select one of the following options:
            </p>
            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/erp/sales/quotations/${quotation.id}/customer-response?action=accept" 
                 style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 5px;">
                ✓ Accept Quotation
              </a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/erp/sales/quotations/${quotation.id}/customer-response?action=decline" 
                 style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 5px;">
                ✗ Decline Quotation
              </a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/erp/sales/quotations/${quotation.id}/customer-response?action=comment" 
                 style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 5px;">
                💬 Add Comments
              </a>
            </div>
          </div>
          ` : `
          <div style="background-color: #dcfce7; border: 1px solid #86efac; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>✓ This quotation is valid until ${quotation.validUntil || 'further notice'}</strong><br>
              Please reply to this email or contact us to confirm your order.
            </p>
          </div>
          `}

          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 10px;">
            We look forward to doing business with you.
          </p>
          <p style="color: #4b5563; line-height: 1.6; margin: 0;">
            Best regards,<br>
            <strong>${organizationName}</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated email. Please reply if you have any questions.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

interface StatementData {
  customer: {
    name: string;
    code: string;
    email?: string;
  };
  invoices: Array<{
    invoice_number: string;
    invoice_date: string;
    due_date?: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    status: string;
  }>;
  startDate: string;
  endDate: string;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
}

export const generateStatementEmail = (data: StatementData): string => {
  const invoicesHtml = data.invoices.map((inv) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${inv.invoice_number}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(inv.invoice_date).toLocaleDateString()}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(inv.total_amount).toLocaleString('en-IN')}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(inv.paid_amount || '0').toLocaleString('en-IN')}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(inv.balance_amount || '0').toLocaleString('en-IN')}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: ${inv.status === 'paid' ? '#d1fae5' : inv.status === 'overdue' ? '#fee2e2' : '#dbeafe'}; color: ${inv.status === 'paid' ? '#065f46' : inv.status === 'overdue' ? '#991b1b' : '#1e40af'};">
          ${inv.status.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Statement</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #1f2937; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Account Statement</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">For the period: ${data.startDate} to ${data.endDate}</p>
        </div>

        <!-- Customer Info -->
        <div style="padding: 30px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Customer Information</h2>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${data.customer.name}</p>
          <p style="margin: 5px 0;"><strong>Code:</strong> ${data.customer.code}</p>
          ${data.customer.email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${data.customer.email}</p>` : ''}
        </div>

        <!-- Summary -->
        <div style="padding: 30px;">
          <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px;">Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border: 1px solid #dbeafe;">
              <p style="margin: 0; color: #1e40af; font-size: 12px; text-transform: uppercase; font-weight: 600;">Total Invoiced</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-size: 24px; font-weight: bold;">₹${data.totalInvoiced.toLocaleString('en-IN')}</p>
            </div>
            <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0;">
              <p style="margin: 0; color: #065f46; font-size: 12px; text-transform: uppercase; font-weight: 600;">Total Paid</p>
              <p style="margin: 5px 0 0 0; color: #064e3b; font-size: 24px; font-weight: bold;">₹${data.totalPaid.toLocaleString('en-IN')}</p>
            </div>
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #fde68a;">
              <p style="margin: 0; color: #92400e; font-size: 12px; text-transform: uppercase; font-weight: 600;">Outstanding</p>
              <p style="margin: 5px 0 0 0; color: #78350f; font-size: 24px; font-weight: bold;">₹${data.totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <!-- Invoice Table -->
          <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Invoice Details</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Invoice #</th>
                <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Date</th>
                <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Due Date</th>
                <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Amount</th>
                <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Paid</th>
                <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Balance</th>
                <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoicesHtml}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated statement. Please contact us if you have any questions.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

