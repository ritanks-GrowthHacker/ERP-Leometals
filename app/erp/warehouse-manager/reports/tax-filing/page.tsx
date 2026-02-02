'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface TaxData {
  id: string;
  tax_type: string;
  period: string;
  total_sales: number;
  total_purchases: number;
  tax_payable: number;
  tax_receivable: number;
  net_tax: number;
  status: string;
  filed_date: string | null;
}

export default function WarehouseManagerTaxFilingPage() {
  const router = useRouter();
  const [taxData, setTaxData] = useState<TaxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState<string>('');
  const [month, setMonth] = useState<string>('');

  useEffect(() => {
    fetchTaxData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYear, quarter, month]);

  const fetchTaxData = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({ fiscal_year: fiscalYear });
      if (quarter) params.append('quarter', quarter);
      if (month) params.append('month', month);

      const response = await fetch(`/api/warehouse-manager/reports/tax-filing?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTaxData(data.taxData);
      } else if (response.status === 403) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tax Filing</h1>
        <p className="text-gray-600 mt-2">Warehouse-scoped tax data</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Fiscal Year</label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="border rounded px-3 py-2"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quarter</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Quarters</option>
              <option value="Q1">Q1 (Jan-Mar)</option>
              <option value="Q2">Q2 (Apr-Jun)</option>
              <option value="Q3">Q3 (Jul-Sep)</option>
              <option value="Q4">Q4 (Oct-Dec)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button onClick={fetchTaxData}>Apply Filters</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : taxData.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No tax data found for selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Tax Type</th>
                  <th className="text-left py-3 px-4">Period</th>
                  <th className="text-right py-3 px-4">Sales</th>
                  <th className="text-right py-3 px-4">Purchases</th>
                  <th className="text-right py-3 px-4">Payable</th>
                  <th className="text-right py-3 px-4">Receivable</th>
                  <th className="text-right py-3 px-4">Net Tax</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Filed Date</th>
                </tr>
              </thead>
              <tbody>
                {taxData.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium uppercase">{item.tax_type}</td>
                    <td className="py-3 px-4">{item.period}</td>
                    <td className="py-3 px-4 text-right">₹{item.total_sales.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      ₹{item.total_purchases.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ₹{item.tax_payable.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ₹{item.tax_receivable.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      ₹{item.net_tax.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full capitalize ${
                          item.status === 'filed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {item.filed_date ? new Date(item.filed_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
