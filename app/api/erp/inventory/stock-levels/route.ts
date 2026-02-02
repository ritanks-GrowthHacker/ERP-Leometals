import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { stockLevels, warehouses, products, warehouseLocations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, sql, isNull, desc } from 'drizzle-orm';

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
      // Format: BIN-{LOCATION_CODE}-{NUMBER}
      binPosition = `BIN-${locationCode}-${String(itemCount).padStart(3, '0')}`;
      break;

    case 'rack':
      // Format: 10 columns x 3 items = 30 items per rack
      const rackRow = Math.ceil(itemCount / 30); // 30 items per rack
      const posInRack = ((itemCount - 1) % 30) + 1;
      const col = Math.ceil(posInRack / 3); // Column (1-10)
      const row = ((posInRack - 1) % 3) + 1; // Row in column (1-3)
      rackNumber = `RACK-${locationCode}-R${rackRow}`;
      binPosition = `C${col}R${row}`;
      break;

    case 'shelf':
      // Format: SHELF-{LOCATION_CODE}-{LEVEL}-{POSITION}
      const level = Math.ceil(itemCount / 20); // 20 items per shelf level
      const shelfPos = itemCount % 20 || 20;
      binPosition = `SHELF-${locationCode}-L${level}-P${String(shelfPos).padStart(2, '0')}`;
      break;

    case 'aisle':
      // Format: AISLE-{LOCATION_CODE}-{POSITION}
      binPosition = `AISLE-${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;

    case 'zone':
    default:
      // Format: {LOCATION_CODE}-{NUMBER}
      binPosition = `${locationCode}-${String(itemCount).padStart(4, '0')}`;
      break;
  }

  return { binPosition, rackNumber };
}

// GET /api/erp/inventory/stock-levels
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view stock levels' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const productId = searchParams.get('productId');
    const lowStock = searchParams.get('lowStock') === 'true';

    // Build query conditions
    const conditions = [];
    
    if (warehouseId) {
      conditions.push(eq(stockLevels.warehouseId, warehouseId));
    }
    
    if (productId) {
      conditions.push(eq(stockLevels.productId, productId));
    }

    let stockLevelsList = await erpDb.query.stockLevels.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        product: true,
        warehouse: true,
        location: true,
      },
    });

    // Filter by organization - only show products that belong to user's organization
    stockLevelsList = stockLevelsList.filter((sl: any) => 
      sl.product?.erpOrganizationId === user.erpOrganizationId
    );

    // ONLY show low stock (available <= reorderPoint) or out of stock (available <= 0)
    const lowStockItems = stockLevelsList.filter((sl: any) => {
      const available = parseFloat(sl.quantityOnHand || '0');
      const reorderPoint = parseFloat(sl.product?.reorderPoint || '0');
      // Show if: out of stock OR (has reorder point AND available <= reorder point)
      return available <= 0 || (reorderPoint > 0 && available <= reorderPoint);
    });

    // Get products not assigned to any warehouse (only active products)
    const productsWithNoWarehouse = await erpDb.query.products.findMany({
      where: and(
        eq(products.erpOrganizationId, user.erpOrganizationId),
        eq(products.isActive, true)
      ),
    });

    const assignedProductIds = new Set(stockLevelsList.map(sl => sl.productId));
    const unassignedProducts = productsWithNoWarehouse
      .filter((p: any) => !assignedProductIds.has(p.id))
      .map((p: any) => ({
        id: `virtual-${p.id}`,
        productId: p.id,
        productVariantId: null,
        warehouseId: null,
        locationId: null,
        quantityOnHand: '0',
        quantityReserved: '0',
        lastCountedAt: null,
        lastCountedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: p,
        warehouse: null,
        location: null,
      }));

    // Combine ONLY low stock and unassigned products
    stockLevelsList = [...lowStockItems, ...unassignedProducts] as any;

    // Additional lowStock filter if requested
    if (lowStock) {
      stockLevelsList = stockLevelsList.filter((sl: any) => {
        const available = parseFloat(sl.quantityOnHand || '0');
        const reorderPoint = parseFloat(sl.product?.reorderPoint || '0');
        return available <= 0 || (reorderPoint > 0 && available <= reorderPoint);
      });
    }

    return NextResponse.json({ stockLevels: stockLevelsList });
  } catch (err: any) {
    console.error('Error fetching stock levels:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stock levels' },
      { status: 500 }
    );
  }
}

// POST /api/erp/inventory/stock-levels
// Manual stock level creation/update
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create stock levels' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      productId,
      warehouseId,
      locationId,
      quantityOnHand,
      quantityReserved,
    } = body;

    if (!productId || !warehouseId) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, warehouseId' },
        { status: 400 }
      );
    }

    // Verify warehouse belongs to organization
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.id, warehouseId),
        eq(warehouses.erpOrganizationId, user.erpOrganizationId)
      ),
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your organization' },
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
      // Update existing - keep existing positions if they exist
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
          // Calculate current total quantity in location
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
  } catch (err: any) {
    console.error('Error creating/updating stock level:', err);
    return NextResponse.json(
      { error: 'Failed to create/update stock level' },
      { status: 500 }
    );
  }
}

