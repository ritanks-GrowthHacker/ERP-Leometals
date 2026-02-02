import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { verifySupplierAuth } from '@/lib/auth/supplier-auth';
import { sql } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supplier, error } = await verifySupplierAuth(req);
  if (error) return error;

  try {
    const { id: invoiceId } = await params;
    const body = await req.json();
    const {
      dueDate,
      subtotal,
      taxAmount,
      shippingCharges,
      discountAmount,
      notes,
    } = body;

    // Calculate total
    const totalAmount = 
      parseFloat(subtotal) + 
      parseFloat(taxAmount || 0) + 
      parseFloat(shippingCharges || 0) - 
      parseFloat(discountAmount || 0);

    // Verify invoice belongs to supplier
    const checkResult = await erpDb.execute(sql`
      SELECT id FROM supplier_invoices
      WHERE id = ${invoiceId} AND supplier_id = ${supplier.id}
    `);

    if (Array.from(checkResult).length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update invoice
    await erpDb.execute(sql`
      UPDATE supplier_invoices
      SET 
        due_date = ${dueDate},
        subtotal = ${subtotal},
        tax_amount = ${taxAmount || 0},
        shipping_charges = ${shippingCharges || 0},
        discount_amount = ${discountAmount || 0},
        total_amount = ${totalAmount},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${invoiceId} AND supplier_id = ${supplier.id}
    `);

    return NextResponse.json({ 
      message: 'Invoice updated successfully',
      totalAmount 
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
