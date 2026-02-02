'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { getAuthToken } from '@/lib/utils/token';
import Lottie from 'lottie-react';
import loadingAnimation from '@/lib/lottie/Loading_car.json';
import salesAnimation from '@/lib/lottie/sales.json';
import purchasingAnimation from '@/lib/lottie/purchasing.json';
import manufacturingAnimation from '@/lib/lottie/Manufacturing.json';
import inventoryAnimation from '@/lib/lottie/inventory.json';
import reportsAnimation from '@/lib/lottie/reports.json';
import settingsAnimation from '@/lib/lottie/settings.json';
import financeAnimation from '@/lib/lottie/finance.json';
import RestockModal from '@/components/modal/RestockModal';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockItems: 0,
    pendingOrders: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState(0);
  const [pendingSOs, setPendingSOs] = useState(0);
  const [manufacturingJobs, setManufacturingJobs] = useState(0);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    // Show loader for 5 seconds
    const loaderTimer = setTimeout(() => {
      setShowLoader(false);
    }, 5000);

    fetchDashboardData();

    return () => clearTimeout(loaderTimer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = getAuthToken();
      
      // Fetch products for stock levels
      const productsResponse = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let products = [];
      let lowStock = 0;
      let lowStockItems: any[] = [];
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        products = productsData.products || [];
        // Calculate low stock items - products with available quantity less than reorder point
        lowStockItems = products.filter((p: any) => {
          const availableQty = parseInt(p.availableQuantity || 0);
          const reorderPoint = parseInt(p.reorderPoint || 0);
          return reorderPoint > 0 && availableQty <= reorderPoint;
        });
        lowStock = lowStockItems.length;
        setLowStockProducts(lowStockItems);
      }

      // Fetch purchase orders
      const poResponse = await fetch('/api/erp/purchasing/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      let pendingPOsCount = 0;
      let totalPOs = 0;
      if (poResponse.ok) {
        const poData = await poResponse.json();
        const pos = poData.purchaseOrders || [];
        totalPOs = pos.length;
        pendingPOsCount = pos.filter((po: any) => po.status === 'draft' || po.status === 'confirmed').length;
        setPendingPOs(totalPOs);
      }

      // Fetch sales orders
      const soResponse = await fetch('/api/erp/sales/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      let pendingSOsCount = 0;
      let totalSOs = 0;
      if (soResponse.ok) {
        const soData = await soResponse.json();
        const sos = soData.orders || [];
        totalSOs = sos.length;
        pendingSOsCount = sos.filter((so: any) => so.status === 'draft' || so.status === 'confirmed').length;
        setPendingSOs(totalSOs);
      }

      // Fetch manufacturing orders
      const moResponse = await fetch('/api/erp/manufacturing/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      let manufacturingJobsCount = 0;
      if (moResponse.ok) {
        const moData = await moResponse.json();
        const mos = moData.orders || [];
        manufacturingJobsCount = mos.filter((mo: any) => mo.status === 'draft' || mo.status === 'confirmed' || mo.status === 'in_progress').length;
        setManufacturingJobs(manufacturingJobsCount);
      }
      
      setStats({
        totalProducts: products.length,
        activeProducts: products.filter((p: any) => p.isActive).length,
        lowStockItems: lowStock,
        pendingOrders: pendingPOsCount + pendingSOsCount,
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  return (
    <>
      {showLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="w-[600px] h-[600px]">
            <Lottie 
              animationData={loadingAnimation} 
              loop={true}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}

      <div className="p-6">
      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h2>
        <p className="text-sm text-gray-500">Overview of your business operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Total Products</span>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Icons.Inventory className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.totalProducts}
          </p>
          <p className="text-xs text-gray-500">Total items in inventory</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Active Products</span>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Icons.CheckCircle className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.activeProducts}
          </p>
          <p className="text-xs text-gray-500">Currently available</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Pending Orders</span>
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Icons.Shopping className="text-orange-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.pendingOrders}
          </p>
          <p className="text-xs text-gray-500">Awaiting processing</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Low Stock Items</span>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <Icons.Alert className="text-red-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.lowStockItems}
          </p>
          <p className="text-xs text-gray-500">Need reordering</p>
        </div>
      </div>

      {/* Quick Access Modules */}
    <div className="mb-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
    <Link href="/erp/inventory">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={inventoryAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Inventory</h4>
            <p className="text-xs text-gray-500">{stats.totalProducts} products</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/purchasing">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={purchasingAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Purchasing</h4>
            <p className="text-xs text-gray-500">{pendingPOs} orders</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/sales/orders">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={salesAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Sales</h4>
            <p className="text-xs text-gray-500">{pendingSOs} orders</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/manufacturing">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={manufacturingAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Manufacturing</h4>
            <p className="text-xs text-gray-500">{manufacturingJobs} jobs</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/finance">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={financeAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Finance</h4>
            <p className="text-xs text-gray-500">Billing & AR/AP</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/reports">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={reportsAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Reports</h4>
            <p className="text-xs text-gray-500">Analytics</p>
          </div>
        </div>
      </div>
    </Link>

    <Link href="/erp/settings">
      <div className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24">
            <Lottie animationData={settingsAnimation} loop={true} />
          </div>
          <div className="text-center mt-2">
            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">Settings</h4>
            <p className="text-xs text-gray-500">Configure</p>
          </div>
        </div>
      </div>
    </Link>
  </div>
</div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Recent Activities</h3>
          </div>
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Info className="text-gray-400" size={28} />
            </div>
            <p className="text-gray-600 font-medium">No recent activities</p>
            <p className="text-sm text-gray-500 mt-1">Start using the system to see activity here</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Alerts & Notifications</h3>
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {lowStockProducts.slice(0, 5).map((product: any) => (
                <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h4>
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full whitespace-nowrap">Low Stock</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-red-600 font-medium">Available: {product.availableQuantity || 0}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">Min value: {product.reorderPoint || 0}</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedProduct({
                              id: product.id,
                              name: product.name,
                              sku: product.sku,
                              warehouseId: product.warehouseId,
                              warehouseName: product.warehouseName,
                              availableQuantity: product.availableQuantity || 0,
                              reorderPoint: product.reorderPoint || 0,
                            });
                            setShowRestockModal(true);
                          }}
                          className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {lowStockProducts.length > 5 && (
                <div className="p-3 bg-gray-50 text-center">
                  <Link href="/erp/inventory/products" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View all {lowStockProducts.length} low stock items →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">All clear!</p>
              <p className="text-sm text-gray-500 mt-1">No alerts or notifications at the moment</p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Restock Modal */}
      {selectedProduct && (
        <RestockModal
          isOpen={showRestockModal}
          onClose={() => {
            setShowRestockModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSuccess={() => {
            fetchDashboardData();
          }}
        />
      )}
    </>
  );
}
