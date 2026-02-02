import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { erpDb, mainDb } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Fetch organization name
    const [org] = await mainDb.execute(
      sql`SELECT name FROM organizations WHERE id = ${decoded.organizationId} LIMIT 1`
    );
    const organizationName = (org as any)?.name || 'Organization';

    // Fetch all stock levels with warehouse and location info
    const stockLevelsQuery = await erpDb.execute(sql`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        w.id as warehouse_id,
        w.name as warehouse_name,
        wl.id as location_id,
        wl.name as location_name,
        sl.quantity_on_hand,
        sl.quantity_reserved
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      JOIN warehouses w ON sl.warehouse_id = w.id
      LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id
      WHERE p.erp_organization_id = ${decoded.organizationId}
        AND CAST(sl.quantity_on_hand AS DECIMAL) > 0
      ORDER BY w.name, wl.name, p.name
    `);

    const stockLevels = Array.from(stockLevelsQuery) as any[];

    // Group by warehouse -> location
    const warehouseMap = new Map<string, {
      id: string;
      name: string;
      totalQty: number;
      locations: Map<string, {
        name: string;
        qty: number;
        products: Array<{ name: string; sku: string; qty: number }>;
      }>;
    }>();

    stockLevels.forEach((item) => {
      const warehouseId = item.warehouse_id;
      const warehouseName = item.warehouse_name;
      const locationId = item.location_id || 'no-location';
      const locationName = item.location_name || 'N/A';
      const qty = parseFloat(item.quantity_on_hand || '0');

      if (!warehouseMap.has(warehouseId)) {
        warehouseMap.set(warehouseId, {
          id: warehouseId,
          name: warehouseName,
          totalQty: 0,
          locations: new Map(),
        });
      }

      const warehouse = warehouseMap.get(warehouseId)!;
      warehouse.totalQty += qty;

      if (!warehouse.locations.has(locationId)) {
        warehouse.locations.set(locationId, {
          name: locationName,
          qty: 0,
          products: [],
        });
      }

      const location = warehouse.locations.get(locationId)!;
      location.qty += qty;
      location.products.push({
        name: item.product_name,
        sku: item.product_sku,
        qty: qty,
      });
    });

    // Generate HTML
    const today = new Date().toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const warehousesHTML = Array.from(warehouseMap.values())
      .map(warehouse => {
        const locationsHTML = Array.from(warehouse.locations.values())
          .map(location => `
            <div class="location-box">
              <div class="location-header">
                <span class="location-name">📍 ${location.name}</span>
                <span class="location-qty">Quantity: ${location.qty.toFixed(0)}</span>
              </div>
              <table class="products-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  ${location.products.map(product => `
                    <tr>
                      <td>${product.name}</td>
                      <td>${product.sku}</td>
                      <td class="text-right">${product.qty.toFixed(0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('');

        return `
          <div class="warehouse-section">
            <div class="warehouse-header">
              <h2>🏢 Warehouse: ${warehouse.name}</h2>
              <div class="warehouse-total">Total Quantity: ${warehouse.totalQty.toFixed(0)}</div>
            </div>
            <div class="locations-container">
              ${locationsHTML}
            </div>
          </div>
        `;
      }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stock Levels - ${today}</title>
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      margin: 0; 
      padding: 40px; 
      color: #1a1a1a; 
      background: #f8f9fa; 
    }
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
      background: white; 
      padding: 50px; 
      box-shadow: 0 0 30px rgba(0,0,0,0.1); 
    }
    .header { 
      text-align: center; 
      margin-bottom: 50px; 
      border-bottom: 4px solid #2563eb; 
      padding-bottom: 30px; 
    }
    .header h1 { 
      color: #2563eb; 
      margin: 0; 
      font-size: 40px; 
      font-weight: bold; 
      letter-spacing: 2px; 
    }
    .header .org-name { 
      font-size: 24px; 
      font-weight: bold; 
      color: #1e40af; 
      margin: 15px 0; 
    }
    .header p { 
      margin: 8px 0; 
      color: #6b7280; 
      font-size: 16px; 
    }
    .warehouse-section { 
      margin: 40px 0; 
      page-break-inside: avoid; 
    }
    .warehouse-header { 
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); 
      color: white; 
      padding: 25px; 
      border-radius: 12px 12px 0 0; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .warehouse-header h2 { 
      margin: 0; 
      font-size: 24px; 
      font-weight: 600; 
    }
    .warehouse-total { 
      font-size: 20px; 
      font-weight: bold; 
      background: rgba(255,255,255,0.2); 
      padding: 10px 20px; 
      border-radius: 8px; 
    }
    .locations-container { 
      border: 2px solid #2563eb; 
      border-top: none; 
      border-radius: 0 0 12px 12px; 
      padding: 20px; 
      background: #f9fafb; 
    }
    .location-box { 
      margin: 20px 0; 
      background: white; 
      border-radius: 8px; 
      overflow: hidden; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
    }
    .location-header { 
      background: #eff6ff; 
      padding: 15px 20px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-left: 4px solid #3b82f6; 
    }
    .location-name { 
      font-weight: 600; 
      font-size: 18px; 
      color: #1e40af; 
    }
    .location-qty { 
      font-weight: bold; 
      color: #2563eb; 
      font-size: 16px; 
    }
    .products-table { 
      width: 100%; 
      border-collapse: collapse; 
    }
    .products-table th { 
      background: #f3f4f6; 
      padding: 12px; 
      text-align: left; 
      font-size: 13px; 
      font-weight: 600; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      color: #374151; 
      border-bottom: 2px solid #e5e7eb; 
    }
    .products-table td { 
      padding: 12px; 
      border-bottom: 1px solid #e5e7eb; 
      font-size: 14px; 
      color: #374151; 
    }
    .products-table tr:hover { 
      background: #f9fafb; 
    }
    .text-right { 
      text-align: right; 
      font-weight: 600; 
      color: #2563eb; 
    }
    .footer { 
      margin-top: 60px; 
      padding-top: 30px; 
      border-top: 3px solid #e5e7eb; 
      text-align: center; 
      color: #6b7280; 
      font-size: 14px; 
    }
    @media print { 
      body { margin: 20px; } 
      .no-print { display: none; } 
      .warehouse-section { page-break-inside: avoid; }
      .location-box { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 STOCK LEVELS REPORT</h1>
      <div class="org-name">${organizationName}</div>
      <p style="font-size: 16px; margin-top: 10px;">Generated on: ${today}</p>
    </div>

    ${warehousesHTML}

    <div class="footer">
      <p>This is a system-generated report from ${organizationName}</p>
      <p>Report generated on ${today}</p>
    </div>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error generating stock levels PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate stock levels PDF' },
      { status: 500 }
    );
  }
}
