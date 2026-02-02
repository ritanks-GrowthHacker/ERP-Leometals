import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Fetch purchase order suggestions
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    const suggestions = await erpDb.execute(sql`
      SELECT 
        pos.*,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        w.name as warehouse_name,
        wl.name as location_name,
        wl.code as location_code,
        pc.name as category_name
      FROM purchase_order_suggestions pos
      JOIN products p ON p.id = pos.product_id
      LEFT JOIN warehouses w ON w.id = pos.warehouse_id
      LEFT JOIN warehouse_locations wl ON wl.id = pos.location_id
      LEFT JOIN product_categories pc ON pc.id = p.product_category_id
      WHERE pos.erp_organization_id = ${user.erpOrganizationId}
      ${status === 'pending' ? sql`AND pos.status = 'pending'` : sql``}
      ${status === 'ordered' || status === 'approved' ? sql`AND pos.status IN ('ordered', 'approved')` : sql``}
      ${status === 'rejected' ? sql`AND pos.status = 'rejected'` : sql``}
      ORDER BY 
        CASE pos.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        pos.days_of_stock_remaining ASC,
        pos.created_at DESC
    `);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error fetching purchase order suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Generate new suggestions (run the automated function)
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    // Run the stored procedure to generate suggestions
    await erpDb.execute(sql`SELECT generate_purchase_order_suggestions()`);

    // Count the newly generated suggestions
    const countResult = await erpDb.execute(sql`
      SELECT COUNT(*) as count 
      FROM purchase_order_suggestions 
      WHERE erp_organization_id = ${user.erpOrganizationId}
      AND status = 'pending'
    `);

    const count = countResult[0]?.count || 0;

    return NextResponse.json({ 
      message: 'Purchase order suggestions generated successfully',
      count: parseInt(count.toString())
    });
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update suggestion status
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, status, notes, supplierId: selectedSupplierId } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Suggestion ID and status are required' },
        { status: 400 }
      );
    }

    // Get the suggestion details with supplier info
    const suggestion = await erpDb.execute(sql`
      SELECT 
        pos.*,
        p.name as product_name,
        ps.supplier_id,
        ps.unit_price
      FROM purchase_order_suggestions pos
      JOIN products p ON p.id = pos.product_id
      LEFT JOIN LATERAL (
        SELECT supplier_id, unit_price
        FROM product_suppliers
        WHERE product_id = pos.product_id
          AND is_active = true
        ORDER BY is_primary DESC, created_at DESC
        LIMIT 1
      ) ps ON true
      WHERE pos.id = ${id} AND pos.erp_organization_id = ${user.erpOrganizationId}
    `);

    if (suggestion.length === 0) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    const suggestionData = suggestion[0];

    // Update suggestion status (will be changed to 'ordered' after PO creation)
    let finalStatus = status;
    const result = await erpDb.execute(sql`
      UPDATE purchase_order_suggestions
      SET
        status = ${finalStatus},
        notes = ${notes || null},
        approved_at = ${status === 'approved' ? sql`NOW()` : sql`NULL`},
        approved_by = ${status === 'approved' ? user.id : null},
        accepted_at = ${status === 'approved' ? sql`NOW()` : sql`NULL`}
      WHERE id = ${id} AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING *
    `);

    // Check if already approved
    if (status === 'approved' && suggestionData.status === 'approved') {
      const updatedAtValue = suggestionData.updated_at;
      const approvedAt = new Date(
        typeof updatedAtValue === 'string' || typeof updatedAtValue === 'number' || updatedAtValue instanceof Date
          ? updatedAtValue
          : String(updatedAtValue)
      );
      const now = new Date();
      const diffMs = now.getTime() - approvedAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeMessage = '';
      if (diffDays > 0) {
        timeMessage = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        timeMessage = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        timeMessage = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else {
        timeMessage = 'just now';
      }
      
      return NextResponse.json(
        { error: `This PO suggestion was already approved ${timeMessage}` },
        { status: 400 }
      );
    }

    // If approved, create purchase order
    if (status === 'approved') {
      // Use selected supplier or fall back to primary supplier from product_suppliers
      const supplierId = selectedSupplierId || suggestionData.supplier_id;
      const warehouseId = suggestionData.warehouse_id;

      if (!supplierId) {
        return NextResponse.json(
          { error: 'No supplier found for this product. Please assign a supplier first.' },
          { status: 400 }
        );
      }

      // Get supplier unit price if custom supplier selected
      let unitPrice = parseFloat(String(suggestionData.unit_price || '0'));
      if (selectedSupplierId) {
        const supplierInfo = await erpDb.execute(sql`
          SELECT unit_price
          FROM product_suppliers
          WHERE product_id = ${suggestionData.product_id}
            AND supplier_id = ${selectedSupplierId}
            AND is_active = true
          LIMIT 1
        `);
        if (supplierInfo.length > 0 && supplierInfo[0].unit_price) {
          unitPrice = parseFloat(String(supplierInfo[0].unit_price));
        }
      }

      // Generate unique PO number
      let poNumber;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const lastPO = await erpDb.execute(sql`
          SELECT po_number FROM purchase_orders
          WHERE erp_organization_id = ${user.erpOrganizationId}
          ORDER BY created_at DESC
          LIMIT 1
        `);

        const lastPoNumber = (lastPO[0]?.po_number as string) || 'PO000000';
        const nextNumber = parseInt(String(lastPoNumber).replace('PO', '')) + 1;
        poNumber = `PO${String(nextNumber).padStart(6, '0')}`;
        
        // Check if this number already exists
        const existing = await erpDb.execute(sql`
          SELECT po_number FROM purchase_orders
          WHERE erp_organization_id = ${user.erpOrganizationId}
          AND po_number = ${poNumber}
        `);
        
        if (existing.length === 0) break;
        attempts++;
        
        // If duplicate found, add random suffix
        if (attempts >= maxAttempts - 1) {
          poNumber = `PO${String(nextNumber).padStart(6, '0')}-${Date.now().toString().slice(-4)}`;
        }
      }

      // Calculate amounts
      const quantity = parseFloat(String(suggestionData.suggested_quantity || '0'));
      const subtotal = unitPrice * quantity;
      const taxRate = 18; // Default 18% GST
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Create purchase order
      const newPO = await erpDb.execute(sql`
        INSERT INTO purchase_orders (
          erp_organization_id,
          supplier_id,
          warehouse_id,
          po_number,
          po_date,
          status,
          subtotal,
          tax_amount,
          total_amount,
          notes,
          created_by
        ) VALUES (
          ${user.erpOrganizationId},
          ${supplierId},
          ${warehouseId},
          ${poNumber},
          NOW(),
          'draft',
          ${subtotal.toFixed(2)},
          ${taxAmount.toFixed(2)},
          ${totalAmount.toFixed(2)},
          ${`Auto-generated from PO Suggestion - Priority: ${suggestionData.priority}, Days Remaining: ${suggestionData.days_of_stock_remaining}`},
          ${user.id}
        )
        RETURNING *
      `);

      // Create PO line
      await erpDb.execute(sql`
        INSERT INTO purchase_order_lines (
          purchase_order_id,
          product_id,
          description,
          quantity_ordered,
          unit_price,
          tax_rate
        ) VALUES (
          ${newPO[0].id},
          ${suggestionData.product_id},
          ${suggestionData.product_name},
          ${suggestionData.suggested_quantity},
          ${unitPrice.toFixed(2)},
          ${taxRate.toString()}
        )
      `);

      // Update suggestion status to 'ordered' now that PO is created
      await erpDb.execute(sql`
        UPDATE purchase_order_suggestions
        SET status = 'ordered', po_number = ${poNumber}, approved_at = NOW(), approved_by = ${user.id}, accepted_at = NOW()
        WHERE id = ${id}
      `);

      // Send email to supplier
      try {
        await fetch(`${req.nextUrl.origin}/api/erp/purchasing/orders/${newPO[0].id}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
        });
      } catch (emailError) {
        console.error('Failed to send PO email:', emailError);
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        suggestion: { ...result[0], status: 'ordered', po_number: poNumber },
        purchaseOrder: newPO[0],
        message: 'Purchase order created and sent to supplier successfully'
      });
    }

    return NextResponse.json({ suggestion: result[0] });
  } catch (error: any) {
    console.error('Error updating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion', details: error.message },
      { status: 500 }
    );
  }
}
