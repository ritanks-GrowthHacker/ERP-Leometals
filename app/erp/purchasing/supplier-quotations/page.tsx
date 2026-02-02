'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import Link from 'next/link';

interface SupplierQuotation {
  id: string;
  submission_number: string;
  submission_date: string;
  quotation_type: string;
  total_amount: string;
  status: string;
  valid_until: string;
  delivery_time_in_days: number;
  rfq_number?: string;
  rfq_title?: string;
  po_number?: string;
  rejection_reason?: string;
  rejection_notes?: string;
  can_resubmit: boolean;
}

interface GroupedSupplier {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  supplierEmail: string;
  supplierPhone: string;
  quotations: SupplierQuotation[];
  stats: {
    total: number;
    submitted: number;
    underReview: number;
    accepted: number;
    rejected: number;
    totalAmount: number;
  };
}

export default function SupplierQuotationsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [groupedSuppliers, setGroupedSuppliers] = useState<GroupedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [selectedQuotation, setSelectedQuotation] = useState<SupplierQuotation | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [canResubmit, setCanResubmit] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-quotations?groupBySupplier=true', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setGroupedSuppliers(data.groupedQuotations || []);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load quotations' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplier = (supplierId: string) => {
    const newExpanded = new Set(expandedSuppliers);
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId);
    } else {
      newExpanded.add(supplierId);
    }
    setExpandedSuppliers(newExpanded);
  };

  const handleAcceptQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Accept Quotation',
      message: 'Are you sure you want to accept this quotation? The supplier will be notified and can create an invoice.',
      confirmText: 'Accept',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const response = await fetch('/api/erp/purchasing/supplier-quotations', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              quotationId,
              status: 'accepted',
            }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Quotation accepted successfully!' });
            fetchQuotations();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          showAlert({ type: 'error', title: 'Error', message: 'Failed to accept quotation' });
        }
      },
    });
  };

  const openRejectModal = (quotation: SupplierQuotation) => {
    setSelectedQuotation(quotation);
    setRejectionReason('');
    setRejectionNotes('');
    setCanResubmit(true);
    setShowRejectModal(true);
  };

  const handleRejectQuotation = async () => {
    if (!selectedQuotation || !rejectionReason) {
      showAlert({ type: 'error', title: 'Error', message: 'Please provide a rejection reason' });
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-quotations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quotationId: selectedQuotation.id,
          status: 'rejected',
          rejectionReason,
          rejectionNotes,
          canResubmit,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Quotation rejected successfully!' });
        setShowRejectModal(false);
        fetchQuotations();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to reject quotation' });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Submitted' },
      under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Under Review' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    };
    const config = statusConfig[status] || statusConfig.submitted;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier Quotations</h1>
            <p className="text-sm text-gray-600 mt-1">Review and manage quotations submitted by suppliers</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/erp/purchasing/rfq"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              View RFQs
            </Link>
            <button
              onClick={fetchQuotations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers List */}
      {groupedSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600">No quotations submitted yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSuppliers.map((supplier) => (
            <div key={supplier.supplierId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Supplier Header */}
              <div
                onClick={() => toggleSupplier(supplier.supplierId)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                      <span className="text-blue-600 font-bold text-lg">
                        {supplier.supplierName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{supplier.supplierName}</h3>
                      <p className="text-sm text-gray-600">{supplier.supplierCode} • {supplier.supplierEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{supplier.stats.total}</p>
                      <p className="text-xs text-gray-500">Total Quotations</p>
                    </div>
                    <div className="flex gap-2">
                      {supplier.stats.submitted > 0 && (
                        <div className="px-3 py-1 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-600">{supplier.stats.submitted} New</p>
                        </div>
                      )}
                      {supplier.stats.accepted > 0 && (
                        <div className="px-3 py-1 bg-green-50 rounded-lg">
                          <p className="text-sm font-medium text-green-600">{supplier.stats.accepted} Accepted</p>
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedSuppliers.has(supplier.supplierId) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quotations Table */}
              {expandedSuppliers.has(supplier.supplierId) && (
                <div className="border-t border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Submission #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">RFQ/PO</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supplier.quotations.map((quotation) => (
                        <tr key={quotation.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">{quotation.submission_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(quotation.submission_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                            {quotation.quotation_type.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {quotation.rfq_number || quotation.po_number || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {quotation.total_amount
                              ? `₹${parseFloat(quotation.total_amount).toLocaleString('en-IN')}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(quotation.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                View
                              </button>
                              {quotation.status === 'submitted' && (
                                <>
                                  <button
                                    onClick={() => handleAcceptQuotation(quotation.id)}
                                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(quotation)}
                                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Quotation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Quotation: <strong>{selectedQuotation.submission_number}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="price_too_high">Price Too High</option>
                  <option value="delivery_time">Delivery Time Too Long</option>
                  <option value="quality_concerns">Quality Concerns</option>
                  <option value="terms_unacceptable">Terms Unacceptable</option>
                  <option value="better_offer">Better Offer Received</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Provide detailed feedback for the supplier..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="canResubmit"
                  checked={canResubmit}
                  onChange={(e) => setCanResubmit(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="canResubmit" className="text-sm text-gray-700">
                  Allow supplier to resubmit a revised quotation
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectQuotation}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Reject Quotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
