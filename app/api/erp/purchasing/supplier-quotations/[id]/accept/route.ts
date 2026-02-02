import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { notifySupplierQuotationAccepted } from '@/lib/supplierNotifications';
import { sendWarehouseNotification } from '@/lib/warehouseNotifications';

// POST /api/erp/purchasing/supplier-quotations/[id]/accept
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    if (!hasPermission(user, 'purchasing', 'edit')) {
      return NextResponse.json(
        { error: 'No permission to accept quotations' },
        { status: 403 }
      );
    }

    const { id: quotationId } = await params;

    // First verify the quotation belongs to user's organization
    const verifyResult = await erpDb.execute(sql`
      SELECT sq.id
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      WHERE sq.id = ${quotationId}
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    if (!verifyResult || Array.from(verifyResult).length === 0) {
      return NextResponse.json(
        { error: 'Quotation not found or access denied' },
        { status: 404 }
      );
    }

    // Update quotation status
    await erpDb.execute(sql`
      UPDATE supplier_quotation_submissions sq
      SET 
        status = 'accepted',
        reviewed_by = ${user.id},
        reviewed_at = NOW(),
        updated_at = NOW()
      FROM suppliers s
      WHERE sq.id = ${quotationId}
        AND sq.supplier_id = s.id
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    // Update RFQ status to 'in_progress' when a quotation is accepted
    const rfqUpdateResult = await erpDb.execute(sql`
      UPDATE request_for_quotations 
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = (
        SELECT rfq_id 
        FROM supplier_quotation_submissions 
        WHERE id = ${quotationId}
      )
    `);

    // Get quotation details for invoice generation and email notifications
    const quotationResult = await erpDb.execute(sql`
      SELECT sq.*, s.name as supplier_name, s.email as supplier_email, s.payment_terms, 
             s.erp_organization_id, po.po_number, po.warehouse_id, rfq.rfq_number
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      WHERE sq.id = ${quotationId}
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    const quotations = Array.from(quotationResult);
    if (quotations.length > 0) {
      const quotation: any = quotations[0];
      const paymentTerms = quotation.payment_terms || 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      // Auto-generate invoice
      const invoiceNumberResult = await erpDb.execute(sql`
        SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-([0-9]+)') AS INTEGER)), 0) + 1 as next_num
        FROM supplier_invoices
      `);
      const invoiceNumbers = Array.from(invoiceNumberResult);
      const nextNum = invoiceNumbers[0]?.next_num || 1;
      const invoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;

      // Calculate tax (assume 18% GST if total amount includes tax)
      const totalAmount = parseFloat(quotation.total_amount || 0);
      
      // Try to extract tax and discount from manual_quotation_data
      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      let calculatedDiscount = 0;

      if (quotation.manual_quotation_data) {
        try {
          const data = JSON.parse(quotation.manual_quotation_data);
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
              const qty = parseFloat(item.quantity || 0);
              const price = parseFloat(item.unit_price || 0);
              const taxPercent = parseFloat(item.tax || 0);
              const discountPercent = parseFloat(item.discount || 0);
              
              const lineSubtotal = qty * price;
              const lineDiscount = lineSubtotal * (discountPercent / 100);
              const afterDiscount = lineSubtotal - lineDiscount;
              const lineTax = afterDiscount * (taxPercent / 100);
              
              calculatedSubtotal += lineSubtotal;
              calculatedDiscount += lineDiscount;
              calculatedTax += lineTax;
            });
          }
        } catch (e) {
          console.error('Error parsing manual_quotation_data:', e);
        }
      }

      // Fallback: if no data or mismatch, use simple 18% GST estimation
      if (calculatedSubtotal === 0 || Math.abs((calculatedSubtotal - calculatedDiscount + calculatedTax) - totalAmount) > 1) {
        calculatedSubtotal = totalAmount / 1.18;
        calculatedTax = totalAmount - calculatedSubtotal;
        calculatedDiscount = 0;
      }

      // Get RFQ details for warehouse/location info
      const rfqDetails = await erpDb.execute(sql`
        SELECT warehouse_id, location_id, purchase_order_id
        FROM request_for_quotations
        WHERE id = ${quotation.rfq_id}
      `);
      const rfq: any = Array.from(rfqDetails)[0] || {};

      await erpDb.execute(sql`
        INSERT INTO supplier_invoices (
          invoice_number,
          supplier_id,
          quotation_id,
          purchase_order_id,
          erp_organization_id,
          warehouse_id,
          location_id,
          invoice_date,
          due_date,
          subtotal,
          tax_amount,
          shipping_charges,
          discount_amount,
          total_amount,
          currency_code,
          payment_status,
          notes,
          created_at,
          updated_at
        ) VALUES (
          ${invoiceNumber},
          ${quotation.supplier_id},
          ${quotationId},
          ${rfq.purchase_order_id || null},
          ${quotation.erp_organization_id},
          ${rfq.warehouse_id || null},
          ${rfq.location_id || null},
          NOW(),
          ${dueDate.toISOString().split('T')[0]},
          ${(calculatedSubtotal - calculatedDiscount).toFixed(2)},
          ${calculatedTax.toFixed(2)},
          0,
          ${calculatedDiscount.toFixed(2)},
          ${totalAmount.toFixed(2)},
          'INR',
          'pending',
          '',
          NOW(),
          NOW()
        )
      `);

      // Notify supplier
      try {
        console.log(`Notifying supplier: ${quotation.supplier_name} (${quotation.supplier_id})`);
        await notifySupplierQuotationAccepted(
          quotation.supplier_id,
          quotation.submission_number || 'N/A',
          invoiceNumber
        );
        console.log('✅ Supplier notified successfully');
      } catch (emailError) {
        console.error('❌ Failed to send supplier notification:', emailError);
      }

      // Notify warehouse
      if (quotation.warehouse_id) {
        try {
          console.log(`Notifying warehouse: ${quotation.warehouse_id}`);
          await sendWarehouseNotification({
            warehouseId: quotation.warehouse_id,
            subject: 'Quotation Accepted',
            message: `
              <p><strong>A supplier quotation has been accepted.</strong></p>
              <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Quotation Number:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${quotation.submission_number || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${quotation.supplier_name || 'Unknown'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #059669; font-size: 18px;">₹${quotation.total_amount}</td>
                </tr>
              </table>
              <p style="margin-top: 20px;">The invoice has been auto-generated and the procurement process can proceed.</p>
            `,
            eventType: '✅ Quotation Accepted',
          });
          console.log('✅ Warehouse notified successfully');
        } catch (emailError) {
          console.error('❌ Failed to send warehouse notification:', emailError);
        }
      }
    }

    return NextResponse.json({
      message: 'Quotation accepted successfully. Invoice has been auto-generated.',
      success: true,
    });
  } catch (error: any) {
    console.error('Error accepting quotation:', error);
    return NextResponse.json({ error: error.message || 'Failed to accept quotation' }, { status: 500 });
  }
}
