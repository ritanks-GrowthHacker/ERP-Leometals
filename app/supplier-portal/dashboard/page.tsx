'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAlert } from '@/components/common/CustomAlert';
import QuotationViewModal from '@/components/modal/QuotationViewModal';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SupplierData {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  profileImage: string | null;
}

export default function SupplierDashboard() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posLoading, setPosLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [expandedInvoiceRows, setExpandedInvoiceRows] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [showViewInvoiceModal, setShowViewInvoiceModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const invoicesPerPage = 10;
  const [receiptStatuses, setReceiptStatuses] = useState<Record<string, { hasReceipt: boolean; receiptId?: string }>>({});

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 4000);
    
    // Check authentication
    const token = localStorage.getItem('supplierToken');
    const supplierData = localStorage.getItem('supplierData');

    if (!token || !supplierData) {
      router.push('/supplier-portal');
      return;
    }

    setSupplier(JSON.parse(supplierData));
    fetchQuotations(token);
    fetchPurchaseOrders(token);
    fetchInvoices(token);
    
    return () => clearTimeout(timer);
  }, []);

  const fetchQuotations = async (token: string) => {
    try {
      const response = await fetch('/api/supplier-portal/quotations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setQuotations(data.quotations || []);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseOrders = async (token: string) => {
    try {
      setPosLoading(true);
      const response = await fetch('/api/supplier-portal/purchase-orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data.purchaseOrders || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setPosLoading(false);
    }
  };

  const fetchInvoices = async (token: string) => {
    try {
      setInvoicesLoading(true);
      const response = await fetch('/api/supplier-portal/invoices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        
        // Check receipt status for each paid invoice
        const receiptPromises = (data.invoices || [])
          .filter((inv: any) => inv.payment_status === 'paid')
          .map(async (inv: any) => {
            try {
              const receiptRes = await fetch(`/api/supplier-portal/invoices/${inv.id}/receipt-status`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (receiptRes.ok) {
                const receiptData = await receiptRes.json();
                return { invoiceId: inv.id, ...receiptData };
              }
            } catch (err) {
              console.error('Error checking receipt status:', err);
            }
            return { invoiceId: inv.id, hasReceipt: false };
          });
        
        const receiptResults = await Promise.all(receiptPromises);
        const receiptStatusMap: Record<string, { hasReceipt: boolean; receiptId?: string }> = {};
        receiptResults.forEach(result => {
          if (result) {
            receiptStatusMap[result.invoiceId] = {
              hasReceipt: result.hasReceipt,
              receiptId: result.receiptId
            };
          }
        });
        setReceiptStatuses(receiptStatusMap);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const toggleInvoiceRow = (id: string) => {
    if (expandedInvoiceRows === id) {
      setExpandedInvoiceRows(null);
    } else {
      setExpandedInvoiceRows(id);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      partially_paid: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleLogout = () => {
    localStorage.removeItem('supplierToken');
    localStorage.removeItem('supplierData');
    showAlert({ type: 'success', title: 'Success', message: 'Logged out successfully' });
    router.push('/supplier-portal');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className="mb-6"
              >
                <div className="w-28 h-28 bg-white rounded-3xl shadow-2xl flex items-center justify-center mx-auto">
                  <motion.span
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"
                  >
                    SP
                  </motion.span>
                </div>
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold text-white mb-2"
              >
                Supplier Portal
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-white/80 mb-6"
              >
                {supplier?.name || 'Loading...'}
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex justify-center gap-2"
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -15, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                    className="w-2.5 h-2.5 bg-white rounded-full"
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showLoader ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gray-50"
      >
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">SP</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Supplier Portal</h1>
                  <p className="text-xs text-gray-500">{supplier?.name} • {supplier?.code}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/supplier-portal/receipts"
                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm font-medium"
              >
                Receipts
              </Link>
              <Link
                href="/supplier-portal/profile"
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm font-medium"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Quotations</p>
                <p className="text-3xl font-bold text-gray-900">{quotations.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {quotations.filter(q => q.status === 'submitted' || q.status === 'under_review').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Accepted</p>
                <p className="text-3xl font-bold text-green-600">
                  {quotations.filter(q => q.status === 'accepted').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Rejected</p>
                <p className="text-3xl font-bold text-red-600">
                  {quotations.filter(q => q.status === 'rejected').length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/supplier-portal/rfqs"
              className="flex items-center gap-3 p-4 border-2 border-purple-600 rounded-lg hover:bg-purple-50 transition"
            >
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Received RFQs</p>
                <p className="text-sm text-gray-600">View & respond</p>
              </div>
            </Link>

            <Link
              href="/supplier-portal/submit-quotation"
              className="flex items-center gap-3 p-4 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition"
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Submit Quotation</p>
                <p className="text-sm text-gray-600">Upload quotation</p>
              </div>
            </Link>

            <Link
              href="/supplier-portal/invoices"
              className="flex items-center gap-3 p-4 border-2 border-green-600 rounded-lg hover:bg-green-50 transition"
            >
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Invoices</p>
                <p className="text-sm text-gray-600">Create & manage</p>
              </div>
            </Link>

            <Link
              href="/supplier-portal/profile"
              className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Profile</p>
                <p className="text-sm text-gray-600">Update info</p>
              </div>
            </Link>

            <button className="flex items-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Support</p>
                <p className="text-sm text-gray-600">Get help</p>
              </div>
            </button>
          </div>
        </div>

        {/* Purchase Orders Sent to Supplier */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Purchase Orders</h2>
            <p className="text-sm text-gray-500 mt-1">POs sent to you - Submit quotations against these</p>
          </div>
          <div className="overflow-x-auto">
            {posLoading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p>Loading purchase orders...</p>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">No purchase orders sent to you yet</p>
                <p className="text-sm text-gray-500">Purchase orders from the company will appear here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">PO Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Expected Delivery</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Quoted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseOrders.map((po: any) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{po.po_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(po.po_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{parseFloat(po.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          po.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {parseInt(po.quotation_count) > 0 ? (
                          <span className="text-green-600 font-medium">✓ Yes</span>
                        ) : (
                          <span className="text-gray-400">Not yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/supplier-portal/submit-quotation?po_id=${po.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {parseInt(po.quotation_count) > 0 ? 'Submit Another' : 'Submit Quotation'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Quotations */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Quotations</h2>
          </div>
          <div className="overflow-x-auto">
            {quotations.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">No quotations submitted yet</p>
                <Link
                  href="/supplier-portal/submit-quotation"
                  className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Submit Your First Quotation
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Submission #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">PO Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quotations.map((quotation) => (
                    <tr key={quotation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{quotation.submission_number || quotation.submissionNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(quotation.submission_date || quotation.submissionDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {quotation.po_number || quotation.poNumber ? (
                          <span className="font-medium text-blue-600">{quotation.po_number || quotation.poNumber}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                        {(quotation.quotation_type || quotation.quotationType || '').replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {(quotation.total_amount || quotation.totalAmount) ? `₹${parseFloat(quotation.total_amount || quotation.totalAmount).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(quotation.status)}`}>
                          {(quotation.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button 
                          onClick={() => {
                            setSelectedQuotation(quotation);
                            setShowQuotationModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Auto-Generated Invoices */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Auto-Generated Invoices</h2>
            <p className="text-sm text-gray-500 mt-1">Invoices automatically created from accepted quotations</p>
          </div>
          <div className="overflow-x-auto">
            {invoicesLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-gray-500 mt-4">Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600">No invoices generated yet</p>
                <p className="text-sm text-gray-500 mt-2">Invoices will appear here when quotations are accepted</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Quotation Ref</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.slice((invoicesPage - 1) * invoicesPerPage, invoicesPage * invoicesPerPage).map((invoice: any) => (
                      <React.Fragment key={invoice.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-blue-600">{invoice.invoice_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(invoice.invoice_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {invoice.quotation_number || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            ₹{parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getPaymentStatusColor(invoice.payment_status)}`}>
                              {invoice.payment_status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleInvoiceRow(invoice.id);
                              }}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1"
                            >
                              {expandedInvoiceRows === invoice.id ? 'Hide' : 'View'} Details
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  expandedInvoiceRows === invoice.id ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                        {expandedInvoiceRows === invoice.id && (
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-6 py-6">
                              <div className="space-y-4">
                                {/* Invoice Details Header */}
                                <div className="grid grid-cols-3 gap-4 border-b border-blue-200 pb-4">
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1">Invoice Number</div>
                                    <div className="font-semibold text-gray-900">{invoice.invoice_number}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1">Payment Terms</div>
                                    <div className="font-medium text-gray-900">{invoice.payment_terms || '-'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1">Currency</div>
                                    <div className="font-medium text-gray-900">{invoice.currency_code || 'INR'}</div>
                                  </div>
                                </div>

                                {/* Amount Breakdown */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Amount Breakdown</h4>
                                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-medium">₹{parseFloat(invoice.subtotal || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Tax Amount:</span>
                                        <span className="font-medium">₹{parseFloat(invoice.tax_amount || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping Charges:</span>
                                        <span className="font-medium">₹{parseFloat(invoice.shipping_charges || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Discount:</span>
                                        <span className="font-medium text-red-600">-₹{parseFloat(invoice.discount_amount || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                                        <span>Total Amount:</span>
                                        <span className="text-blue-600">₹{parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Notes */}
                                {invoice.notes && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                                    <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-blue-200">{invoice.notes}</p>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-4 border-t border-blue-200 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingInvoice(invoice);
                                      setShowViewInvoiceModal(true);
                                    }}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium"
                                  >
                                    View
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInvoice(invoice);
                                      setShowEditModal(true);
                                    }}
                                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-xs font-medium"
                                  >
                                    Edit
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('supplierToken');
                                        const response = await fetch(`/api/supplier-portal/invoices/${invoice.id}/send`, {
                                          method: 'POST',
                                          headers: { Authorization: `Bearer ${token}` },
                                        });
                                        if (response.ok) {
                                          showAlert({ type: 'success', title: 'Success', message: 'Invoice sent successfully!' });
                                          const updatedToken = localStorage.getItem('supplierToken');
                                          if (updatedToken) fetchInvoices(updatedToken);
                                        } else {
                                          const data = await response.json();
                                          showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to send invoice' });
                                        }
                                      } catch (error) {
                                        showAlert({ type: 'error', title: 'Error', message: 'Failed to send invoice' });
                                      }
                                    }}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-medium"
                                  >
                                    Send
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      try {
                                        const token = localStorage.getItem('supplierToken');
                                        const response = await fetch(`/api/supplier-portal/invoices?id=${invoice.id}`, {
                                          method: 'DELETE',
                                          headers: { Authorization: `Bearer ${token}` },
                                        });
                                        if (response.ok) {
                                          showAlert({ type: 'success', title: 'Success', message: 'Invoice deleted successfully!' });
                                          const updatedToken = localStorage.getItem('supplierToken');
                                          if (updatedToken) fetchInvoices(updatedToken);
                                        } else {
                                          const data = await response.json();
                                          showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to delete invoice' });
                                        }
                                      } catch (error) {
                                        showAlert({ type: 'error', title: 'Error', message: 'Failed to delete invoice' });
                                      }
                                    }}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-xs font-medium"
                                  >
                                    Delete
                                  </button>
                                  
                                  {invoice.invoice_file_url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = invoice.invoice_file_url;
                                        link.download = invoice.invoice_file_name || 'invoice';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs font-medium"
                                    >
                                      Download
                                    </button>
                                  )}
                                  
                                  {/* Generate/Download Receipt Button for Paid Invoices */}
                                  {invoice.payment_status === 'paid' && (
                                    receiptStatuses[invoice.id]?.hasReceipt ? (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const receiptId = receiptStatuses[invoice.id]?.receiptId;
                                            if (receiptId) {
                                              const token = localStorage.getItem('supplierToken');
                                              const response = await fetch(`/api/supplier-portal/receipts/${receiptId}/download`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                              });
                                              
                                              if (response.ok) {
                                                const blob = await response.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `Receipt_${receiptId}.html`;
                                                document.body.appendChild(a);
                                                a.click();
                                                window.URL.revokeObjectURL(url);
                                                document.body.removeChild(a);
                                                showAlert({ type: 'success', title: 'Success', message: 'Receipt downloaded successfully!' });
                                              } else {
                                                showAlert({ type: 'error', title: 'Error', message: 'Failed to download receipt' });
                                              }
                                            }
                                          } catch (error) {
                                            showAlert({ type: 'error', title: 'Error', message: 'Failed to download receipt' });
                                          }
                                        }}
                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium"
                                      >
                                        Download Receipt
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const token = localStorage.getItem('supplierToken');
                                            const response = await fetch(`/api/supplier-portal/invoices/${invoice.id}/generate-receipt`, {
                                              method: 'POST',
                                              headers: { 
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                              },
                                              body: JSON.stringify({
                                                payment_method: 'bank_transfer',
                                                notes: 'Receipt generated from supplier portal'
                                              })
                                            });
                                            
                                            if (response.ok) {
                                              const data = await response.json();
                                              showAlert({ type: 'success', title: 'Success', message: 'Receipt generated successfully!' });
                                              
                                              // Update receipt status
                                              setReceiptStatuses(prev => ({
                                                ...prev,
                                                [invoice.id]: {
                                                  hasReceipt: true,
                                                  receiptId: data.receipt.id
                                                }
                                              }));
                                              
                                              // Refresh invoices to update counts
                                              const updatedToken = localStorage.getItem('supplierToken');
                                              if (updatedToken) fetchInvoices(updatedToken);
                                            } else {
                                              const data = await response.json();
                                              showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to generate receipt' });
                                            }
                                          } catch (error) {
                                            console.error('Error generating receipt:', error);
                                            showAlert({ type: 'error', title: 'Error', message: 'Failed to generate receipt' });
                                          }
                                        }}
                                        className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-xs font-medium"
                                      >
                                        Generate Receipt
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {invoices.length > invoicesPerPage && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((invoicesPage - 1) * invoicesPerPage) + 1} to {Math.min(invoicesPage * invoicesPerPage, invoices.length)} of {invoices.length} invoices
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInvoicesPage(p => Math.max(1, p - 1))}
                        disabled={invoicesPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.ceil(invoices.length / invoicesPerPage) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setInvoicesPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            page === invoicesPage
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setInvoicesPage(p => Math.min(Math.ceil(invoices.length / invoicesPerPage), p + 1))}
                        disabled={invoicesPage >= Math.ceil(invoices.length / invoicesPerPage)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Quotation View Modal */}
      {selectedQuotation && (
        <QuotationViewModal
          isOpen={showQuotationModal}
          quotation={{
            id: selectedQuotation.id,
            submission_number: selectedQuotation.submissionNumber,
            submission_date: selectedQuotation.submissionDate,
            valid_until: selectedQuotation.validUntil,
            status: selectedQuotation.status,
            total_amount: selectedQuotation.totalAmount,
            delivery_time_in_days: selectedQuotation.deliveryTimeInDays,
            supplier_name: supplier?.name || '',
            supplier_code: supplier?.code || '',
            rfq_number: selectedQuotation.rfqNumber,
            rfq_title: selectedQuotation.rfqTitle,
            quotation_type: selectedQuotation.quotationType,
            file_url: selectedQuotation.fileUrl,
            file_name: selectedQuotation.fileName,
            payment_terms: selectedQuotation.paymentTerms,
            notes: selectedQuotation.notes,
          }}
          onClose={() => {
            setShowQuotationModal(false);
            setSelectedQuotation(null);
          }}
          showActions={false}
        />
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && editingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Edit Invoice</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  const token = localStorage.getItem('supplierToken');
                  const response = await fetch(`/api/supplier-portal/invoices/${editingInvoice.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      dueDate: formData.get('dueDate'),
                      subtotal: parseFloat(formData.get('subtotal') as string),
                      taxAmount: parseFloat(formData.get('taxAmount') as string || '0'),
                      shippingCharges: parseFloat(formData.get('shippingCharges') as string || '0'),
                      discountAmount: parseFloat(formData.get('discountAmount') as string || '0'),
                      notes: formData.get('notes'),
                    }),
                  });

                  if (response.ok) {
                    showAlert({ type: 'success', title: 'Success', message: 'Invoice updated successfully!' });
                    setShowEditModal(false);
                    setEditingInvoice(null);
                    if (token) fetchInvoices(token);
                  } else {
                    const data = await response.json();
                    showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to update invoice' });
                  }
                } catch (error) {
                  showAlert({ type: 'error', title: 'Error', message: 'Failed to update invoice' });
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    defaultValue={editingInvoice.due_date?.split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                  <input
                    type="number"
                    name="subtotal"
                    step="0.01"
                    defaultValue={editingInvoice.subtotal}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
                  <input
                    type="number"
                    name="taxAmount"
                    step="0.01"
                    defaultValue={editingInvoice.tax_amount || 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Charges</label>
                  <input
                    type="number"
                    name="shippingCharges"
                    step="0.01"
                    defaultValue={editingInvoice.shipping_charges || 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount</label>
                  <input
                    type="number"
                    name="discountAmount"
                    step="0.01"
                    defaultValue={editingInvoice.discount_amount || 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingInvoice.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingInvoice(null);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Update Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewInvoiceModal && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
                  <p className="text-sm text-gray-600 mt-1">{viewingInvoice.invoice_number}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewInvoiceModal(false);
                    setViewingInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Invoice Date</p>
                  <p className="font-medium">{new Date(viewingInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="font-medium">{new Date(viewingInvoice.due_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getPaymentStatusColor(viewingInvoice.payment_status)}`}>
                    {viewingInvoice.payment_status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Source</p>
                  <p className="font-medium">{viewingInvoice.source === 'auto' ? 'Auto-Generated' : 'Manual'}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold mb-3">Financial Breakdown</h3>
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{parseFloat(viewingInvoice.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">₹{parseFloat(viewingInvoice.tax_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-medium">₹{parseFloat(viewingInvoice.shipping_charges || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-red-600">-₹{parseFloat(viewingInvoice.discount_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">Total Amount:</span>
                    <span className="font-bold text-lg">₹{parseFloat(viewingInvoice.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {viewingInvoice.notes && (
                <div>
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="text-sm mt-1 bg-gray-50 p-3 rounded-lg">{viewingInvoice.notes}</p>
                </div>
              )}

              {viewingInvoice.invoice_file_url && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Attached Invoice</p>
                  <a
                    href={viewingInvoice.invoice_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    📎 {viewingInvoice.invoice_file_name || 'View Invoice File'}
                  </a>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowViewInvoiceModal(false);
                  setViewingInvoice(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </motion.div>
    </>
  );
}
