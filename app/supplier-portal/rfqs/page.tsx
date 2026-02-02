'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAlert } from '@/components/common/CustomAlert';
import { ChevronDown, ChevronUp, FileText, CheckCircle, XCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface RFQ {
  rfq_supplier_id: string;
  rfq_id: string;
  rfq_number: string;
  rfq_date: string;
  deadline_date: string;
  title: string;
  description: string;
  rfq_status: string;
  response_status: string;
  product_count: number;
  has_quotation: boolean;
  quotation_id: string | null;
}

interface RFQLine {
  id: string;
  product_name: string;
  product_sku: string;
  description: string;
  quantity_requested: string;
  target_price: string;
  uom_name: string;
}

export default function SupplierRFQsPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [expandedRfq, setExpandedRfq] = useState<string | null>(null);
  const [rfqLines, setRfqLines] = useState<{ [key: string]: RFQLine[] }>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRFQs();
  }, []);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('supplierToken');
      const response = await fetch('/api/supplier-portal/rfqs', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRfqs(data.rfqs || []);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQs' });
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQs' });
    } finally {
      setLoading(false);
    }
  };

  const fetchRFQLines = async (rfqId: string) => {
    if (rfqLines[rfqId]) return; // Already fetched

    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch(`/api/supplier-portal/rfqs/${rfqId}/lines`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRfqLines(prev => ({ ...prev, [rfqId]: data.lines || [] }));
      }
    } catch (error) {
      console.error('Error fetching RFQ lines:', error);
    }
  };

  const toggleExpand = (rfqId: string) => {
    if (expandedRfq === rfqId) {
      setExpandedRfq(null);
    } else {
      setExpandedRfq(rfqId);
      fetchRFQLines(rfqId);
    }
  };

  const handleAcceptRFQ = async (rfq: RFQ) => {
    showConfirm({
      title: 'Accept RFQ',
      message: `Are you sure you want to accept RFQ ${rfq.rfq_number}? You will be able to create a quotation after accepting.`,
      confirmText: 'Accept',
      confirmVariant: 'primary',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const token = localStorage.getItem('supplierToken');
          const response = await fetch(`/api/supplier-portal/rfqs/${rfq.rfq_supplier_id}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            showAlert({
              type: 'success',
              title: 'Success',
              message: 'RFQ accepted successfully. You can now create a quotation.',
            });
            fetchRFQs();
          } else {
            const error = await response.json();
            showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to accept RFQ' });
          }
        } catch (error) {
          console.error('Error accepting RFQ:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to accept RFQ' });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRejectRFQ = async (rfq: RFQ) => {
    showConfirm({
      title: 'Reject RFQ',
      message: `Are you sure you want to reject RFQ ${rfq.rfq_number}? This action cannot be undone.`,
      confirmText: 'Reject',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const token = localStorage.getItem('supplierToken');
          const response = await fetch(`/api/supplier-portal/rfqs/${rfq.rfq_supplier_id}/reject`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ notes: 'Declined to quote' }),
          });

          if (response.ok) {
            showAlert({
              type: 'success',
              title: 'Success',
              message: 'RFQ rejected successfully.',
            });
            fetchRFQs();
          } else {
            const error = await response.json();
            showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to reject RFQ' });
          }
        } catch (error) {
          console.error('Error rejecting RFQ:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to reject RFQ' });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleCreateQuotation = (rfq: RFQ) => {
    router.push(`/supplier-portal/submit-quotation?rfq_id=${rfq.rfq_id}`);
  };

  const handleSubmitQuotation = (rfq: RFQ) => {
    if (rfq.has_quotation) {
      showAlert({
        type: 'info',
        title: 'Quotation Already Submitted',
        message: 'You have already submitted a quotation for this RFQ.',
      });
      return;
    }
    router.push(`/supplier-portal/submit-quotation?rfq_id=${rfq.rfq_id}`);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const isExpired = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Loading Overlay */}
      {loading && <LoadingSpinner size="lg" message="Loading RFQs..." fullScreen />}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Received RFQs</h1>
          <p className="text-gray-600 mt-1">View and respond to Request for Quotations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{rfqs.length}</div>
            <div className="text-sm text-gray-600">Total RFQs</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {rfqs.filter(r => r.response_status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">Pending Response</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {rfqs.filter(r => r.response_status === 'accepted').length}
            </div>
            <div className="text-sm text-green-600">Accepted</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">
              {rfqs.filter(r => r.has_quotation).length}
            </div>
            <div className="text-sm text-blue-600">Quotes Submitted</div>
          </div>
        </div>

        {/* RFQ List */}
        <div className="bg-white rounded-lg border border-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading RFQs...</div>
          ) : rfqs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No RFQs received yet</p>
              <p className="text-gray-400 text-sm">RFQs sent to you will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rfqs.map((rfq) => {
                const isRfqExpanded = expandedRfq === rfq.rfq_id;
                const expired = isExpired(rfq.deadline_date);

                return (
                  <div key={rfq.rfq_id} className="p-6">
                    {/* RFQ Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{rfq.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(rfq.response_status)}`}>
                            {rfq.response_status.toUpperCase()}
                          </span>
                          {expired && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              EXPIRED
                            </span>
                          )}
                          {rfq.has_quotation && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              QUOTED
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">RFQ Number:</span> {rfq.rfq_number}
                          </div>
                          <div>
                            <span className="font-medium">RFQ Date:</span>{' '}
                            {new Date(rfq.rfq_date).toLocaleDateString('en-IN')}
                          </div>
                          <div>
                            <span className="font-medium">Deadline:</span>{' '}
                            {rfq.deadline_date ? new Date(rfq.deadline_date).toLocaleDateString('en-IN') : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Products:</span> {rfq.product_count}
                          </div>
                        </div>
                        {rfq.description && (
                          <p className="mt-2 text-sm text-gray-600">{rfq.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleExpand(rfq.rfq_id)}
                        className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isRfqExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isRfqExpanded && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        {/* RFQ Lines */}
                        <h4 className="font-semibold text-gray-900 mb-4">Requested Products</h4>
                        <div className="overflow-x-auto mb-6">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Product</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">SKU</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Quantity</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Target Price</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">UOM</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {rfqLines[rfq.rfq_id]?.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-4 py-3 text-gray-900">{line.product_name}</td>
                                  <td className="px-4 py-3 text-gray-600">{line.product_sku}</td>
                                  <td className="px-4 py-3 text-gray-600">{line.description || '-'}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{line.quantity_requested}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {line.target_price ? `₹${parseFloat(line.target_price).toLocaleString('en-IN')}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{line.uom_name || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                          {rfq.response_status === 'pending' && !expired && (
                            <>
                              <button
                                onClick={() => handleRejectRFQ(rfq)}
                                disabled={actionLoading}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => handleAcceptRFQ(rfq)}
                                disabled={actionLoading}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Accept
                              </button>
                            </>
                          )}
                          {rfq.response_status === 'accepted' && !rfq.has_quotation && (
                            <button
                              onClick={() => handleCreateQuotation(rfq)}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              Create Quotation
                            </button>
                          )}
                          {rfq.has_quotation && (
                            <div className="text-green-600 font-medium flex items-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Quotation Submitted
                            </div>
                          )}
                          {rfq.response_status === 'rejected' && (
                            <div className="text-red-600 font-medium flex items-center gap-2">
                              <XCircle className="w-5 h-5" />
                              Rejected
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
