/**
 * BATCH ERROR HANDLER FIX SCRIPT
 * This script documents all files that need error handling updates
 * Run this via the subagent to apply fixes systematically
 */

const FILES_TO_FIX = [
  // Inventory Module - Critical
  { path: 'app/api/erp/inventory/stock-levels/route.ts', priority: 'high', operations: ['POST', 'PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/products/[id]/route.ts', priority: 'high', operations: ['PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/categories/[id]/route.ts', priority: 'medium', operations: ['PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/quality/inspections/route.ts', priority: 'medium', operations: ['POST', 'PUT'] },
  { path: 'app/api/erp/inventory/movements/[id]/route.ts', priority: 'medium', operations: ['PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/warehouses/[id]/locations/route.ts', priority: 'medium', operations: ['POST', 'PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/products/[id]/suppliers/route.ts', priority: 'medium', operations: ['POST', 'DELETE'] },
  { path: 'app/api/erp/inventory/procurement/po-suggestions/route.ts', priority: 'high', operations: ['GET', 'POST'] },
  { path: 'app/api/erp/inventory/analytics/route.ts', priority: 'low', operations: ['GET'] },
  { path: 'app/api/erp/inventory/analytics/advanced/route.ts', priority: 'low', operations: ['GET'] },
  { path: 'app/api/erp/inventory/forecasting/demand-forecasts/route.ts', priority: 'medium', operations: ['POST', 'PUT'] },
  { path: 'app/api/erp/inventory/costing/valuation/route.ts', priority: 'medium', operations: ['GET', 'POST'] },
  { path: 'app/api/erp/inventory/adjustments/[id]/route.ts', priority: 'medium', operations: ['PUT', 'DELETE'] },
  { path: 'app/api/erp/inventory/alerts/route.ts', priority: 'medium', operations: ['GET', 'PUT'] },
  { path: 'app/api/erp/inventory/alerts/send/route.ts', priority: 'low', operations: ['POST'] },
  { path: 'app/api/erp/inventory/generate-code/route.ts', priority: 'low', operations: ['GET'] },
  
  // Purchasing Module - Critical
  { path: 'app/api/erp/purchasing/rfq/[id]/route.ts', priority: 'high', operations: ['PUT', 'DELETE'] },
  { path: 'app/api/erp/purchasing/rfq/[id]/send/route.ts', priority: 'medium', operations: ['POST'] },
  { path: 'app/api/erp/purchasing/orders/[id]/send/route.ts', priority: 'medium', operations: ['POST'] },
  { path: 'app/api/erp/purchasing/analytics/route.ts', priority: 'low', operations: ['GET'] },
  
  // Auth Module
  { path: 'app/api/erp/auth/check-access/route.ts', priority: 'high', operations: ['GET'] },
];

// Instructions for each file:
// 1. Add import: import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
// 2. Replace all catch blocks with:
//    logDatabaseError('<operation context>', error);
//    const dbError = handleDatabaseError(error);
//    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });

export { FILES_TO_FIX };
