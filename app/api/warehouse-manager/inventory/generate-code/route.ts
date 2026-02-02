import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { productCategories, products } from '@/lib/db/schema';
import { getErpUserFromToken } from '@/lib/auth';
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
  productName: string
): Promise<string> {
  const namePrefix = productName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  
  let isUnique = false;
  let sku = '';
  
  while (!isUnique) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    sku = `${namePrefix}-${randomPart}`;
    
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

export async function POST(req: NextRequest) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { type, productName, locationName } = await req.json();

    if (type === 'category') {
      const code = await generateCategoryCode(user.organizationId);
      return NextResponse.json({ code });
    } else if (type === 'product') {
      if (!productName) {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      const sku = await generateProductSKU(user.organizationId, productName);
      return NextResponse.json({ sku });
    } else if (type === 'location') {
      if (!locationName) {
        return NextResponse.json({ error: 'Location name is required' }, { status: 400 });
      }
      // Generate location code similar to category
      const prefix = 'LOC';
      const namePart = locationName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${namePart}-${randomPart}`;
      return NextResponse.json({ code });
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error generating code:', error);
    return NextResponse.json(
      { error: 'Failed to generate code', details: error.message },
      { status: 500 }
    );
  }
}
