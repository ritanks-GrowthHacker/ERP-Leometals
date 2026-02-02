import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesQuotations, salesOrders, salesOrderLines } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { notifyCustomerQuotationAccepted, notifyCustomerSalesOrder } from '@/lib/customerNotifications';
import { notifySalesQuotationAccepted, notifySalesOrder } from '@/lib/warehouseNotifications';
import { sendWarehouseAllocationEmail } from '@/lib/emailServices';

// GET /api/erp/sales/quotations/[id]/customer-response?action=accept|decline|comment
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const quotationId = params.id;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (!quotationId || !action) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Request</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; font-size: 18px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>❌ Invalid Request</h1>
          <p class="error">Missing required parameters.</p>
        </body>
        </html>
        `,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Find the quotation
    const quotation = await erpDb.query.salesQuotations.findFirst({
      where: eq(salesQuotations.id, quotationId),
      with: {
        customer: true,
      },
    });

    if (!quotation) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Quotation Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; font-size: 18px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>❌ Quotation Not Found</h1>
          <p class="error">The quotation you're looking for doesn't exist.</p>
        </body>
        </html>
        `,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Check if quotation was already responded to
    if (quotation.status === 'accepted' || quotation.status === 'declined') {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Already Responded</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center;
              background-color: #f3f4f6;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .warning { color: #f59e0b; font-size: 48px; margin-bottom: 20px; }
            h1 { color: #1f2937; margin-bottom: 15px; }
            .message { color: #6b7280; font-size: 16px; line-height: 1.6; }
            .status { 
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              border-radius: 6px;
              font-weight: 600;
              ${quotation.status === 'accepted' ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fee2e2; color: #991b1b;'}
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="warning">⚠️</div>
            <h1>Already Responded</h1>
            <p class="message">
              This quotation has already been ${quotation.status}.<br>
              Thank you for your response.
            </p>
            <div class="status">Status: ${quotation.status.toUpperCase()}</div>
          </div>
        </body>
        </html>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (action === 'comment') {
      // Show comment form
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Add Comments - ${quotation.quotationNumber}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 700px; 
              margin: 50px auto; 
              padding: 20px;
              background-color: #f3f4f6;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h1 { color: #1f2937; margin-bottom: 10px; }
            .quotation-number { color: #3b82f6; font-size: 18px; margin-bottom: 30px; }
            label { display: block; color: #374151; font-weight: 600; margin-bottom: 8px; }
            textarea { 
              width: 100%; 
              min-height: 150px; 
              padding: 12px; 
              border: 1px solid #d1d5db; 
              border-radius: 6px; 
              font-family: inherit;
              font-size: 14px;
              margin-bottom: 20px;
              resize: vertical;
            }
            .button-group { display: flex; gap: 10px; }
            button { 
              flex: 1;
              padding: 12px 24px; 
              border: none; 
              border-radius: 6px; 
              font-weight: 600; 
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s;
            }
            .btn-submit { background-color: #3b82f6; color: white; }
            .btn-submit:hover { background-color: #2563eb; }
            .btn-cancel { background-color: #e5e7eb; color: #374151; }
            .btn-cancel:hover { background-color: #d1d5db; }
            .error-message { 
              color: #dc2626; 
              background-color: #fee2e2; 
              padding: 12px; 
              border-radius: 6px; 
              margin-bottom: 20px;
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Add Comments</h1>
            <div class="quotation-number">Quotation: ${quotation.quotationNumber}</div>
            
            <div id="error-message" class="error-message"></div>
            
            <form id="comment-form">
              <label for="comments">Your Comments or Questions:</label>
              <textarea 
                id="comments" 
                name="comments" 
                placeholder="Enter your comments, questions, or requirements here..."
                required
              ></textarea>
              
              <div class="button-group">
                <button type="submit" class="btn-submit">Submit Comments</button>
                <button type="button" class="btn-cancel" onclick="window.close()">Cancel</button>
              </div>
            </form>
          </div>
          
          <script>
            document.getElementById('comment-form').addEventListener('submit', async function(e) {
              e.preventDefault();
              
              const comments = document.getElementById('comments').value;
              const errorDiv = document.getElementById('error-message');
              
              if (!comments.trim()) {
                errorDiv.textContent = 'Please enter your comments.';
                errorDiv.style.display = 'block';
                return;
              }
              
              try {
                const response = await fetch(window.location.href, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ comments: comments.trim() })
                });
                
                if (response.ok) {
                  window.location.href = window.location.href.replace('action=comment', 'action=comment-success');
                } else {
                  errorDiv.textContent = 'Failed to submit comments. Please try again.';
                  errorDiv.style.display = 'block';
                }
              } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
              }
            });
          </script>
        </body>
        </html>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (action === 'comment-success') {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Comments Submitted</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center;
              background-color: #f3f4f6;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .success-icon { color: #10b981; font-size: 64px; margin-bottom: 20px; }
            h1 { color: #1f2937; margin-bottom: 15px; }
            .message { color: #6b7280; font-size: 16px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✅</div>
            <h1>Comments Submitted Successfully!</h1>
            <p class="message">
              Thank you for your feedback on quotation ${quotation.quotationNumber}.<br>
              Our team will review your comments and get back to you shortly.
            </p>
          </div>
        </body>
        </html>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Handle accept or decline
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const statusColor = action === 'accept' ? '#10b981' : '#ef4444';
    const statusBg = action === 'accept' ? '#d1fae5' : '#fee2e2';
    const statusText = action === 'accept' ? '#065f46' : '#991b1b';
    const icon = action === 'accept' ? '✅' : '❌';
    let message = action === 'accept' 
      ? 'You have accepted this quotation. Our team will contact you shortly to proceed with the order.'
      : 'You have declined this quotation. Thank you for your consideration.';

    // Update quotation status
    await erpDb
      .update(salesQuotations)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(salesQuotations.id, quotationId));

    // Auto-generate sales order if quotation is accepted
    let salesOrderNumber = null;
    if (action === 'accept') {
      try {
        // Get quotation with lines
        const fullQuotation = await erpDb.query.salesQuotations.findFirst({
          where: eq(salesQuotations.id, quotationId),
          with: {
            lines: {
              with: {
                product: true,
              },
            },
            customer: true,
          },
        });

        if (fullQuotation && fullQuotation.lines && fullQuotation.lines.length > 0) {
          // Send quotation acceptance emails
          console.log('🔔 Sending quotation acceptance notifications...');
          try {
            // Email to customer
            await notifyCustomerQuotationAccepted(
              fullQuotation.customerId,
              fullQuotation.quotationNumber,
              parseFloat(fullQuotation.totalAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })
            );
            console.log('✅ Customer notification sent for quotation acceptance');
          } catch (emailError) {
            console.error('❌ Failed to send customer quotation acceptance email:', emailError);
          }

          // Generate SO number with retry logic to prevent duplicates
          let salesOrderNumber = '';
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            // Get the highest SO number numerically
            const maxSOResult = await erpDb.execute(sql`
              SELECT so_number 
              FROM sales_orders 
              WHERE erp_organization_id = ${fullQuotation.erpOrganizationId}
              ORDER BY 
                CAST(SUBSTRING(so_number FROM 'SO-(\\d+)') AS INTEGER) DESC NULLS LAST
              LIMIT 1
            `);
            
            let nextNumber = 1;
            if (maxSOResult && maxSOResult.length > 0) {
              const lastSO: any = maxSOResult[0];
              // Extract number from SO-0001, SO-0002 etc
              const match = lastSO.so_number.match(/SO-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            
            salesOrderNumber = `SO-${String(nextNumber).padStart(4, '0')}`;
            
            // Check if this number already exists
            const existing = await erpDb.execute(sql`
              SELECT 1 FROM sales_orders 
              WHERE erp_organization_id = ${fullQuotation.erpOrganizationId}
              AND so_number = ${salesOrderNumber}
              LIMIT 1
            `);
            
            if (!existing || existing.length === 0) {
              // Number is available, break the loop
              break;
            }
            
            attempts++;
            console.log(`⚠️ SO number ${salesOrderNumber} already exists, retrying... (attempt ${attempts})`);
          }
          
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique SO number after multiple attempts');
          }

          // Get default warehouse for organization
          const defaultWarehouse = await erpDb.execute(sql`
            SELECT id FROM warehouses 
            WHERE erp_organization_id = ${fullQuotation.erpOrganizationId}
            AND is_active = true
            LIMIT 1
          `);
          
          const warehouseData: any = defaultWarehouse[0];
          const warehouseId = warehouseData?.id;
          
          if (warehouseId) {
            // Create sales order
            const [newSalesOrder] = await erpDb
              .insert(salesOrders)
              .values({
                erpOrganizationId: fullQuotation.erpOrganizationId,
                customerId: fullQuotation.customerId,
                warehouseId: warehouseId,
                soNumber: salesOrderNumber,
                soDate: new Date().toISOString().split('T')[0],
                status: 'confirmed',
                currencyCode: fullQuotation.currencyCode || 'INR',
                subtotal: fullQuotation.subtotal,
                taxAmount: fullQuotation.taxAmount,
                totalAmount: fullQuotation.totalAmount,
                notes: `Auto-generated from Quotation ${fullQuotation.quotationNumber}`,
                createdBy: fullQuotation.createdBy,
              })
              .returning();

            // Create sales order lines from quotation lines with automatic warehouse location assignment
            console.log('🏭 Auto-assigning warehouse locations based on highest available stock...');
            
            const orderLines = [];
            const warehouseAllocations = []; // Track which warehouses were allocated for notifications
            
            for (const line of fullQuotation.lines) {
              const lineData: any = line;
              console.log(`\n📦 Processing product: ${lineData.productId}`);
              console.log(`   Quantity needed: ${lineData.quantity}`);
              
              // Find all warehouse locations with this product and their stock levels
              const stockLevelsQuery = await erpDb.execute(sql`
                SELECT 
                  sl.id,
                  sl.warehouse_id,
                  sl.location_id,
                  sl.quantity_on_hand,
                  w.name as warehouse_name,
                  w.manager_email,
                  wl.name as location_name
                FROM stock_levels sl
                JOIN warehouses w ON sl.warehouse_id = w.id
                LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
                WHERE sl.product_id = ${lineData.productId}
                  AND sl.warehouse_id IN (
                    SELECT id FROM warehouses 
                    WHERE erp_organization_id = ${fullQuotation.erpOrganizationId}
                    AND is_active = true
                  )
                  AND CAST(sl.quantity_on_hand AS DECIMAL) > 0
                ORDER BY CAST(sl.quantity_on_hand AS DECIMAL) DESC
                LIMIT 1
              `);
              
              let selectedLocationId = null;
              let selectedWarehouseId = warehouseId; // Default warehouse
              let warehouseManagerEmail = null;
              let warehouseName = '';
              let locationName = '';
              
              if (stockLevelsQuery && stockLevelsQuery.length > 0) {
                const topStock: any = stockLevelsQuery[0];
                selectedLocationId = topStock.location_id;
                selectedWarehouseId = topStock.warehouse_id;
                warehouseManagerEmail = topStock.manager_email;
                warehouseName = topStock.warehouse_name;
                locationName = topStock.location_name || 'Default Location';
                
                console.log(`   ✅ Selected warehouse: ${warehouseName} (${selectedWarehouseId})`);
                console.log(`   ✅ Selected location: ${locationName} (${selectedLocationId || 'N/A'})`);
                console.log(`   ✅ Available quantity: ${topStock.quantity_on_hand}`);
                
                // Track for email notification
                if (warehouseManagerEmail) {
                  warehouseAllocations.push({
                    warehouseId: selectedWarehouseId,
                    warehouseName,
                    locationName,
                    managerEmail: warehouseManagerEmail,
                    productId: lineData.productId,
                    quantity: lineData.quantity,
                  });
                }
              } else {
                console.warn(`   ⚠️ No stock found for product ${lineData.productId}, using default warehouse without location`);
              }
              
              orderLines.push({
                salesOrderId: newSalesOrder.id,
                productId: lineData.productId,
                warehouseLocationId: selectedLocationId,
                description: lineData.description,
                quantityOrdered: lineData.quantity,
                unitPrice: lineData.unitPrice,
                taxRate: lineData.taxRate || 0,
                subtotal: lineData.subtotal,
                total: lineData.total,
              });
            }

            await erpDb.insert(salesOrderLines).values(orderLines);
            
            console.log(`✅ Created ${orderLines.length} sales order lines with warehouse locations assigned`);

            // Send warehouse allocation notifications
            if (warehouseAllocations.length > 0) {
              console.log('📧 Sending warehouse allocation notifications...');
              
              // Group by warehouse manager email
              const groupedByManager = warehouseAllocations.reduce((acc: any, allocation) => {
                const email = allocation.managerEmail;
                if (!acc[email]) {
                  acc[email] = {
                    managerEmail: email,
                    warehouseName: allocation.warehouseName,
                    allocations: [],
                  };
                }
                acc[email].allocations.push({
                  locationName: allocation.locationName,
                  productId: allocation.productId,
                  quantity: allocation.quantity,
                });
                return acc;
              }, {});
              
              // Send email to each warehouse manager
              for (const email in groupedByManager) {
                const { warehouseName, allocations } = groupedByManager[email];
                try {
                  await sendWarehouseAllocationEmail({
                    managerEmail: email,
                    warehouseName,
                    salesOrderNumber: newSalesOrder.soNumber,
                    quotationNumber: fullQuotation.quotationNumber,
                    allocations,
                  });
                  console.log(`   ✅ Sent allocation email to ${email} for ${warehouseName}`);
                } catch (emailError) {
                  console.error(`   ❌ Failed to send email to ${email}:`, emailError);
                }
              }
            }

            // Send sales order creation emails
            console.log('🔔 Sending sales order creation notifications...');
            try {
              const customerName = (fullQuotation.customer as any)?.name || 'Unknown Customer';
              
              // Email to warehouse
              await notifySalesQuotationAccepted(
                warehouseId,
                fullQuotation.quotationNumber,
                customerName,
                parseFloat(fullQuotation.totalAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })
              );
              console.log('✅ Warehouse notification sent for quotation acceptance');

              // Email to warehouse about new sales order
              await notifySalesOrder(
                warehouseId,
                salesOrderNumber,
                customerName
              );
              console.log('✅ Warehouse notification sent for sales order creation');

              // Email to customer about sales order
              await notifyCustomerSalesOrder(
                fullQuotation.customerId,
                salesOrderNumber,
                parseFloat(fullQuotation.totalAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })
              );
              console.log('✅ Customer notification sent for sales order creation');
            } catch (emailError) {
              console.error('❌ Failed to send sales order emails:', emailError);
            }

            message = `You have accepted this quotation. Sales Order ${salesOrderNumber} has been automatically generated. Our team will contact you shortly to proceed with delivery.`;
          } else {
            console.error('⚠️ No warehouse found for organization - sales order NOT created');
            message = 'You have accepted this quotation. However, sales order could not be created automatically. Our team will contact you shortly.';
          }
        } else {
          console.error('⚠️ Quotation has no lines - sales order NOT created');
          message = 'You have accepted this quotation. However, sales order could not be created automatically. Our team will contact you shortly.';
        }
      } catch (error) {
        console.error('❌ Error auto-generating sales order:', error);
        message = 'You have accepted this quotation. However, there was an error creating the sales order automatically. Our team will contact you shortly to complete the order.';
        // Continue even if sales order generation fails
      }
    }

    // Return success page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${action === 'accept' ? 'Quotation Accepted' : 'Quotation Declined'}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            text-align: center;
            background-color: #f3f4f6;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #1f2937; margin-bottom: 15px; }
          .quotation-number { 
            color: #3b82f6; 
            font-size: 20px; 
            font-weight: 600; 
            margin-bottom: 25px;
          }
          .message { 
            color: #4b5563; 
            font-size: 16px; 
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .status-badge {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            background-color: ${statusBg};
            color: ${statusText};
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">${icon}</div>
          <h1>${action === 'accept' ? 'Quotation Accepted!' : 'Quotation Declined'}</h1>
          <div class="quotation-number">${quotation.quotationNumber}</div>
          ${salesOrderNumber ? `<div style="color: #10b981; font-size: 18px; font-weight: 600; margin-bottom: 15px;">Sales Order: ${salesOrderNumber}</div>` : ''}
          <p class="message">${message}</p>
          <div class="status-badge">Status: ${newStatus.toUpperCase()}</div>
        </div>
      </body>
      </html>
      `,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error: any) {
    console.error('Error processing customer response:', error);
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            text-align: center; 
          }
          .error { color: #dc2626; font-size: 18px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>❌ Error</h1>
        <p class="error">An error occurred while processing your response. Please try again or contact support.</p>
      </body>
      </html>
      `,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// POST /api/erp/sales/quotations/[id]/customer-response (for comments)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const quotationId = params.id;
    const body = await req.json();
    const { comments } = body;

    if (!comments) {
      return NextResponse.json({ error: 'Comments are required' }, { status: 400 });
    }

    // Find the quotation
    const quotation = await erpDb.query.salesQuotations.findFirst({
      where: eq(salesQuotations.id, quotationId),
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Update quotation with customer comments
    await erpDb
      .update(salesQuotations)
      .set({
        notes: quotation.notes 
          ? `${quotation.notes}\n\n[Customer Comments]: ${comments}`
          : `[Customer Comments]: ${comments}`,
        updatedAt: new Date(),
      })
      .where(eq(salesQuotations.id, quotationId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving customer comments:', error);
    return NextResponse.json({ error: 'Failed to save comments' }, { status: 500 });
  }
}
