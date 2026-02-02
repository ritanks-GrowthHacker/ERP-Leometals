'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { 
  FileBarChart, Download, RefreshCw, Calendar, 
  CheckCircle, AlertCircle, FileText, TrendingUp, DollarSign
} from 'lucide-react';
import Toast from '@/components/ui/Toast';

interface GSTR1Data {
  return_period: string;
  b2b_invoices_count: number;
  b2b_taxable_value: number;
  b2b_igst_amount: number;
  b2b_cgst_amount: number;
  b2b_sgst_amount: number;
  b2c_large_taxable_value: number;
  b2c_other_taxable_value: number;
  export_taxable_value: number;
  status: string;
}

interface GSTR3BData {
  return_period: string;
  outward_taxable_supplies: number;
  outward_igst: number;
  outward_cgst: number;
  outward_sgst: number;
  itc_igst_available: number;
  itc_cgst_available: number;
  itc_sgst_available: number;
  itc_igst_reversed: number;
  itc_cgst_reversed: number;
  itc_sgst_reversed: number;
  net_itc_igst: number;
  net_itc_cgst: number;
  net_itc_sgst: number;
  igst_payable: number;
  cgst_payable: number;
  sgst_payable: number;
  status: string;
}

export default function GSTReportsPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    // Set default period to current month
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentPeriod = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;
    setSelectedPeriod(currentPeriod);
  }, []);

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const period = `${monthNames[date.getMonth()]}-${date.getFullYear()}`;
      options.push(period);
    }
    return options;
  };

  const generateGSTR1 = async () => {
    if (!selectedPeriod) {
      setToast({ message: 'Please select a period', type: 'error' });
      return;
    }

    setLoading(true);
    setGstr1Data(null);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/finance/gst/reports/gstr1?period=${selectedPeriod}&financialYear=2025-26`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Transform API response to match expected format
        const transformedData = {
          return_period: data.period,
          b2b_invoices_count: data.b2b?.count || 0,
          b2b_taxable_value: data.b2b?.totalTaxableValue || 0,
          b2b_igst_amount: data.b2b?.totalIgst || 0,
          b2b_cgst_amount: data.b2b?.totalCgst || 0,
          b2b_sgst_amount: data.b2b?.totalSgst || 0,
          b2c_large_taxable_value: data.b2cLarge?.totalTaxableValue || 0,
          b2c_other_taxable_value: data.b2cOther?.totalTaxableValue || 0,
          export_taxable_value: data.exports?.totalTaxableValue || 0,
          status: 'generated',
        };
        setGstr1Data(transformedData);
        setToast({ message: 'GSTR-1 generated successfully!', type: 'success' });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to generate GSTR-1', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to generate GSTR-1:', error);
      setToast({ message: 'Network error. Please check your connection.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const generateGSTR3B = async () => {
    if (!selectedPeriod) {
      setToast({ message: 'Please select a period', type: 'error' });
      return;
    }

    setLoading(true);
    setGstr3bData(null);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/finance/gst/reports/gstr3b?period=${selectedPeriod}&financialYear=2025-26`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 GSTR-3B Raw Response:', data);
        
        // Transform GSTR-3B API response to match expected format
        const transformedData = {
          return_period: data.period,
          outward_taxable_supplies: data.table3_1_outward_supplies?.taxableValue || 0,
          outward_igst: data.table3_1_outward_supplies?.igst || 0,
          outward_cgst: data.table3_1_outward_supplies?.cgst || 0,
          outward_sgst: data.table3_1_outward_supplies?.sgst || 0,
          itc_igst_available: data.table4_itc_available?.igst || 0,
          itc_cgst_available: data.table4_itc_available?.cgst || 0,
          itc_sgst_available: data.table4_itc_available?.sgst || 0,
          itc_igst_reversed: data.table4_itc_reversed?.igst || 0,
          itc_cgst_reversed: data.table4_itc_reversed?.cgst || 0,
          itc_sgst_reversed: data.table4_itc_reversed?.sgst || 0,
          net_itc_igst: data.net_itc?.igst || 0,
          net_itc_cgst: data.net_itc?.cgst || 0,
          net_itc_sgst: data.net_itc?.sgst || 0,
          igst_payable: data.table5_tax_payable?.igst || 0,
          cgst_payable: data.table5_tax_payable?.cgst || 0,
          sgst_payable: data.table5_tax_payable?.sgst || 0,
          status: 'generated',
        };
        
        console.log('📊 GSTR-3B Transformed:', transformedData);
        setGstr3bData(transformedData);
        setToast({ message: 'GSTR-3B generated successfully!', type: 'success' });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to generate GSTR-3B', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to generate GSTR-3B:', error);
      setToast({ message: 'Network error. Please check your connection.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

 const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '₹0.00';
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">GST Reports</h2>
        <p className="text-sm text-gray-500">Generate and view GSTR-1 and GSTR-3B returns</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Calendar className="text-blue-600 mr-2" size={20} />
              <label className="text-sm font-medium text-gray-700 mr-3">Select Period:</label>
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Choose Month</option>
              {generateMonthOptions().map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-3">
            {activeTab === 'gstr1' && (
              <button
                onClick={generateGSTR1}
                disabled={loading || !selectedPeriod}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileBarChart size={18} className="mr-2" />
                    Generate GSTR-1
                  </>
                )}
              </button>
            )}
            {activeTab === 'gstr3b' && (
              <button
                onClick={generateGSTR3B}
                disabled={loading || !selectedPeriod}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileBarChart size={18} className="mr-2" />
                    Generate GSTR-3B
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('gstr1')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'gstr1'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              GSTR-1 (Outward Supplies)
            </button>
            <button
              onClick={() => setActiveTab('gstr3b')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'gstr3b'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              GSTR-3B (Monthly Return)
            </button>
          </nav>
        </div>
      </div>

      {/* GSTR-1 Tab */}
      {activeTab === 'gstr1' && (
        <div>
          {gstr1Data ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">B2B Invoices</span>
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{gstr1Data.b2b_invoices_count}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(gstr1Data.b2b_taxable_value)} taxable</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">B2C Large</span>
                    <TrendingUp className="text-green-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(gstr1Data.b2c_large_taxable_value)}
                  </p>
                  <p className="text-xs text-gray-500">&gt; ₹2.5L per invoice</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Exports</span>
                    <DollarSign className="text-purple-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(gstr1Data.export_taxable_value)}
                  </p>
                  <p className="text-xs text-gray-500">Zero-rated supplies</p>
                </div>
              </div>

              {/* Detailed Tables */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">B2B Supplies</h3>
                </div>
                <div className="p-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-semibold text-gray-700">Description</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">Taxable Value</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">IGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">CGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">B2B Invoices (with GSTIN)</td>
                        <td className="text-right py-3 text-sm text-gray-900 font-medium">
                          {formatCurrency(gstr1Data.b2b_taxable_value)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr1Data.b2b_igst_amount)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr1Data.b2b_cgst_amount)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr1Data.b2b_sgst_amount)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">B2C Large (&gt; ₹2.5L)</td>
                        <td className="text-right py-3 text-sm text-gray-900 font-medium">
                          {formatCurrency(gstr1Data.b2c_large_taxable_value)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-500" colSpan={3}>-</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">B2C Other</td>
                        <td className="text-right py-3 text-sm text-gray-900 font-medium">
                          {formatCurrency(gstr1Data.b2c_other_taxable_value)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-500" colSpan={3}>-</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">Exports (Zero-rated)</td>
                        <td className="text-right py-3 text-sm text-gray-900 font-medium">
                          {formatCurrency(gstr1Data.export_taxable_value)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-500" colSpan={3}>-</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="py-3 text-sm font-bold text-gray-900">Total</td>
                        <td className="text-right py-3 text-sm font-bold text-gray-900">
                          {formatCurrency(
                            gstr1Data.b2b_taxable_value +
                            gstr1Data.b2c_large_taxable_value +
                            gstr1Data.b2c_other_taxable_value +
                            gstr1Data.export_taxable_value
                          )}
                        </td>
                        <td className="text-right py-3 text-sm font-bold text-gray-900">
                          {formatCurrency(gstr1Data.b2b_igst_amount)}
                        </td>
                        <td className="text-right py-3 text-sm font-bold text-gray-900">
                          {formatCurrency(gstr1Data.b2b_cgst_amount)}
                        </td>
                        <td className="text-right py-3 text-sm font-bold text-gray-900">
                          {formatCurrency(gstr1Data.b2b_sgst_amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Download Options */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Export GSTR-1 Data</h4>
                    <p className="text-xs text-gray-600">Download for GST portal filing</p>
                  </div>
                  <div className="flex space-x-3">
                    <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center text-sm">
                      <Download size={16} className="mr-2" />
                      JSON
                    </button>
                    <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center text-sm">
                      <Download size={16} className="mr-2" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileBarChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No GSTR-1 Data</h3>
              <p className="text-gray-600 mb-6">Select a period and generate GSTR-1 report to view details</p>
            </div>
          )}
        </div>
      )}

      {/* GSTR-3B Tab */}
      {activeTab === 'gstr3b' && (
        <div>
          {gstr3bData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Outward Supplies</span>
                    <TrendingUp className="text-blue-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(gstr3bData.outward_taxable_supplies)}
                  </p>
                  <p className="text-xs text-gray-500">Taxable value</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">ITC Available</span>
                    <CheckCircle className="text-green-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(
                      gstr3bData.itc_igst_available +
                      gstr3bData.itc_cgst_available +
                      gstr3bData.itc_sgst_available
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Input tax credit</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Tax Payable</span>
                    <DollarSign className="text-purple-600" size={20} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(
                      gstr3bData.igst_payable +
                      gstr3bData.cgst_payable +
                      gstr3bData.sgst_payable
                    )}
                  </p>
                  <p className="text-xs text-gray-500">After ITC</p>
                </div>
              </div>

              {/* Table 3.1 - Outward Supplies */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Table 3.1 - Outward Supplies</h3>
                </div>
                <div className="p-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-semibold text-gray-700">Description</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">Taxable Value</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">IGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">CGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">3.1(a) Outward taxable supplies</td>
                        <td className="text-right py-3 text-sm text-gray-900 font-medium">
                          {formatCurrency(gstr3bData.outward_taxable_supplies)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.outward_igst)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.outward_cgst)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.outward_sgst)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 4 - ITC Details */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Table 4 - ITC Details</h3>
                </div>
                <div className="p-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-semibold text-gray-700">Description</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">IGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">CGST</th>
                        <th className="text-right py-3 text-sm font-semibold text-gray-700">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">4(A) ITC Available</td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.itc_igst_available)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.itc_cgst_available)}
                        </td>
                        <td className="text-right py-3 text-sm text-gray-900">
                          {formatCurrency(gstr3bData.itc_sgst_available)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">4(B) ITC Reversed</td>
                        <td className="text-right py-3 text-sm text-red-600">
                          ({formatCurrency(gstr3bData.itc_igst_reversed)})
                        </td>
                        <td className="text-right py-3 text-sm text-red-600">
                          ({formatCurrency(gstr3bData.itc_cgst_reversed)})
                        </td>
                        <td className="text-right py-3 text-sm text-red-600">
                          ({formatCurrency(gstr3bData.itc_sgst_reversed)})
                        </td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="py-3 text-sm font-bold text-gray-900">Net ITC</td>
                        <td className="text-right py-3 text-sm font-bold text-green-700">
                          {formatCurrency(gstr3bData.net_itc_igst)}
                        </td>
                        <td className="text-right py-3 text-sm font-bold text-green-700">
                          {formatCurrency(gstr3bData.net_itc_cgst)}
                        </td>
                        <td className="text-right py-3 text-sm font-bold text-green-700">
                          {formatCurrency(gstr3bData.net_itc_sgst)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 5 - Tax Payable */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Table 5 - Tax Payable</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">IGST Payable</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(gstr3bData.igst_payable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">CGST Payable</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(gstr3bData.cgst_payable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">SGST Payable</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(gstr3bData.sgst_payable)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-purple-300">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Total Tax Payable</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(
                        gstr3bData.igst_payable +
                        gstr3bData.cgst_payable +
                        gstr3bData.sgst_payable
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Options */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Export GSTR-3B Data</h4>
                    <p className="text-xs text-gray-600">Download for GST portal filing</p>
                  </div>
                  <div className="flex space-x-3">
                    <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center text-sm">
                      <Download size={16} className="mr-2" />
                      JSON
                    </button>
                    <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center text-sm">
                      <Download size={16} className="mr-2" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileBarChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No GSTR-3B Data</h3>
              <p className="text-gray-600 mb-6">Select a period and generate GSTR-3B return to view details</p>
            </div>
          )}
        </div>
      )}
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
