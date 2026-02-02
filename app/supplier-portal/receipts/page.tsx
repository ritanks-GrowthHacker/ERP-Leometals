'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAlert } from '@/components/common/CustomAlert';
import { FileText, Download, Calendar, DollarSign, CreditCard, ChevronLeft } from 'lucide-react';

interface Receipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  amount: string;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  notes: string | null;
  downloaded_at: string | null;
  created_at: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: string;
  organization_name: string;
}

export default function SupplierReceiptsPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('supplierToken');
    if (!token) {
      router.push('/supplier-portal');
      return;
    }

    fetchReceipts(token);
  }, [currentPage, statusFilter]);

  const fetchReceipts = async (token: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/supplier-portal/receipts?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReceipts(data.receipts || []);
        setTotalPages(data.pagination.totalPages);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch receipts' });
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch receipts' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (receiptId: string, receiptNumber: string) => {
    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch(`/api/supplier-portal/receipts/${receiptId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receipt_${receiptNumber}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showAlert({ type: 'success', title: 'Success', message: `Receipt ${receiptNumber} downloaded successfully!` });
        
        // Refresh receipts to update download status
        const updatedToken = localStorage.getItem('supplierToken');
        if (updatedToken) fetchReceipts(updatedToken);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to download receipt' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to download receipt' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      generated: 'bg-blue-100 text-blue-800',
      sent: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-green-100 text-green-800',
      downloaded: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading && receipts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/supplier-portal/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Receipts</h1>
                <p className="text-sm text-gray-500">View and download all your payment receipts</p>
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="generated">Generated</option>
              <option value="sent">Sent</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="downloaded">Downloaded</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {receipts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Receipts Found</h3>
            <p className="text-gray-600">
              {statusFilter 
                ? `No receipts with status "${statusFilter}" found.`
                : 'You don\'t have any payment receipts yet. Receipts will appear here once invoices are marked as paid.'}
            </p>
          </div>
        ) : (
          <>
            {/* Receipts Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-linear-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Receipt No.
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {receipts.map((receipt) => (
                      <React.Fragment key={receipt.id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="font-mono text-sm font-medium text-gray-900">
                                {receipt.receipt_number}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900 font-medium">
                              {receipt.invoice_number}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-900">{receipt.organization_name}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-green-600">
                              ₹{parseFloat(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {new Date(receipt.receipt_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <CreditCard className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900 capitalize">
                                {receipt.payment_method?.replace('_', ' ') || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(receipt.status)}`}>
                              {receipt.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleDownloadReceipt(receipt.id, receipt.receipt_number)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          </td>
                        </tr>
                        {(receipt.payment_reference || receipt.notes || receipt.downloaded_at) && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-6 py-3">
                              <div className="text-sm space-y-1">
                                {receipt.payment_reference && (
                                  <p className="text-gray-600">
                                    <span className="font-semibold">Reference:</span> {receipt.payment_reference}
                                  </p>
                                )}
                                {receipt.notes && (
                                  <p className="text-gray-600">
                                    <span className="font-semibold">Notes:</span> {receipt.notes}
                                  </p>
                                )}
                                {receipt.downloaded_at && (
                                  <p className="text-gray-500 text-xs">
                                    Last downloaded: {new Date(receipt.downloaded_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}

            {/* Summary Stats */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-600 mb-1">Total Receipts</p>
                <p className="text-3xl font-bold text-gray-900">{receipts.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-green-600">
                  ₹{receipts.reduce((sum, r) => sum + parseFloat(r.amount), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-600 mb-1">Downloaded</p>
                <p className="text-3xl font-bold text-purple-600">
                  {receipts.filter(r => r.downloaded_at).length}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
