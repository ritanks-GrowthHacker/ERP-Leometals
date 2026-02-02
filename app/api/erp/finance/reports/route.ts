import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { generalLedger, customerInvoices, vendorBills, chartOfAccounts, customerPayments, vendorPayments } from '@/lib/db/schema/finance';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET: Financial reports
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'finance', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view finance reports' },
      { status: 403 }
    );
  }

  try {
    const organizationId = user.organizationId;

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!reportType) {
      return NextResponse.json({ error: 'Report type is required' }, { status: 400 });
    }

    switch (reportType) {
      case 'profit-loss':
        return await getProfitAndLossReport(organizationId, startDate, endDate);
      
      case 'balance-sheet':
        return await getBalanceSheetReport(organizationId, endDate);
      
      case 'accounts-receivable':
        return await getAccountsReceivableReport(organizationId);
      
      case 'accounts-payable':
        return await getAccountsPayableReport(organizationId);
      
      case 'cash-flow':
        return await getCashFlowReport(organizationId, startDate, endDate);
      
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

// Profit & Loss Report
async function getProfitAndLossReport(
  organizationId: string,
  startDate: string | null,
  endDate: string | null
) {
  const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  // Get all revenue and expense accounts
  const accounts = await erpDb.query.chartOfAccounts.findMany({
    where: and(
      eq(chartOfAccounts.erpOrganizationId, organizationId),
      sql`${chartOfAccounts.accountType} IN ('revenue', 'expense')`
    ),
  });

  // Get GL entries for the period
  const glEntries = await erpDb.query.generalLedger.findMany({
    where: and(
      eq(generalLedger.erpOrganizationId, organizationId),
      gte(generalLedger.transactionDate, start),
      lte(generalLedger.transactionDate, end),
      eq(generalLedger.status, 'posted')
    ),
  });

  const revenue: any[] = [];
  const expenses: any[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const account of accounts) {
    const entries = glEntries.filter(e => e.accountId === account.id);
    const total = entries.reduce((sum, e) => {
      return sum + (parseFloat(e.creditAmount || '0') - parseFloat(e.debitAmount || '0'));
    }, 0);

    if (account.accountType === 'revenue' && total !== 0) {
      revenue.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: total,
      });
      totalRevenue += total;
    } else if (account.accountType === 'expense' && total !== 0) {
      expenses.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: Math.abs(total),
      });
      totalExpenses += Math.abs(total);
    }
  }

  const netIncome = totalRevenue - totalExpenses;

  return NextResponse.json({
    reportType: 'profit-loss',
    period: { startDate: start, endDate: end },
    revenue: {
      items: revenue,
      total: totalRevenue,
    },
    expenses: {
      items: expenses,
      total: totalExpenses,
    },
    netIncome,
  }, { status: 200 });
}

// Balance Sheet Report
async function getBalanceSheetReport(organizationId: string, asOfDate: string | null) {
  const date = asOfDate || new Date().toISOString().split('T')[0];

  // Get all asset, liability, and equity accounts
  const accounts = await erpDb.query.chartOfAccounts.findMany({
    where: and(
      eq(chartOfAccounts.erpOrganizationId, organizationId),
      sql`${chartOfAccounts.accountType} IN ('asset', 'liability', 'equity')`
    ),
  });

  // Get GL entries up to the date
  const glEntries = await erpDb.query.generalLedger.findMany({
    where: and(
      eq(generalLedger.erpOrganizationId, organizationId),
      lte(generalLedger.transactionDate, date),
      eq(generalLedger.status, 'posted')
    ),
  });

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const account of accounts) {
    const entries = glEntries.filter(e => e.accountId === account.id);
    const total = entries.reduce((sum, e) => {
      return sum + (parseFloat(e.debitAmount || '0') - parseFloat(e.creditAmount || '0'));
    }, 0);

    if (total !== 0) {
      const item = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: Math.abs(total),
      };

      if (account.accountType === 'asset') {
        assets.push(item);
        totalAssets += Math.abs(total);
      } else if (account.accountType === 'liability') {
        liabilities.push(item);
        totalLiabilities += Math.abs(total);
      } else if (account.accountType === 'equity') {
        equity.push(item);
        totalEquity += Math.abs(total);
      }
    }
  }

  return NextResponse.json({
    reportType: 'balance-sheet',
    asOfDate: date,
    assets: {
      items: assets,
      total: totalAssets,
    },
    liabilities: {
      items: liabilities,
      total: totalLiabilities,
    },
    equity: {
      items: equity,
      total: totalEquity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
  }, { status: 200 });
}

