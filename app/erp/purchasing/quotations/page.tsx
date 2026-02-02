'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import Link from 'next/link';
import { useAlert } from '@/components/common/CustomAlert';
import QuotationViewModal from '@/components/modal/QuotationViewModal';

interface Quotation {
  id: string;
  submission_number: string;
  submission_date: string;
  valid_until: string;
  status: string;
  total_amount: string;
  delivery_time_in_days: number;
  supplier_name: string;
  supplier_code: string;
  rfq_number: string;
  rfq_title: string;
  quotation_type: string;
  file_url?: string;
  file_name?: string;
  po_number?: string;
  purchase_order_id?: string;
}

export default function QuotationsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date>(new Date());

  useEffect(() => {
    fetchQuotations();
    
    // Check for new quotations every 30 seconds
    const interval = setInterval(() => {
      checkForNewQuotations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkForNewQuotations = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-quotations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newQuots = (data.quotations || []).filter((q: Quotation) => {
          const submissionDate = new Date(q.submission_date);
          return submissionDate > lastCheckedTime && q.po_number && q.status === 'submitted';
        });

        if (newQuots.length > 0) {
          newQuots.forEach((q: Quotation) => {
            showAlert({
              type: 'info',
              title: 'Quotation Received',
              message: `New quotation ${q.submission_number} received for PO ${q.po_number}`,
            });
          });
          setLastCheckedTime(new Date());
          fetchQuotations(); // Refresh the list
        }
      }
    } catch (error) {
      console.error('Error checking for new quotations:', error);
    }
  };

  const handleViewQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  };

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-quotations', {
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

  const handleAcceptQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Accept Quotation',
      message: 'Are you sure you want to accept this quotation?',
      confirmText: 'Accept',
      confirmVariant: 'primary',
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
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
            setShowViewModal(false);
            setSelectedQuotation(null);
            fetchQuotations();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error accepting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to accept quotation' });
        }
      },
    });
  };

  const handleRejectQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Reject Quotation',
      message: 'Are you sure you want to reject this quotation? This will notify the supplier.',
      confirmText: 'Reject',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
          const response = await fetch('/api/erp/purchasing/supplier-quotations', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              quotationId,
              status: 'rejected',
              rejectionNotes: 'Rejected by customer',
            }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Quotation rejected' });
            setShowViewModal(false);
            setSelectedQuotation(null);
            fetchQuotations();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error rejecting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to reject quotation' });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Supplier Quotations</h2>
          <p className="text-sm text-gray-500 mt-1">Review and compare supplier quotes</p>
        </div>
        <Link href="/erp/purchasing/rfq">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors">
            View RFQs
          </button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Submitted</div>
          <div className="text-2xl font-bold text-blue-600">
            {quotations.filter(q => q.status === 'submitted').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Under Review</div>
          <div className="text-2xl font-bold text-yellow-600">
            {quotations.filter(q => q.status === 'under_review').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Accepted</div>
          <div className="text-2xl font-bold text-green-600">
            {quotations.filter(q => q.status === 'accepted').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Rejected</div>
          <div className="text-2xl font-bold text-red-600">
            {quotations.filter(q => q.status === 'rejected').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Expired</div>
          <div className="text-2xl font-bold text-gray-600">
            {quotations.filter(q => q.status === 'expired').length}
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Quotations</h3>
          <input placeholder="Search quotations..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading quotations...
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No quotations found. Suppliers will submit quotes in response to RFQs.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Quotation #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">RFQ Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PO Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Valid Until</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Delivery Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quotation.submission_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(quotation.submission_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{quotation.supplier_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quotation.rfq_number ? (
                        <div>
                          <div className="font-medium">{quotation.rfq_number}</div>
                          <div className="text-xs text-gray-500">{quotation.rfq_title}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quotation.po_number ? (
                        <Link href={`/erp/purchasing/orders`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {quotation.po_number}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{parseFloat(quotation.total_amount || '0').toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{quotation.delivery_time_in_days ? `${quotation.delivery_time_in_days} days` : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(quotation.status)}`}>
                        {quotation.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewQuotation(quotation)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                        {quotation.status === 'submitted' || quotation.status === 'under_review' ? (
                          <>
                            <button 
                              onClick={() => handleAcceptQuotation(quotation.id)}
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleRejectQuotation(quotation.id)}
                              className="text-red-600 hover:text-red-700 font-medium"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Comparison Section */}
      {quotations.filter(q => q.status === 'submitted' || q.status === 'under_review').length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Compare Quotations</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {quotations
                .filter(q => q.status === 'submitted' || q.status === 'under_review')
                .slice(0, 3)
                .map((quotation) => (
                  <div key={quotation.id} className="border rounded-lg p-4">
                    <div className="font-semibold text-lg mb-2">{quotation.supplier_name}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold">₹{parseFloat(quotation.total_amount || '0').toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery:</span>
                        <span>{quotation.delivery_time_in_days || '-'} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valid Until:</span>
                        <span>
                          {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button 
                        onClick={() => handleAcceptQuotation(quotation.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleViewQuotation(quotation)}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* View Quotation Modal */}
      {selectedQuotation && (
        <QuotationViewModal
          isOpen={showViewModal}
          quotation={selectedQuotation}
          onClose={() => {
            setShowViewModal(false);
            setSelectedQuotation(null);
          }}
          onAccept={() => handleAcceptQuotation(selectedQuotation.id)}
          onReject={() => handleRejectQuotation(selectedQuotation.id)}
          showActions={
            selectedQuotation.status === 'submitted' || selectedQuotation.status === 'under_review'
          }
        />
      )}
    </div>
  );
}
