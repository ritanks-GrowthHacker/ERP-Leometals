import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// POST /api/erp/purchasing/supplier-quotations/[id]/reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireErpAccess(req);
    if (error) return error;

    if (!hasPermission(user, 'purchasing', 'edit')) {
      return NextResponse.json(
        { error: 'No permission to reject quotations' },
        { status: 403 }
      );
    }

    const { id: quotationId } = await params;
    const body = await req.json();
    const { rejectionReason } = body;

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
        status = 'rejected',
        reviewed_by = ${user.id},
        reviewed_at = NOW(),
        rejection_reason = ${rejectionReason || 'Declined by purchaser'},
        rejection_notes = ${rejectionReason || null},
        can_resubmit = true,
        updated_at = NOW()
      FROM suppliers s
      WHERE sq.id = ${quotationId}
        AND sq.supplier_id = s.id
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    // Get supplier ID for notification
    const quotationResult = await erpDb.execute(sql`
      SELECT sq.supplier_id
      FROM supplier_quotation_submissions sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      WHERE sq.id = ${quotationId}
        AND s.erp_organization_id = ${user.erpOrganizationId}
    `);

    const quotations = Array.from(quotationResult);
    if (quotations.length > 0) {
      const quotation: any = quotations[0];

      // Create notification for supplier
      await erpDb.execute(sql`
        INSERT INTO supplier_portal_notifications (
          supplier_id,
          notification_type,
          title,
          message,
          related_entity_type,
          related_entity_id
        ) VALUES (
          ${quotation.supplier_id},
          'quotation_rejected',
          'Quotation Rejected',
          ${rejectionReason || 'Your quotation was rejected. Please review and submit a revised quotation.'},
          'quotation',
          ${quotationId}
        )
      `);
    }

    return NextResponse.json({
      message: 'Quotation rejected successfully.',
      success: true,
    });
  } catch (error: any) {
    console.error('Error rejecting quotation:', error);
    return NextResponse.json({ error: error.message || 'Failed to reject quotation' }, { status: 500 });
  }
}
