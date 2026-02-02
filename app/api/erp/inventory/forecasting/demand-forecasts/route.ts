import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Fetch demand forecasts
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json({ error: 'No permission to view inventory' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const period = searchParams.get('period') || 'monthly';

    let query = sql`
      SELECT 
        df.*,
        p.name as product_name,
        p.sku as product_sku,
        w.name as warehouse_name
      FROM demand_forecasts df
      JOIN products p ON p.id = df.product_id
      LEFT JOIN warehouses w ON w.id = df.warehouse_id
      WHERE df.erp_organization_id = ${user.erpOrganizationId}
    `;

    if (productId) {
      query = sql`${query} AND df.product_id = ${productId}`;
    }

    if (period !== 'all') {
      query = sql`${query} AND df.forecast_period = ${period}`;
    }

    query = sql`${query} ORDER BY df.forecast_date DESC LIMIT 100`;

    const forecasts = await erpDb.execute(query);

    return NextResponse.json({ forecasts });
  } catch (error: any) {
    console.error('Error fetching demand forecasts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forecasts', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create demand forecast
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const {
      productId,
      warehouseId,
      forecastDate,
      forecastPeriod,
      forecastedQuantity,
      forecastMethod,
      confidenceLevel,
      notes,
    } = body;

    if (!productId || !forecastDate || !forecastPeriod || !forecastedQuantity) {
      return NextResponse.json(
        { error: 'Product, date, period, and quantity are required' },
        { status: 400 }
      );
    }

    const result = await erpDb.execute(sql`
      INSERT INTO demand_forecasts (
        erp_organization_id,
        product_id,
        warehouse_id,
        forecast_date,
        forecast_period,
        forecasted_quantity,
        forecast_method,
        confidence_level,
        notes
      ) VALUES (
        ${user.erpOrganizationId},
        ${productId},
        ${warehouseId || null},
        ${forecastDate},
        ${forecastPeriod},
        ${forecastedQuantity},
        ${forecastMethod || 'moving_average'},
        ${confidenceLevel || null},
        ${notes || null}
      )
      RETURNING *
    `);

    return NextResponse.json({ forecast: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating forecast:', error);
    return NextResponse.json(
      { error: 'Failed to create forecast', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update actual quantity after period
export async function PUT(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, actualQuantity } = body;

    if (!id || actualQuantity === undefined) {
      return NextResponse.json(
        { error: 'Forecast ID and actual quantity are required' },
        { status: 400 }
      );
    }

    const result = await erpDb.execute(sql`
      UPDATE demand_forecasts
      SET
        actual_quantity = ${actualQuantity},
        updated_at = NOW()
      WHERE id = ${id} AND erp_organization_id = ${user.erpOrganizationId}
      RETURNING *
    `);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    return NextResponse.json({ forecast: result[0] });
  } catch (error: any) {
    console.error('Error updating forecast:', error);
    return NextResponse.json(
      { error: 'Failed to update forecast', details: error.message },
      { status: 500 }
    );
  }
}
