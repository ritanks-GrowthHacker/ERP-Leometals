import { NextRequest, NextResponse } from 'next/server';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { erpDb } from '@/lib/db';
import { customers, salesOrders } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * GET /api/erp/audit/customers
 * Get list of all customers for selection with summary stats
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  // Check permissions
  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view customers' },
      { status: 403 }
    );
  }

  try {
    // Get all customers with aggregated order data
    const customersList = await erpDb
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        city: customers.city,
        isActive: customers.isActive,
        totalOrders: sql<number>`COUNT(${salesOrders.id})::int`,
        lifetimeValue: sql<number>`COALESCE(SUM(${salesOrders.totalAmount}), 0)::decimal`,
      })
      .from(customers)
      .leftJoin(salesOrders, eq(customers.id, salesOrders.customerId))
      .where(eq(customers.erpOrganizationId, user.erpOrganizationId))
      .groupBy(customers.id, customers.name, customers.email, customers.phone, customers.city, customers.isActive)
      .orderBy(desc(sql`COALESCE(SUM(${salesOrders.totalAmount}), 0)`));

    return NextResponse.json({
      success: true,
      data: customersList.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.isActive ? 'active' : 'inactive',
        totalOrders: Number(c.totalOrders),
        lifetimeValue: Number(c.lifetimeValue),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
