import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { erpDb as db } from '@/lib/db';
import { notifyProcurementAccepted } from '@/lib/warehouseNotifications';

interface Params {
  id: string; // rfq_supplier_id
}

// POST /api/supplier-portal/rfqs/[id]/accept - Accept RFQ
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { supplier, error } = await verifySupplierAuth(request);
    if (error) return error;

    const { id: rfqSupplierId } = await context.params;

    // Verify access and get RFQ details
    const rfqSupplierResult = await db.execute(sql`
      SELECT rs.*, rfq.status as rfq_status, rfq.id as rfq_id
      FROM rfq_suppliers rs
      JOIN request_for_quotations rfq ON rs.rfq_id = rfq.id
      WHERE rs.id = ${rfqSupplierId} AND rs.supplier_id = ${supplier.id}
    `);

    if (!rfqSupplierResult || Array.from(rfqSupplierResult).length === 0) {
      return NextResponse.json({ error: 'RFQ not found or no access' }, { status: 404 });
    }

    const rfqSupplier = Array.from(rfqSupplierResult)[0] as any;

    // Check if already accepted or rejected
    if (rfqSupplier.response_status !== 'pending') {
      return NextResponse.json(
        { error: `RFQ already ${rfqSupplier.response_status}` },
        { status: 400 }
      );
    }

    // Update rfq_suppliers record
    await db.execute(sql`
      UPDATE rfq_suppliers
      SET 
        response_status = 'accepted',
        response_date = NOW(),
        accepted_at = NOW(),
        responded = true
      WHERE id = ${rfqSupplierId}
    `);

    // Update RFQ status to in_progress if it was sent
    if (rfqSupplier.rfq_status === 'sent') {
      await db.execute(sql`
        UPDATE request_for_quotations
        SET status = 'in_progress', updated_at = NOW()
        WHERE id = ${rfqSupplier.rfq_id}
      `);
    }

    // Send email notification to warehouse
    console.log('🔔 Attempting to send RFQ acceptance email...');
    try {
      const rfqDetails = await db.execute(sql`
        SELECT rfq.*, w.id as warehouse_id, w.name as warehouse_name, w.email as warehouse_email, 
               w.manager_email, s.name as supplier_name, s.email as supplier_email
        FROM request_for_quotations rfq
        LEFT JOIN warehouses w ON rfq.warehouse_id = w.id
        LEFT JOIN suppliers s ON s.id = ${supplier.id}
        WHERE rfq.id = ${rfqSupplier.rfq_id}
      `);
      
      const rfq = Array.from(rfqDetails)[0] as any;
      
      console.log('RFQ Details:', {
        warehouse_id: rfq?.warehouse_id,
        warehouse_name: rfq?.warehouse_name,
        warehouse_email: rfq?.warehouse_email,
        manager_email: rfq?.manager_email,
        rfq_number: rfq?.rfq_number,
        supplier_name: rfq?.supplier_name,
      });
      
      if (rfq && rfq.warehouse_id) {
        console.log(`Calling notifyProcurementAccepted with:`);
        console.log(`  - warehouseId: ${rfq.warehouse_id}`);
        console.log(`  - rfqNumber: ${rfq.rfq_number}`);
        console.log(`  - supplierName: ${rfq.supplier_name || supplier.name}`);
        
        const result = await notifyProcurementAccepted(
          rfq.warehouse_id,
          rfq.rfq_number || 'N/A',
          rfq.supplier_name || supplier.name || 'Unknown'
        );
        
        console.log('Email notification result:', result);
      } else {
        console.warn('⚠️ No warehouse_id found in RFQ, skipping email notification');
      }
    } catch (emailError) {
      console.error('❌ Error sending RFQ acceptance email:', emailError);
      // Don't fail the API call if email fails
    }

    return NextResponse.json({
      message: 'RFQ accepted successfully',
      rfqSupplierId: rfqSupplierId,
      rfqId: rfqSupplier.rfq_id,
    });
  } catch (error: any) {
    console.error('Error accepting RFQ:', error);
    return NextResponse.json(
      { error: 'Failed to accept RFQ', details: error.message },
      { status: 500 }
    );
  }
}
