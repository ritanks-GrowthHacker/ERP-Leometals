import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifySupplierToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.type !== 'supplier') {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

// GET /api/supplier-portal/purchase-orders - Get POs sent to this supplier
export async function GET(req: NextRequest) {
  const supplier = await verifySupplierToken(req);
  
  if (!supplier) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Fetch POs sent to this supplier where no quotation exists yet
    const result = await erpDb.execute(sql`
      SELECT 
        po.id,
        po.po_number,
        po.po_date,
        po.expected_delivery_date,
        po.status,
        po.total_amount,
        po.notes,
        COUNT(sq.id) as quotation_count
      FROM purchase_orders po
      LEFT JOIN supplier_quotation_submissions sq 
        ON sq.purchase_order_id = po.id 
        AND sq.supplier_id = ${supplier.supplierId}
      WHERE po.supplier_id = ${supplier.supplierId}
        AND po.status IN ('sent', 'confirmed')
      GROUP BY po.id, po.po_number, po.po_date, po.expected_delivery_date, po.status, po.total_amount, po.notes
      ORDER BY po.po_date DESC
    `);
    
    const purchaseOrders = Array.from(result);

    return NextResponse.json({ purchaseOrders });
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
