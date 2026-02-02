import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { eq, and, or, like } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    // Build query conditions
    const conditions = [eq(customers.erpOrganizationId, user.organizationId)];
    
    if (search) {
      conditions.push(
        or(
          like(customers.name, `%${search}%`),
          like(customers.email, `%${search}%`),
          like(customers.phone, `%${search}%`)
        )!
      );
    }

    // Get customers using Drizzle ORM (read-only for warehouse managers)
    const customersList = await erpDb.query.customers.findMany({
      where: and(...conditions),
      with: {
        contacts: true,
      },
    });

    const total = customersList.length;

    return NextResponse.json({
      customers: customersList,
      pagination: {
        total,
      },
      readOnly: true, // No customer lifecycle actions for warehouse managers
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers', details: error.message },
      { status: 500 }
    );
  }
}
