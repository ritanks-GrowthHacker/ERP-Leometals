'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import Link from 'next/link';
import Lottie from 'lottie-react';
import purchasingAnimation from '@/lib/lottie/purchasing.json';

export default function PurchasingDashboard() {
  const [showLoader, setShowLoader] = useState(true);
  const [stats, setStats] = useState({
    rfqs: { total: 0, pending: 0, quoted: 0 },
    quotations: { total: 0, pending: 0, accepted: 0, rejected: 0 },
    purchaseOrders: { total: 0, draft: 0, confirmed: 0, received: 0 },
    invoices: { total: 0, pending: 0, approved: 0, paid: 0, overdue: 0 },
    receipts: { total: 0, received: 0, accepted: 0 },
    suppliers: { total: 0, active: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      // Fetch stats from unified endpoint
      const response = await fetch('/api/erp/purchasing/stats', { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      {showLoader && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
          <div className="w-96 h-96">
            <Lottie animationData={purchasingAnimation} loop={true} />
          </div>
        </div>
      )}

      <div style={{ opacity: showLoader ? 0 : 1, transition: 'opacity 0.5s' }}>
        <div>
          {/* Page Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Purchasing Dashboard</h2>
            <p className="text-sm text-gray-500">Manage purchase orders, supplier invoices, and goods receipts</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Link href="/erp/purchasing/rfq" className="block">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">RFQs</span>
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.rfqs.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.rfqs.pending} pending</p>
          </div>
        </Link>

        <Link href="/erp/purchasing/quotations" className="block">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Quotations</span>
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.quotations.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.quotations.accepted} accepted</p>
          </div>
        </Link>

        <Link href="/erp/purchasing/orders" className="block">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Purchase Orders</span>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.purchaseOrders.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.purchaseOrders.confirmed} confirmed</p>
          </div>
        </Link>

        <Link href="/erp/purchasing/invoices" className="block">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Vendor Invoices</span>
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.invoices.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.invoices.pending} pending</p>
          </div>
        </Link>

        <Link href="/erp/purchasing/goods-receipts" className="block">
          <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Goods Receipts</span>
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.receipts.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.receipts.accepted} accepted</p>
          </div>
        </Link>

        <Link href="/erp/purchasing/suppliers" className="block">
          <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-xl p-5 border border-transparent hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-100">Active Suppliers</span>
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '...' : stats.suppliers.active}</p>
            <p className="text-xs text-purple-100 mt-1">of {stats.suppliers.total} total</p>
          </div>
        </Link>
      </div>

      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Purchase Orders Summary */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Purchase Orders Overview</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-700">Draft</span>
                </div>
                <span className="font-semibold text-gray-900">{stats.purchaseOrders.draft}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Confirmed</span>
                </div>
                <span className="font-semibold text-gray-900">{stats.purchaseOrders.confirmed}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Received</span>
                </div>
                <span className="font-semibold text-gray-900">{stats.purchaseOrders.received}</span>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Link href="/erp/purchasing/orders">
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    View All Orders
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices Summary */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Invoices Overview</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Pending</span>
                </div>
                <span className="font-semibold text-gray-900">{stats.invoices.pending}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Approved</span>
                </div>
                <span className="font-semibold text-gray-900">{stats.invoices.approved}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Overdue</span>
                </div>
                <span className="font-semibold text-red-600">{stats.invoices.overdue}</span>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Link href="/erp/purchasing/invoices">
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    View All Invoices
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/erp/purchasing/rfq">
              <button className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-blue-300 transition-all">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span className="text-sm font-medium text-gray-900">Create RFQ</span>
              </button>
            </Link>

            <Link href="/erp/purchasing/orders">
              <button className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-all">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm font-medium text-white">Create Purchase Order</span>
              </button>
            </Link>
            
            <Link href="/erp/purchasing/goods-receipts">
              <button className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-blue-300 transition-all">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-sm font-medium text-gray-900">Receive Goods</span>
              </button>
            </Link>
            
            <Link href="/erp/purchasing/invoices">
              <button className="w-full h-20 flex flex-col items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-blue-300 transition-all">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">Record Invoice</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}
