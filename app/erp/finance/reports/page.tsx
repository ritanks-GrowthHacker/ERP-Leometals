'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { BarChart3, TrendingUp, DollarSign, Calendar, Download } from 'lucide-react';

export default function FinancialReportsPage() {
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState('pl');
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 3, 1).toISOString().split('T')[0], // April 1
    endDate: new Date().toISOString().split('T')[0],
  });

  const reports = [
    { id: 'pl', name: 'Profit & Loss', icon: TrendingUp, color: 'blue' },
    { id: 'balance-sheet', name: 'Balance Sheet', icon: BarChart3, color: 'green' },
    { id: 'trial-balance', name: 'Trial Balance', icon: DollarSign, color: 'purple' },
    { id: 'cash-flow', name: 'Cash Flow', icon: Calendar, color: 'orange' },
  ];

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `/api/erp/finance/reports/${selectedReport}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Financial Reports</h2>
        <p className="text-sm text-gray-500">Generate comprehensive financial statements</p>
      </div>

      {/* Report Selection */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className={`p-6 rounded-xl border-2 transition-all ${
                isSelected
                  ? `border-${report.color}-600 bg-${report.color}-50`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon
                size={32}
                className={`mb-3 ${isSelected ? `text-${report.color}-600` : 'text-gray-400'}`}
              />
              <h3 className={`font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                {report.name}
              </h3>
            </button>
          );
        })}
      </div>

      {/* Date Range */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Period</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
            >
              <Download size={20} className="mr-2" />
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {!reportData ? (
          <div className="text-center text-gray-500">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="mb-2">Select a report and date range to generate</p>
            <p className="text-sm text-gray-400">Your financial reports will appear here</p>
          </div>
        ) : selectedReport === 'pl' ? (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-6">Profit & Loss Statement</h3>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold">Revenue</span>
                <span className="font-semibold text-green-600">{formatCurrency(reportData.revenue)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold">Expenses</span>
                <span className="font-semibold text-red-600">{formatCurrency(reportData.expenses)}</span>
              </div>
              <div className="flex justify-between border-t-2 pt-4">
                <span className="text-lg font-bold">Net Profit</span>
                <span className={`text-lg font-bold ${reportData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(reportData.profit)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Profit Margin</span>
                <span>{reportData.profitMargin}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <p>Report type "{selectedReport}" is not yet implemented</p>
          </div>
        )}
      </div>
    </div>
  );
}
