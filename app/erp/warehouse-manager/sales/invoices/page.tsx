'use client';

import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import SalesInvoiceViewModal from '@/components/modal/SalesInvoiceViewModal';
import { useAlert } from '@/components/common/CustomAlert';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  customer: {
    name: string;
  };
}

export default function InvoicesPage() {
  const { showAlert } = useAlert();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const itemsPerPage = 15;

  const toggleExpand = async (invoiceId: string) => {
    if (expandedRow === invoiceId) {
      setExpandedRow(null);
      setInvoiceDetails(null);
    } else {
      setExpandedRow(invoiceId);
      await fetchInvoiceDetails(invoiceId);
    }
  };

  const fetchInvoiceDetails = async (invoiceId: string) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/warehouse-manager/sales/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInvoiceDetails(data);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchInvoices = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/warehouse-manager/sales/invoices?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}&status=${statusFilter}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const calculateBalance = (total: string, paid: string) => {
    return (parseFloat(total) - parseFloat(paid || '0')).toFixed(2);
  };

  const handleViewInvoice = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/warehouse-manager/sales/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedInvoice(data);
        setShowViewModal(true);
      } else {
        console.error('Failed to fetch invoice:', await response.text());
        showAlert({ type: 'error', title: 'Error', message: 'Failed to load invoice details' });
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Error loading invoice details' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
          <div className="text-gray-600">Loading invoices...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer invoices and payments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total</div>
          <div className="text-3xl font-bold text-gray-900">{invoices.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Paid</div>
          <div className="text-3xl font-bold text-green-600">
            {invoices.filter(i => i.status === 'paid').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Partial</div>
          <div className="text-3xl font-bold text-yellow-600">
            {invoices.filter(i => i.status === 'partial').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Overdue</div>
          <div className="text-3xl font-bold text-red-600">
            {invoices.filter(i => i.status === 'overdue').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Value</div>
          <div className="text-2xl font-bold text-blue-600">
            ₹{invoices.reduce((sum, i) => sum + parseFloat(i.totalAmount || '0'), 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <React.Fragment key={invoice.id}>
                    <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(invoice.id)}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{expandedRow === invoice.id ? '▼' : '▶'}</span>
                          {invoice.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {invoice.customer?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        ₹{parseFloat(invoice.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                        ₹{parseFloat(invoice.paidAmount || '0').toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-red-600 font-medium">
                        ₹{parseFloat(calculateBalance(invoice.totalAmount, invoice.paidAmount)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={(e) => handleViewInvoice(invoice.id, e)}
                          className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                    {expandedRow === invoice.id && invoiceDetails && (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <div className="text-xs text-gray-500">Payment Terms</div>
                                <div className="text-sm font-medium">{invoiceDetails.paymentTerms || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Notes</div>
                                <div className="text-sm font-medium">{invoiceDetails.notes || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Reference</div>
                                <div className="text-sm font-medium">{invoiceDetails.reference || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Created</div>
                                <div className="text-sm font-medium">{new Date(invoiceDetails.createdAt).toLocaleString('en-IN')}</div>
                              </div>
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold">Product</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Tax</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {invoiceDetails.lines?.map((line: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-sm">{line.product?.name || 'N/A'}</td>
                                      <td className="px-4 py-2 text-sm text-right">{line.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-right">₹{parseFloat(line.unitPrice).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-right">{line.taxRate || 0}%</td>
                                      <td className="px-4 py-2 text-sm text-right font-semibold">
                                        ₹{(parseFloat(line.quantity) * parseFloat(line.unitPrice) * (1 + parseFloat(line.taxRate || 0) / 100)).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      <SalesInvoiceViewModal
        isOpen={showViewModal}
        invoice={selectedInvoice}
        onClose={() => {
          setShowViewModal(false);
          setSelectedInvoice(null);
        }}
        onEdit={() => {
          setShowViewModal(false);
        }}
        onUpdate={() => {
          fetchInvoices();
        }}
      />
    </div>
  );
}
