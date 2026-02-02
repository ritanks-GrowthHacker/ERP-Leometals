import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { requireErpAccess } from '@/lib/auth';
import { erpDb as db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify ERP authentication
    const { user, error } = await requireErpAccess(request);
    if (error) return error;

    // Fetch warehouses for the organization
    const result = await db.execute(sql`
      SELECT 
        id,
        name,
        code,
        address,
        city,
        state,
        country,
        postal_code
      FROM warehouses
      WHERE erp_organization_id = ${user.erpOrganizationId}
      ORDER BY name
    `);

    const warehouses = Array.from(result);

    return NextResponse.json({ warehouses });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    );
  }
}
