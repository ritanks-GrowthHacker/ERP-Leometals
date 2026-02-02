import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/purchasing/supplier-quotations - Get all supplier portal submissions
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view quotations' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const supplierIdParam = searchParams.get('supplierId');
    const groupBySupplier = searchParams.get('groupBySupplier') === 'true';

    // Build dynamic query using sql template
    let query = sql`
      SELECT 
        sq.*,
        s.name as supplier_name,
        s.code as supplier_code,
        s.email as supplier_email,
        s.phone as supplier_phone,
        rfq.rfq_number,
        rfq.title as rfq_title,
        po.po_number
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      LEFT JOIN request_for_quotations rfq ON sq.rfq_id = rfq.id
      LEFT JOIN purchase_orders po ON sq.purchase_order_id = po.id
      WHERE 1=1
    `;

    if (statusParam) {
      query = sql`${query} AND sq.status = ${statusParam}`;
    }

    if (supplierIdParam) {
      query = sql`${query} AND sq.supplier_id = ${supplierIdParam}`;
    }

    query = sql`${query} ORDER BY sq.submission_date DESC, sq.created_at DESC`;

    const result = await erpDb.execute(query);
    const quotations = Array.from(result);

    if (groupBySupplier) {
      // Group quotations by supplier
      const grouped = quotations.reduce((acc: any, quote: any) => {
        const supplierId = quote.supplier_id;
        if (!acc[supplierId]) {
          acc[supplierId] = {
            supplierId,
            supplierName: quote.supplier_name,
            supplierCode: quote.supplier_code,
            supplierEmail: quote.supplier_email,
            supplierPhone: quote.supplier_phone,
            quotations: [],
            stats: {
              total: 0,
              submitted: 0,
              underReview: 0,
              accepted: 0,
              rejected: 0,
              totalAmount: 0,
            },
          };
        }

        acc[supplierId].quotations.push(quote);
        acc[supplierId].stats.total++;
        acc[supplierId].stats[quote.status.replace('_', '')]++;
        if (quote.total_amount) {
          acc[supplierId].stats.totalAmount += parseFloat(quote.total_amount);
        }

        return acc;
      }, {});

      return NextResponse.json({
        groupedQuotations: Object.values(grouped),
        total: quotations.length,
      });
    }

    return NextResponse.json({
      quotations,
      total: quotations.length,
    });
  } catch (error: any) {
    console.error('Error fetching supplier quotations:', error);
    logDatabaseError('Fetching supplier quotations', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// PUT /api/erp/purchasing/supplier-quotations - Accept/Reject quotation
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to update quotations' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { quotationId, status, rejectionReason, rejectionNotes, canResubmit } = body;

    if (!quotationId || !status) {
      return NextResponse.json(
        { error: 'Missing quotationId or status' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      reviewed_by: user.id,
      reviewed_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    };

    if (status === 'rejected') {
      updateData.rejection_reason = rejectionReason;
      updateData.rejection_notes = rejectionNotes;
      updateData.can_resubmit = canResubmit !== false;
    }

    await erpDb.execute(sql`
      UPDATE supplier_quotation_submissions
      SET 
        status = ${status},
        reviewed_by = ${user.id},
        reviewed_at = NOW(),
        updated_at = NOW(),
        rejection_reason = ${status === 'rejected' ? rejectionReason || null : null},
        rejection_notes = ${status === 'rejected' ? rejectionNotes || null : null},
        can_resubmit = ${status === 'rejected' ? (canResubmit !== false) : true}
      WHERE id = ${quotationId}
    `);

    // If quotation is accepted, auto-generate invoice
    if (status === 'accepted') {
      // First, get the quotation details
      const quotationResult = await erpDb.execute(sql`
        SELECT sq.*, s.payment_terms, s.erp_organization_id
        FROM supplier_quotation_submissions sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        WHERE sq.id = ${quotationId}
      `);

      const quotations = Array.from(quotationResult);
      if (quotations.length > 0) {
        const quotation: any = quotations[0];
        const paymentTerms = quotation.payment_terms || 30; // Default 30 days
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentTerms);

        // Auto-generate invoice from quotation
        const invoiceNumberResult = await erpDb.execute(sql`
          SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-([0-9]+)') AS INTEGER)), 0) + 1 as next_num
          FROM supplier_invoices
        `);
        const invoiceNumbers = Array.from(invoiceNumberResult);
        const nextNum = invoiceNumbers[0]?.next_num || 1;
        const invoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;
        const invoiceNotes = `Auto-generated from accepted quotation ${quotation.submission_number}`;

        // Create the invoice
        await erpDb.execute(sql`
          INSERT INTO supplier_invoices (
            invoice_number,
            supplier_id,
            quotation_id,
            erp_organization_id,
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
            ${quotation.erp_organization_id},
            NOW(),
            ${dueDate.toISOString().split('T')[0]},
            ${quotation.total_amount},
            0,
            0,
            0,
            ${quotation.total_amount},
            ${quotation.currency_code || 'INR'},
            'pending',
            ${invoiceNotes},
            NOW(),
            NOW()
          )
        `);

        // Update notification message to include invoice info
        await erpDb.execute(sql`
          UPDATE supplier_portal_notifications
          SET message = ${`Your quotation has been accepted! An invoice (${invoiceNumber}) has been automatically generated.`}
          WHERE id IN (
            SELECT id FROM supplier_portal_notifications
            WHERE related_entity_id = ${quotationId}
            AND notification_type = 'quotation_accepted'
            ORDER BY created_at DESC
            LIMIT 1
          )
        `);
      }
    }

    // Create notification for supplier
    await erpDb.execute(sql`
      INSERT INTO supplier_portal_notifications (
        supplier_id,
        notification_type,
        title,
        message,
        related_entity_type,
        related_entity_id
      )
      SELECT 
        supplier_id,
        ${status === 'accepted' ? 'quotation_accepted' : 'quotation_rejected'},
        ${status === 'accepted' ? 'Quotation Accepted!' : 'Quotation Rejected'},
        ${status === 'accepted' 
          ? 'Your quotation has been accepted. An invoice has been auto-generated for you.'
          : `Your quotation was rejected. ${rejectionNotes || 'Please review and submit a revised quotation.'}`},
        'quotation',
        ${quotationId}
      FROM supplier_quotation_submissions
      WHERE id = ${quotationId}
    `);

    return NextResponse.json({ 
      message: `Quotation ${status} successfully`,
      success: true,
    });
  } catch (error: any) {
    console.error('Error updating quotation:', error);
    logDatabaseError('Updating quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
