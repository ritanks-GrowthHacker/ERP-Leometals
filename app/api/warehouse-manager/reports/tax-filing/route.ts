import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesOrders, salesOrderLines, purchaseOrders, purchaseOrderLines } from '@/lib/db/schema';
import { eq, and, sql as drizzleSql, desc } from 'drizzle-orm';
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
    const fiscalYear = searchParams.get('fiscalYear') || searchParams.get('fiscal_year');
    const quarter = searchParams.get('quarter');
    const month = searchParams.get('month');

    // Get warehouse info
    const warehouse = await erpDb.query.warehouses.findFirst({
      where: eq(drizzleSql`id`, user.warehouseId),
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // Get sales orders for this warehouse with lines
    const salesOrdersData = await erpDb.query.salesOrders.findMany({
      where: eq(salesOrders.warehouseId, user.warehouseId),
      with: {
        lines: true,
      },
    });

    // Get purchase orders for this warehouse with lines
    const purchaseOrdersData = await erpDb.query.purchaseOrders.findMany({
      where: eq(purchaseOrders.warehouseId, user.warehouseId),
      with: {
        lines: true,
      },
    });

    // Calculate sales tax by tax rate
    const salesTaxBreakup = new Map<string, { taxableAmount: number; totalTax: number; orderCount: Set<string> }>();
    
    salesOrdersData.forEach(so => {
      so.lines.forEach((line: any) => {
        const taxRate = line.taxRate?.toString() || '0';
        const quantity = parseFloat(line.quantityOrdered || '0');
        const unitPrice = parseFloat(line.unitPrice || '0');
        const discountAmount = parseFloat(line.discountAmount || '0');
        const lineSubtotal = (quantity * unitPrice) - discountAmount;
        const lineTax = (lineSubtotal * parseFloat(taxRate)) / 100;
        
        if (!salesTaxBreakup.has(taxRate)) {
          salesTaxBreakup.set(taxRate, { taxableAmount: 0, totalTax: 0, orderCount: new Set() });
        }
        
        const data = salesTaxBreakup.get(taxRate)!;
        data.taxableAmount += lineSubtotal;
        data.totalTax += lineTax;
        data.orderCount.add(so.id);
      });
    });

    // Calculate purchase tax by tax rate
    const purchaseTaxBreakup = new Map<string, { taxableAmount: number; totalTax: number; orderCount: Set<string> }>();
    
    purchaseOrdersData.forEach(po => {
      po.lines.forEach((line: any) => {
        const taxRate = line.taxRate?.toString() || '0';
        const quantity = parseFloat(line.quantityOrdered || '0');
        const unitPrice = parseFloat(line.unitPrice || '0');
        const discountAmount = parseFloat(line.discountAmount || '0');
        const lineSubtotal = (quantity * unitPrice) - discountAmount;
        const lineTax = (lineSubtotal * parseFloat(taxRate)) / 100;
        
        if (!purchaseTaxBreakup.has(taxRate)) {
          purchaseTaxBreakup.set(taxRate, { taxableAmount: 0, totalTax: 0, orderCount: new Set() });
        }
        
        const data = purchaseTaxBreakup.get(taxRate)!;
        data.taxableAmount += lineSubtotal;
        data.totalTax += lineTax;
        data.orderCount.add(po.id);
      });
    });

    // Convert to array format
    const salesTaxData = Array.from(salesTaxBreakup.entries()).map(([taxRate, data]) => ({
      tax_rate: parseFloat(taxRate),
      taxable_amount: data.taxableAmount.toFixed(2),
      total_tax: data.totalTax.toFixed(2),
      order_count: data.orderCount.size,
    }));

    const purchaseTaxData = Array.from(purchaseTaxBreakup.entries()).map(([taxRate, data]) => ({
      tax_rate: parseFloat(taxRate),
      taxable_amount: data.taxableAmount.toFixed(2),
      total_tax: data.totalTax.toFixed(2),
      po_count: data.orderCount.size,
    }));

    // Calculate input and output tax
    const totalOutputTax = salesTaxData.reduce((sum, row) => sum + parseFloat(row.total_tax || '0'), 0);
    const totalInputTax = purchaseTaxData.reduce((sum, row) => sum + parseFloat(row.total_tax || '0'), 0);
    const netTaxLiability = totalOutputTax - totalInputTax;

    return NextResponse.json({
      warehouse,
      period: {
        fiscalYear,
        quarter,
        month,
      },
      salesTax: {
        breakup: salesTaxData,
        totalOutputTax,
      },
      purchaseTax: {
        breakup: purchaseTaxData,
        totalInputTax,
      },
      netTaxLiability,
      status: netTaxLiability > 0 ? 'payable' : 'receivable',
    });
  } catch (error: any) {
    console.error('Error fetching tax filing data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax filing data', details: error.message },
      { status: 500 }
    );
  }
}
