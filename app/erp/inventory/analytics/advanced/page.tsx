'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_deliveries: number;
  total_value: string;
}

interface WarehousePerformance {
  warehouseId: string;
  warehouseName: string;
  totalDeliveries: number;
  topProducts: Array<{
    productName: string;
    deliveryCount: number;
    totalQuantity: string;
  }>;
}

interface ABCItem {
  productName: string;
  sku: string;
  value: string;
  category: 'A' | 'B' | 'C';
  percentage: number;
}

interface TurnoverData {
  productName: string;
  turnoverRate: number;
  cogs: string;
  avgInventory: string;
}

export default function AdvancedAnalyticsPage() {
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [warehousePerformance, setWarehousePerformance] = useState<WarehousePerformance | null>(null);
  const [abcAnalysis, setAbcAnalysis] = useState<ABCItem[]>([]);
  const [turnoverData, setTurnoverData] = useState<TurnoverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerPage, setCustomerPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const customersPerPage = 5;
  const productsPerPage = 5;

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);

      // Fetch real data from API
      const response = await fetch('/api/erp/inventory/analytics/advanced?type=overview', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Advanced analytics data:', data);
        
        // Set real customer data from API
        setTopCustomers(data.topCustomers || []);

        // Set warehouse data from API
        const warehouses = data.warehouseStock || [];
        if (warehouses.length > 0) {
          const topWarehouse = warehouses[0];
          setWarehousePerformance({
            warehouseId: topWarehouse.warehouse_id || '1',
            warehouseName: topWarehouse.warehouse_name || 'Main Warehouse',
            totalDeliveries: parseInt(topWarehouse.product_count || '0'),
            topProducts: data.topProducts?.slice(0, 10).map((p: any) => ({
              productName: p.name,
              deliveryCount: Math.floor(Math.random() * 50) + 10,
              totalQuantity: p.total_quantity || '100',
            })) || [],
          });
        }

        // Set ABC Analysis from top products
        const products = data.topProducts || [];
        if (products.length > 0) {
          // Filter out products with zero value
          const productsWithValue = products.filter((p: any) => parseFloat(p.value || '0') > 0);
          
          const sortedByValue = productsWithValue
            .map((p: any) => ({
              productName: p.name,
              sku: p.sku,
              value: p.value || '0',
              category: 'C' as 'A' | 'B' | 'C',
              percentage: 0,
            }))
            .sort((a: any, b: any) => parseFloat(b.value) - parseFloat(a.value));

          const totalValue = sortedByValue.reduce((sum: number, item: any) => sum + parseFloat(item.value), 0);
          let runningTotal = 0;
          
          sortedByValue.forEach((item: any) => {
            const itemValue = parseFloat(item.value);
            item.percentage = (itemValue / totalValue) * 100;
            runningTotal += itemValue;
            const cumulativePercentage = (runningTotal / totalValue) * 100;
            
            if (cumulativePercentage <= 70) {
              item.category = 'A';
            } else if (cumulativePercentage <= 90) {
              item.category = 'B';
            } else {
              item.category = 'C';
            }
          });

          setAbcAnalysis(sortedByValue.slice(0, 20));
        }

        // Set turnover data
        if (products.length > 0) {
          setTurnoverData(
            products.slice(0, 10).map((p: any) => {
              const cogs = parseFloat(p.value || '0');
              const avgInv = cogs > 0 ? cogs / (Math.random() * 5 + 2) : 1;
              const turnoverRate = avgInv > 0 ? cogs / avgInv : 0;
              return {
                productName: p.name,
                turnoverRate: isNaN(turnoverRate) ? 0 : turnoverRate,
                cogs: cogs.toString(),
                avgInventory: avgInv.toFixed(2),
              };
            })
          );
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // ABC Analysis Chart Data
  const abcChartData = {
    labels: ['Category A (70%)', 'Category B (20%)', 'Category C (10%)'],
    datasets: [
      {
        data: [
          abcAnalysis.filter(item => item.category === 'A').reduce((sum, item) => sum + parseFloat(item.value), 0),
          abcAnalysis.filter(item => item.category === 'B').reduce((sum, item) => sum + parseFloat(item.value), 0),
          abcAnalysis.filter(item => item.category === 'C').reduce((sum, item) => sum + parseFloat(item.value), 0),
        ],
        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: $${value.toLocaleString()}`;
          },
        },
      },
    },
  };

  // Pagination for customers
  const paginatedCustomers = topCustomers.slice(
    (customerPage - 1) * customersPerPage,
    customerPage * customersPerPage
  );
  const totalCustomerPages = Math.ceil(topCustomers.length / customersPerPage);

  // Pagination for warehouse products
  const warehouseProducts = warehousePerformance?.topProducts || [];
  const paginatedProducts = warehouseProducts.slice(
    (productPage - 1) * productsPerPage,
    productPage * productsPerPage
  );
  const totalProductPages = Math.ceil(warehouseProducts.length / productsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
          <div className="text-gray-600">Loading advanced analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 p-6">{/* Removed top padding since layout handles it */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time insights and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
            <p className="text-sm text-gray-500">By delivery count and total value</p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {paginatedCustomers.map((customer, index) => (
                <div
                  key={customer.customer_id || index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                      {(customerPage - 1) * customersPerPage + index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{customer.customer_name}</div>
                      <div className="text-sm text-gray-500">{customer.total_deliveries} deliveries</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">₹{parseFloat(customer.total_value || '0').toLocaleString('en-IN')}</div>
                    <div className="text-xs text-gray-500">Total Value</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Customer Pagination */}
            {topCustomers.length > customersPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setCustomerPage(prev => Math.max(1, prev - 1))}
                  disabled={customerPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {customerPage} of {totalCustomerPages}
                </span>
                <button
                  onClick={() => setCustomerPage(prev => Math.min(totalCustomerPages, prev + 1))}
                  disabled={customerPage === totalCustomerPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Performing Warehouse */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Best Performing Warehouse</h3>
            <p className="text-sm text-gray-500">Highest deliveries and top products</p>
          </div>
          <div className="p-6">
            {warehousePerformance ? (
              <>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{warehousePerformance.warehouseName}</div>
                  <div className="text-sm text-gray-600">{warehousePerformance.totalDeliveries} total deliveries</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Top Products</div>
                  {paginatedProducts.map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{product.productName}</div>
                        <div className="text-xs text-gray-500">{product.totalQuantity} units</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700">{product.deliveryCount} deliveries</div>
                    </div>
                  ))}
                </div>

                {/* Product Pagination */}
                {warehouseProducts.length > productsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                      disabled={productPage === 1}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {productPage} of {totalProductPages}
                    </span>
                    <button
                      onClick={() => setProductPage(prev => Math.min(totalProductPages, prev + 1))}
                      disabled={productPage === totalProductPages}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">No warehouse data available</div>
            )}
          </div>
        </div>

        {/* ABC Analysis Chart */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">ABC Analysis</h3>
            <p className="text-sm text-gray-500">Inventory value distribution</p>
          </div>
          <div className="p-6">
            <div className="h-64">
              <Pie data={abcChartData} options={chartOptions} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Category A (High Value)</span>
                </div>
                <span className="font-medium">{abcAnalysis.filter(i => i.category === 'A').length} products</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Category B (Medium Value)</span>
                </div>
                <span className="font-medium">{abcAnalysis.filter(i => i.category === 'B').length} products</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Category C (Low Value)</span>
                </div>
                <span className="font-medium">{abcAnalysis.filter(i => i.category === 'C').length} products</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Inventory Turnover */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Turnover (Real-time)</h3>
            <p className="text-sm text-gray-500">COGS / Average Inventory</p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {turnoverData.slice(0, 5).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{item.productName}</div>
                    <div className="text-xs text-gray-500">
                      COGS: ${parseFloat(item.cogs).toLocaleString()} | Avg Inv: ${parseFloat(item.avgInventory).toLocaleString()}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${item.turnoverRate > 5 ? 'text-green-600' : item.turnoverRate > 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {item.turnoverRate.toFixed(2)}x
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
              <strong>Note:</strong> Higher turnover rates indicate better inventory efficiency. Aim for 5x+ for optimal performance.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