// Accounts Receivable Aging Report
async function getAccountsReceivableReport(organizationId: string) {
  const allInvoices = await erpDb.query.customerInvoices.findMany({
    where: and(
      eq(customerInvoices.erpOrganizationId, organizationId),
      sql`${customerInvoices.outstandingAmount} > 0`
    ),
    with: {
      customer: true,
    },
  });

  const today = new Date();
  const aging = {
    current: [] as any[],
    days30: [] as any[],
    days60: [] as any[],
    days90: [] as any[],
    days90Plus: [] as any[],
  };

  let totals = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    days90Plus: 0,
    total: 0,
  };

  for (const invoice of allInvoices) {
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = parseFloat(invoice.outstandingAmount);

    const item = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer && !Array.isArray(invoice.customer) && 'name' in invoice.customer ? invoice.customer.name : 'Unknown',
      dueDate: invoice.dueDate,
      daysOverdue,
      outstandingAmount: outstanding,
    };

    if (daysOverdue <= 0) {
      aging.current.push(item);
      totals.current += outstanding;
    } else if (daysOverdue <= 30) {
      aging.days30.push(item);
      totals.days30 += outstanding;
    } else if (daysOverdue <= 60) {
      aging.days60.push(item);
      totals.days60 += outstanding;
    } else if (daysOverdue <= 90) {
      aging.days90.push(item);
      totals.days90 += outstanding;
    } else {
      aging.days90Plus.push(item);
      totals.days90Plus += outstanding;
    }

    totals.total += outstanding;
  }

  return NextResponse.json({
    reportType: 'accounts-receivable',
    generatedAt: today.toISOString(),
    aging,
    totals,
  }, { status: 200 });
}

// Accounts Payable Aging Report
async function getAccountsPayableReport(organizationId: string) {
  const allBills = await erpDb.query.vendorBills.findMany({
    where: and(
      eq(vendorBills.erpOrganizationId, organizationId),
      sql`${vendorBills.outstandingAmount} > 0`
    ),
    with: {
      supplier: true,
    },
  });

  const today = new Date();
  const aging = {
    current: [] as any[],
    days30: [] as any[],
    days60: [] as any[],
    days90: [] as any[],
    days90Plus: [] as any[],
  };

  let totals = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    days90Plus: 0,
    total: 0,
  };

  for (const bill of allBills) {
    const dueDate = new Date(bill.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = parseFloat(bill.outstandingAmount);

    const item = {
      billNumber: bill.billNumber,
      supplierName: bill.supplier && !Array.isArray(bill.supplier) && 'name' in bill.supplier ? bill.supplier.name : 'Unknown',
      dueDate: bill.dueDate,
      daysOverdue,
      outstandingAmount: outstanding,
    };

    if (daysOverdue <= 0) {
      aging.current.push(item);
      totals.current += outstanding;
    } else if (daysOverdue <= 30) {
      aging.days30.push(item);
      totals.days30 += outstanding;
    } else if (daysOverdue <= 60) {
      aging.days60.push(item);
      totals.days60 += outstanding;
    } else if (daysOverdue <= 90) {
      aging.days90.push(item);
      totals.days90 += outstanding;
    } else {
      aging.days90Plus.push(item);
      totals.days90Plus += outstanding;
    }

    totals.total += outstanding;
  }

  return NextResponse.json({
    reportType: 'accounts-payable',
    generatedAt: today.toISOString(),
    aging,
    totals,
  }, { status: 200 });
}

// Cash Flow Report
async function getCashFlowReport(
  organizationId: string,
  startDate: string | null,
  endDate: string | null
) {
  const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  // Get cash inflows (customer payments)
  const inflows = await erpDb.query.customerPayments.findMany({
    where: and(
      eq(customerPayments.erpOrganizationId, organizationId),
      gte(customerPayments.paymentDate, start),
      lte(customerPayments.paymentDate, end)
    ),
  });

  // Get cash outflows (vendor payments)
  const outflows = await erpDb.query.vendorPayments.findMany({
    where: and(
      eq(vendorPayments.erpOrganizationId, organizationId),
      gte(vendorPayments.paymentDate, start),
      lte(vendorPayments.paymentDate, end)
    ),
  });

  const totalInflows = inflows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalOutflows = outflows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const netCashFlow = totalInflows - totalOutflows;

  return NextResponse.json({
    reportType: 'cash-flow',
    period: { startDate: start, endDate: end },
    inflows: {
      items: inflows.map(p => ({
        date: p.paymentDate,
        amount: parseFloat(p.amount),
        method: p.paymentMethod,
      })),
      total: totalInflows,
    },
    outflows: {
      items: outflows.map(p => ({
        date: p.paymentDate,
        amount: parseFloat(p.amount),
        method: p.paymentMethod,
      })),
      total: totalOutflows,
    },
    netCashFlow,
  }, { status: 200 });
}
