import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/sales/customers
 * List all customers
 * Requires: JWT token with 'read' scope
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('is_active');

    let conditions = sql`c.erp_organization_id = ${user.erpOrganizationId}`;

    if (search) {
      conditions = sql`${conditions} AND (
        LOWER(c.name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(c.code) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(c.email) LIKE LOWER(${'%' + search + '%'})
      )`;
    }

    if (isActive === 'true') {
      conditions = sql`${conditions} AND c.is_active = true`;
    } else if (isActive === 'false') {
      conditions = sql`${conditions} AND c.is_active = false`;
    }

    const result = await erpDb.execute(sql`
      SELECT 
        c.*
      FROM customers c
      WHERE ${conditions}
      ORDER BY c.name ASC
    `);

    const customers = result.map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      email: row.email,
      phone: row.phone,
      website: row.website,
      billingAddress: row.billing_address,
      shippingAddress: row.shipping_address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      taxId: row.tax_id,
      paymentTerms: row.payment_terms,
      currencyCode: row.currency_code,
      creditLimit: row.credit_limit,
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: customers
    });

  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/sales/customers
 * Create a new customer with optional contacts
 * Requires: JWT token with 'write' scope
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth(request);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { 
      name,
      code,
      email,
      phone,
      website,
      billingAddress,
      shippingAddress,
      city,
      state,
      country,
      postalCode,
      taxId,
      paymentTerms,
      currencyCode,
      creditLimit,
      notes,
      contacts
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    if (code) {
      const existingCode = await erpDb.execute(sql`
        SELECT id FROM customers 
        WHERE code = ${code} 
        AND erp_organization_id = ${user.erpOrganizationId}
        LIMIT 1
      `);
      
      if (existingCode.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Customer code already exists' },
          { status: 400 }
        );
      }
    }

    // Create customer
    const customerResult = await erpDb.execute(sql`
      INSERT INTO customers (
        erp_organization_id,
        name,
        code,
        email,
        phone,
        website,
        billing_address,
        shipping_address,
        city,
        state,
        country,
        postal_code,
        tax_id,
        payment_terms,
        currency_code,
        credit_limit,
        notes,
        created_by
      )
      VALUES (
        ${user.erpOrganizationId},
        ${name},
        ${code || null},
        ${email || null},
        ${phone || null},
        ${website || null},
        ${billingAddress || null},
        ${shippingAddress || null},
        ${city || null},
        ${state || null},
        ${country || null},
        ${postalCode || null},
        ${taxId || null},
        ${paymentTerms || 30},
        ${currencyCode || 'USD'},
        ${creditLimit || 0},
        ${notes || null},
        ${user.userId}
      )
      RETURNING *
    `);

    const customer = customerResult[0] as any;

    // Create customer contacts if provided
    const contactsData = [];
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      for (const contact of contacts) {
        if (contact.name) {
          const contactResult = await erpDb.execute(sql`
            INSERT INTO customer_contacts (
              customer_id,
              name,
              email,
              phone,
              position,
              is_primary
            )
            VALUES (
              ${customer.id},
              ${contact.name},
              ${contact.email || null},
              ${contact.phone || null},
              ${contact.position || null},
              ${contact.isPrimary || false}
            )
            RETURNING *
          `);
          
          const ct = contactResult[0] as any;
          contactsData.push({
            id: ct.id,
            name: ct.name,
            email: ct.email,
            phone: ct.phone,
            position: ct.position,
            isPrimary: ct.is_primary,
            createdAt: ct.created_at
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: {
        id: customer.id,
        name: customer.name,
        code: customer.code,
        email: customer.email,
        phone: customer.phone,
        website: customer.website,
        billingAddress: customer.billing_address,
        shippingAddress: customer.shipping_address,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        postalCode: customer.postal_code,
        taxId: customer.tax_id,
        paymentTerms: customer.payment_terms,
        currencyCode: customer.currency_code,
        creditLimit: customer.credit_limit,
        isActive: customer.is_active,
        notes: customer.notes,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
        contacts: contactsData
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer', details: error.message },
      { status: 500 }
    );
  }
}
