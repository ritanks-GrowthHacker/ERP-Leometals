import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/supplier-portal/meetings - Get meetings
export async function GET(req: NextRequest) {
  // Check if it's supplier or customer
  const supplierAuth = await verifySupplierAuth(req);
  const erpAuth = await requireErpAccess(req);

  if (supplierAuth.error && erpAuth.error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let result;

    if (!supplierAuth.error) {
      // Supplier view
      result = await erpDb.execute(sql`
        SELECT m.*, s.name as supplier_name
        FROM supplier_meetings m
        LEFT JOIN suppliers s ON m.supplier_id = s.id
        WHERE m.supplier_id = ${supplierAuth.supplier.id}
        ORDER BY m.scheduled_date DESC, m.scheduled_time DESC
      `);
    } else if (erpAuth.user) {
      // Customer/ERP view
      result = await erpDb.execute(sql`
        SELECT m.*, s.name as supplier_name
        FROM supplier_meetings m
        LEFT JOIN suppliers s ON m.supplier_id = s.id
        WHERE m.erp_organization_id = ${erpAuth.user.erpOrganizationId}
        ORDER BY m.scheduled_date DESC, m.scheduled_time DESC
      `);
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meetings = Array.from(result);

    return NextResponse.json({
      meetings: meetings,
      total: meetings.length,
    });
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/supplier-portal/meetings - Schedule meeting
export async function POST(req: NextRequest) {
  // Check if it's supplier or customer
  const supplierAuth = await verifySupplierAuth(req);
  const erpAuth = await requireErpAccess(req);

  if (supplierAuth.error && erpAuth.error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      supplierId,
      quotationId,
      meetingType,
      title,
      description,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      location,
      customerContactName,
      customerContactEmail,
      customerContactPhone,
      supplierContactName,
      supplierContactEmail,
      supplierContactPhone,
    } = body;

    if (!meetingType || !title || !scheduledDate || !scheduledTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let finalSupplierId = supplierId;
    let requestedBy = 'customer';
    let erpOrgId = null;

    if (!supplierAuth.error) {
      // Supplier requesting
      finalSupplierId = supplierAuth.supplier.id;
      requestedBy = 'supplier';
      // Get org ID from supplier
      const supplierData = await erpDb.execute(sql`
        SELECT id FROM suppliers WHERE id = ${finalSupplierId} LIMIT 1
      `);
      const suppliers = Array.from(supplierData);
      if (suppliers.length > 0) {
        erpOrgId = suppliers[0].id; // This needs proper org lookup
      }
    } else if (erpAuth.user) {
      // Customer requesting
      erpOrgId = erpAuth.user.erpOrganizationId;
    }

    const insertResult = await erpDb.execute(sql`
      INSERT INTO supplier_meetings (
        erp_organization_id,
        supplier_id,
        quotation_id,
        meeting_type,
        title,
        description,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        location,
        requested_by,
        customer_contact_name,
        customer_contact_email,
        customer_contact_phone,
        supplier_contact_name,
        supplier_contact_email,
        supplier_contact_phone
      ) VALUES (
        ${erpOrgId},
        ${finalSupplierId},
        ${quotationId},
        ${meetingType},
        ${title},
        ${description},
        ${scheduledDate},
        ${scheduledTime},
        ${durationMinutes || 30},
        ${location},
        ${requestedBy},
        ${customerContactName},
        ${customerContactEmail},
        ${customerContactPhone},
        ${supplierContactName},
        ${supplierContactEmail},
        ${supplierContactPhone}
      )
      RETURNING *
    `);

    const meetingResult = Array.from(insertResult);

    // Create notification
    await erpDb.execute(sql`
      INSERT INTO supplier_portal_notifications (
        supplier_id,
        notification_type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        ${finalSupplierId},
        'meeting_scheduled',
        'Meeting Scheduled',
        ${`A ${meetingType.replace('_', ' ')} meeting has been scheduled for ${scheduledDate}`},
        'meeting',
        ${meetingResult[0].id}
      )
    `);

    return NextResponse.json({
      message: 'Meeting scheduled successfully',
      meeting: meetingResult[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error scheduling meeting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/supplier-portal/meetings - Update meeting status
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId, action, cancellationReason } = body;

    if (!meetingId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'confirm_supplier':
        result = await erpDb.execute(sql`
          UPDATE supplier_meetings
          SET confirmed_by_supplier = true, updated_at = NOW()
          WHERE id = ${meetingId}
          RETURNING *
        `);
        break;
      case 'confirm_customer':
        result = await erpDb.execute(sql`
          UPDATE supplier_meetings
          SET confirmed_by_customer = true, updated_at = NOW()
          WHERE id = ${meetingId}
          RETURNING *
        `);
        break;
      case 'cancel':
        result = await erpDb.execute(sql`
          UPDATE supplier_meetings
          SET status = 'cancelled', cancellation_reason = ${cancellationReason}, updated_at = NOW()
          WHERE id = ${meetingId}
          RETURNING *
        `);
        break;
      case 'complete':
        result = await erpDb.execute(sql`
          UPDATE supplier_meetings
          SET status = 'completed', updated_at = NOW()
          WHERE id = ${meetingId}
          RETURNING *
        `);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const meetingData = Array.from(result);

    return NextResponse.json({
      message: 'Meeting updated successfully',
      meeting: meetingData[0],
    });
  } catch (error: any) {
    console.error('Error updating meeting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
