import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql, eq, and } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';
import { stockLevels, warehouseLocations, warehouses, products } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// Auto-generate bin position and rack number based on location and existing stock
async function generatePositionForLocation(locationId: string, productSku: string) {
  // Get location details
  const location = await erpDb.query.warehouseLocations.findFirst({
    where: eq(warehouseLocations.id, locationId),
  });

  if (!location) {
    return { binPosition: null, rackNumber: null };
  }

  // Get existing stock in this location to find next available position
  const existingStock = await erpDb.query.stockLevels.findMany({
    where: eq(stockLevels.locationId, locationId),
    orderBy: desc(stockLevels.updatedAt),
  });

  const locationType = location.locationType?.toLowerCase();
  const locationCode = location.code || 'LOC';

  // Count items already in this location
  const itemCount = existingStock.length + 1;

  let binPosition = null;
  let rackNumber = null;

  switch (locationType) {
    case 'bin':
      binPosition = `BIN-${locationCode}-${String(itemCount).padStart(3, '0')}`;
      break;

    case 'rack':
      const rackRow = Math.ceil(itemCount / 30);
      const posInRack = ((itemCount - 1) % 30) + 1;
      const col = Math.ceil(posInRack / 3);
      const row = ((posInRack - 1) % 3) + 1;
      rackNumber = `RACK-${locationCode}-R${rackRow}`;
      binPosition = `C${col}R${row}`;
      break;

    case 'shelf':
      const level = Math.ceil(itemCount / 20);
      const shelfPos = itemCount % 20 || 20;
      binPosition = `SHELF-${locationCode}-L${level}-P${String(shelfPos).padStart(2, '0')}`;
      break;

    case 'aisle':
      binPosition = `AISLE-${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;

    case 'zone':
    default:
      binPosition = `${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;
  }

  return { binPosition, rackNumber };
}

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const productId = searchParams.get('productId');
    const locationId = searchParams.get('locationId');
    const offset = (page - 1) * limit;

    // If specific product and location requested (for adjustment modal)
    if (productId && locationId) {
      const specificQuery = sql`
        SELECT 
          sl.id,
          sl.product_id,
          sl.quantity_on_hand,
          sl.quantity_reserved,
          sl.quantity_on_hand as quantity_available,
          sl.location_id
        FROM stock_levels sl
        WHERE sl.product_id = ${productId}
        AND sl.location_id = ${locationId}
        AND sl.warehouse_id = ${user.warehouseId}
      `;
      
      const result = await erpDb.execute(specificQuery);
      return NextResponse.json({
        stockLevels: Array.from(result),
      });
    }

    // Build search condition
    const searchCondition = search 
      ? sql`AND (p.name ILIKE ${`%${search}%`} OR p.sku ILIKE ${`%${search}%`})`
      : sql``;

    // Check if warehouse has locations
    const locationsResult = await erpDb.execute(sql`
      SELECT COUNT(*) as count 
      FROM warehouse_locations 
      WHERE warehouse_id = ${user.warehouseId}
    `);
    const hasLocations = Number((locationsResult as any)[0]?.count || 0) > 0;

    // Get stock levels for this warehouse
    // Show: 1. Products with low stock, 2. Products not assigned to any location (if locations exist)
    let query;
    if (hasLocations) {
      query = sql`
        SELECT 
          sl.id,
          sl.product_id,
          p.name as product_name,
          p.sku,
          sl.quantity_on_hand,
          sl.quantity_reserved,
          sl.quantity_on_hand as quantity_available,
          sl.warehouse_id,
          w.name as warehouse_name,
          w.code as warehouse_code,
          sl.location_id,
          wl.name as location_name,
          wl.code as location_code,
          p.reorder_point,
          p.cost_price,
          (sl.quantity_on_hand * p.cost_price) as total_value,
          sl.last_counted_at
        FROM stock_levels sl
        INNER JOIN products p ON sl.product_id = p.id
        INNER JOIN warehouses w ON sl.warehouse_id = w.id
        LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
        WHERE sl.warehouse_id = ${user.warehouseId}
        AND (
          sl.location_id IS NULL 
          OR (p.reorder_point IS NOT NULL AND sl.quantity_on_hand <= p.reorder_point)
        )
        ${searchCondition}
        ORDER BY p.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // No locations in warehouse, just show low stock products
      query = sql`
        SELECT 
          sl.id,
          sl.product_id,
          p.name as product_name,
          p.sku,
          sl.quantity_on_hand,
          sl.quantity_reserved,
          sl.quantity_on_hand as quantity_available,
          sl.warehouse_id,
          w.name as warehouse_name,
          w.code as warehouse_code,
          sl.location_id,
          wl.name as location_name,
          wl.code as location_code,
          p.reorder_point,
          p.cost_price,
          (sl.quantity_on_hand * p.cost_price) as total_value,
          sl.last_counted_at
        FROM stock_levels sl
        INNER JOIN products p ON sl.product_id = p.id
        INNER JOIN warehouses w ON sl.warehouse_id = w.id
        LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
        WHERE sl.warehouse_id = ${user.warehouseId}
        AND p.reorder_point IS NOT NULL 
        AND sl.quantity_on_hand <= p.reorder_point
        ${searchCondition}
        ORDER BY p.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const stockLevels = await erpDb.execute(query);

    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as count
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE sl.warehouse_id = ${user.warehouseId}
      ${searchCondition}
    `;

    const countResult = await erpDb.execute(countQuery);
    const total = Number((countResult as any)[0]?.count || 0);

    return NextResponse.json({
      stockLevels: Array.from(stockLevels),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching warehouse stock levels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock levels', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/warehouse-manager/inventory/stock-levels
// Assign product to location in warehouse manager's warehouse
export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is warehouse manager
    if (user.role !== 'warehouse_manager' || !user.warehouseId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const {
      productId,
      locationId,
      quantityOnHand,
      quantityReserved,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing required field: productId' },
        { status: 400 }
      );
    }

    const warehouseId = user.warehouseId;

    // Verify warehouse belongs to organization
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, warehouseId),
        eq(warehouses.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Verify product belongs to organization
    const product = await erpDb.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // If location provided, verify it belongs to this warehouse
    if (locationId) {
      const location = await erpDb.query.warehouseLocations.findFirst({
        where: and(
          eq(warehouseLocations.id, locationId),
          eq(warehouseLocations.warehouseId, warehouseId)
        ),
      });

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found or does not belong to your warehouse' },
          { status: 404 }
        );
      }
    }

    // Check if stock level already exists
    const existing = await erpDb.query.stockLevels.findFirst({
      where: and(
        eq(stockLevels.productId, productId),
        eq(stockLevels.warehouseId, warehouseId),
        locationId 
          ? eq(stockLevels.locationId, locationId)
          : sql`location_id IS NULL`
      ),
    });

    if (existing) {
      // Update existing
      const [updated] = await erpDb
        .update(stockLevels)
        .set({
          quantityOnHand: quantityOnHand ?? existing.quantityOnHand,
          quantityReserved: quantityReserved ?? existing.quantityReserved,
          lastCountedAt: new Date(),
          lastCountedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(stockLevels.id, existing.id))
        .returning();

      return NextResponse.json({ stockLevel: updated });
    } else {
      // Check location capacity before adding new stock
      if (locationId) {
        const location = await erpDb.query.warehouseLocations.findFirst({
          where: eq(warehouseLocations.id, locationId),
        });

        if (location && location.capacity) {
          const stockResult = await erpDb
            .select({
              totalQuantity: sql<string>`COALESCE(SUM(${stockLevels.quantityOnHand}), 0)`,
            })
            .from(stockLevels)
            .where(eq(stockLevels.locationId, locationId));

          const currentTotal = parseFloat(stockResult[0]?.totalQuantity || '0');
          const newQuantity = parseFloat(quantityOnHand || '0');
          const locationCapacity = parseFloat(location.capacity);

          if (currentTotal + newQuantity > locationCapacity) {
            return NextResponse.json(
              {
                error: `Cannot add product. Location capacity exceeded. Current: ${currentTotal}, Adding: ${newQuantity}, Capacity: ${locationCapacity}`,
              },
              { status: 400 }
            );
          }
        }
      }

      // Auto-generate bin position and rack number if location is provided
      let binPosition: string | null = null;
      let rackNumber: string | null = null;
      
      if (locationId) {
        const autoPosition = await generatePositionForLocation(locationId, product.sku);
        binPosition = autoPosition.binPosition;
        rackNumber = autoPosition.rackNumber;
      }

      // Update product barcode with warehouse name if not already set
      if (!product.barcode || !product.barcode.includes(warehouse.name)) {
        const warehouseName = warehouse.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const newBarcode = `${warehouseName}-${product.sku}`;
        
        await erpDb
          .update(products)
          .set({
            barcode: newBarcode,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));
      }

      // Create new with auto-generated positions
      const [newStockLevel] = await erpDb
        .insert(stockLevels)
        .values({
          productId,
          warehouseId,
          locationId: locationId || null,
          quantityOnHand: quantityOnHand || '0',
          quantityReserved: quantityReserved || '0',
          binPosition,
          rackNumber,
          lastCountedAt: new Date(),
          lastCountedBy: user.id,
        })
        .returning();

      return NextResponse.json({ stockLevel: newStockLevel }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating/updating stock level:', error);
    return NextResponse.json(
      { error: 'Failed to create/update stock level', details: error.message },
      { status: 500 }
    );
  }
}
