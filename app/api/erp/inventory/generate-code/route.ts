import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productCategories, products, warehouses, warehouseLocations } from '@/lib/db/schema';
import { requireErpAccess } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// Helper function to generate unique category code
async function generateCategoryCode(erpOrganizationId: string): Promise<string> {
  const prefix = 'CAT';
  let isUnique = false;
  let code = '';
  
  while (!isUnique) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    code = `${prefix}-${randomPart}`;
    
    const existing = await erpDb.query.productCategories.findFirst({
      where: and(
        eq(productCategories.erpOrganizationId, erpOrganizationId),
        eq(productCategories.code, code)
      ),
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return code;
}

// Helper function to generate unique product SKU
async function generateProductSKU(
  erpOrganizationId: string,
  productName: string,
  categoryCode?: string,
  subCategoryCode?: string,
  productType?: string
): Promise<string> {
  // Build SKU prefix based on available data
  let skuPrefix = '';
  
  // Add category code if provided
  if (categoryCode) {
    skuPrefix += categoryCode.substring(0, 3).toUpperCase();
  }
  
  // Add sub category code if provided
  if (subCategoryCode) {
    skuPrefix += '-' + subCategoryCode.substring(0, 3).toUpperCase();
  }
  
  // Add product type prefix
  if (productType) {
    const typePrefix = productType === 'storable' ? 'ST' : 
                       productType === 'consumable' ? 'CN' : 
                       productType === 'service' ? 'SV' : 'GN';
    skuPrefix += (skuPrefix ? '-' : '') + typePrefix;
  }
  
  // Add product name prefix
  const namePrefix = productName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  skuPrefix += (skuPrefix ? '-' : '') + namePrefix;
  
  let isUnique = false;
  let sku = '';
  
  while (!isUnique) {
    // Generate 4 alphanumeric characters
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    sku = `${skuPrefix}-${randomPart}`;
    
    const existing = await erpDb.query.products.findFirst({
      where: and(
        eq(products.erpOrganizationId, erpOrganizationId),
        eq(products.sku, sku)
      ),
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return sku;
}

// Helper function to generate unique warehouse code
async function generateWarehouseCode(erpOrganizationId: string): Promise<string> {
  const prefix = 'WH';
  let isUnique = false;
  let code = '';
  
  while (!isUnique) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    code = `${prefix}-${randomPart}`;
    
    const existing = await erpDb.query.warehouses.findFirst({
      where: and(
        eq(warehouses.erpOrganizationId, erpOrganizationId),
        eq(warehouses.code, code)
      ),
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return code;
}

// Helper function to generate unique warehouse location code
async function generateLocationCode(
  locationName: string
): Promise<string> {
  // Extract first 3 characters from location name
  const namePrefix = locationName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  
  let isUnique = false;
  let code = '';
  
  while (!isUnique) {
    // Generate 5 alphanumeric characters
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    code = `${namePrefix}-${randomPart}`;
    
    const existing = await erpDb.query.warehouseLocations.findFirst({
      where: eq(warehouseLocations.code, code),
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return code;
}

// POST /api/erp/inventory/generate-code
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { type, productName, locationName, categoryCode, subCategoryCode, productType } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required (category, product, warehouse, location)' },
        { status: 400 }
      );
    }

    let code = '';

    switch (type) {
      case 'category':
        code = await generateCategoryCode(user.erpOrganizationId);
        break;
      case 'product':
        if (!productName) {
          return NextResponse.json(
            { error: 'Product name is required for SKU generation' },
            { status: 400 }
          );
        }
        code = await generateProductSKU(
          user.erpOrganizationId, 
          productName, 
          categoryCode, 
          subCategoryCode, 
          productType
        );
        break;
      case 'warehouse':
        code = await generateWarehouseCode(user.erpOrganizationId);
        break;
      case 'location':
        if (!locationName) {
          return NextResponse.json(
            { error: 'Location name is required for code generation' },
            { status: 400 }
          );
        }
        code = await generateLocationCode(locationName);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be category, product, warehouse, or location' },
          { status: 400 }
        );
    }

    return NextResponse.json({ code });
  } catch (err: any) {
    console.error('Error generating code:', err);
    return NextResponse.json(
      { error: 'Failed to generate code' },
      { status: 500 }
    );
  }
}
