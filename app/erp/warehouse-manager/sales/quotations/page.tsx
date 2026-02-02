'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import ViewSalesQuotationModal from '@/components/modal/ViewSalesQuotationModal';
import React from 'react';
import { Send, Eye } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Quotation {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  status: string;
  totalAmount: string;
  customer: {
    name: string;
  };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [quotationDetails, setQuotationDetails] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const itemsPerPage = 15;
  const { showAlert, showConfirm } = useAlert();

  const toggleExpand = async (quotationId: string) => {
    if (expandedRow === quotationId) {
      setExpandedRow(null);
      setQuotationDetails(null);
    } else {
      setExpandedRow(quotationId);
      await fetchQuotationDetails(quotationId);
    }
  };

  const fetchQuotationDetails = async (quotationId: string) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/warehouse-manager/sales/quotations/${quotationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setQuotationDetails(data);
      }
    } catch (error) {
      console.error('Error fetching quotation details:', error);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchAllQuotationsForStats();
  }, [currentPage, searchTerm]);

  const fetchQuotations = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/warehouse-manager/sales/quotations?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQuotations(data.quotations || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllQuotationsForStats = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/warehouse-manager/sales/quotations?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllQuotations(data.quotations || []);
      }
    } catch (error) {
      console.error('Error fetching all quotations:', error);
    }
  };

  const handleSendQuotation = async (quotationId: string, quotationNumber: string) => {
    showConfirm({
      title: 'Send Quotation',
      message: `Send quotation ${quotationNumber} to customer via email?`,
      confirmText: 'Send',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setSending(quotationId);
        const token = getAuthToken();
        try {
          const response = await fetch(`/api/warehouse-manager/sales/quotations/${quotationId}/send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.emailSent) {
              showAlert({
                type: 'success',
                title: 'Quotation Sent!',
                message: `Quotation ${quotationNumber} sent successfully to customer via email! 📧`,
                duration: 6000,
              });
            } else {
              showAlert({
                type: 'warning',
                title: 'Quotation Status Updated',
                message: `Quotation marked as sent but email failed: ${data.emailError || 'Unknown error'}`,
                duration: 8000,
              });
            }
            fetchQuotations();
            fetchAllQuotationsForStats();
          } else {
            const data = await response.json();
            showAlert({
              type: 'error',
              title: 'Error',
              message: data.error || 'Failed to send quotation',
            });
          }
        } catch (error) {
          console.error('Error sending quotation:', error);
          showAlert({
            type: 'error',
            title: 'Error',
            message: 'Network error while sending quotation',
          });
        } finally {
          setSending(null);
        }
      },
    });
  };

  const handleViewQuotation = (quotationId: string) => {
    setSelectedQuotationId(quotationId);
    setShowViewModal(true);
  };

  const handleModalSuccess = () => {
    fetchQuotations();
    fetchAllQuotationsForStats();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
          <div className="text-gray-600">Loading quotations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer quotations and proposals</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total</div>
          <div className="text-3xl font-bold text-gray-900">{allQuotations.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Draft</div>
          <div className="text-3xl font-bold text-gray-600">
            {allQuotations.filter(q => q.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Sent</div>
          <div className="text-3xl font-bold text-blue-600">
            {allQuotations.filter(q => q.status === 'sent').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Accepted</div>
          <div className="text-3xl font-bold text-green-600">
            {allQuotations.filter(q => q.status === 'accepted').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Declined</div>
          <div className="text-3xl font-bold text-red-600">
            {allQuotations.filter(q => q.status === 'declined').length}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search quotations..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Quotation #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
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
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => (
                   <React.Fragment key={quotation.id}>
                    <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(quotation.id)}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{expandedRow === quotation.id ? '▼' : '▶'}</span>
                          {quotation.quotationNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {quotation.customer?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {new Date(quotation.quotationDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {new Date(quotation.validUntil).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        ₹{parseFloat(quotation.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(quotation.status)}`}>
                          {quotation.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewQuotation(quotation.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {quotation.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleSendQuotation(quotation.id, quotation.quotationNumber)}
                                disabled={sending === quotation.id}
                                className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 disabled:opacity-50"
                                title="Send to Customer"
                              >
                                {sending === quotation.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                          {(quotation.status === 'sent' || quotation.status === 'declined' || quotation.status === 'expired') && (
                            <button
                              onClick={() => handleSendQuotation(quotation.id, quotation.quotationNumber)}
                              disabled={sending === quotation.id}
                              className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 disabled:opacity-50"
                              title="Resend to Customer"
                            >
                              {sending === quotation.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                              ) : (
                                <>
                                  <Send className="w-4 h-4" />
                                  <span className="text-xs">Resend</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRow === quotation.id && quotationDetails && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <div className="text-xs text-gray-500">Terms & Conditions</div>
                                <div className="text-sm font-medium">{quotationDetails.terms || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Notes</div>
                                <div className="text-sm font-medium">{quotationDetails.notes || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Prepared By</div>
                                <div className="text-sm font-medium">{quotationDetails.preparedBy || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Created</div>
                                <div className="text-sm font-medium">{new Date(quotationDetails.createdAt).toLocaleString('en-IN')}</div>
                              </div>
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold">Product</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {quotationDetails.lines?.map((line: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-sm">{line.product?.name || 'N/A'}</td>
                                      <td className="px-4 py-2 text-sm text-right">{line.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-right">₹{parseFloat(line.unitPrice).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-right font-semibold">₹{(parseFloat(line.quantity) * parseFloat(line.unitPrice)).toFixed(2)}</td>
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

      {/* View Quotation Modal */}
      {selectedQuotationId && (
        <ViewSalesQuotationModal
          isOpen={showViewModal}
          quotationId={selectedQuotationId}
          onClose={() => {
            setShowViewModal(false);
            setSelectedQuotationId(null);
          }}
          onSuccess={handleModalSuccess}
          apiPrefix="/api/warehouse-manager/sales"
        />
      )}
    </div>
  );
}
