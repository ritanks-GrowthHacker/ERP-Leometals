'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import RFQModal from '@/components/modal/RFQModal';
import { useAlert } from '@/components/common/CustomAlert';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';

interface RFQ {
  id: string;
  rfqNumber: string;
  rfqDate: string;
  deadlineDate: string;
  title: string;
  status: string;
  suppliers: any[];
  lines: any[];
  quotationsCount?: number;
}

export default function WarehouseManagerRFQsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<any>(null);
  const [sendingRFQ, setSendingRFQ] = useState<string | null>(null);

  useEffect(() => {
    fetchRFQs();
  }, []);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/warehouse-manager/purchasing/rfqs', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data.rfqs || []);
        setRFQs(mapped);
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRFQ = async (rfqId: string) => {
    showConfirm({
      title: 'Send RFQ',
      message: 'Send this RFQ to all invited suppliers via email?',
      confirmText: 'Send RFQ',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setSendingRFQ(rfqId);
          // Wait for confirmation dialog to close, then show animation
          setTimeout(() => setShowEmailAnimation(true), 300);
          const token = getAuthToken();
          const response = await fetch(`/api/warehouse-manager/purchasing/rfqs/${rfqId}/send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setTimeout(() => {
              setShowEmailAnimation(false);
              showAlert({ type: 'success', title: 'Success', message: data.message });
              fetchRFQs();
            }, 2000);
          } else {
            setShowEmailAnimation(false);
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          setShowEmailAnimation(false);
          console.error('Error sending RFQ:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to send RFQ' });
        } finally {
          setSendingRFQ(null);
        }
      }
    });
  };

  const handleViewRFQ = async (rfqId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/warehouse-manager/purchasing/rfqs/${rfqId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data);
        setSelectedRFQ(mapped); // API returns rfq directly, map to camelCase
        setShowViewModal(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQ details' });
      }
    } catch (error) {
      console.error('Error fetching RFQ:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQ details' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      closed: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Requests for Quotation</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage RFQs</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Create RFQ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Draft</div>
          <div className="text-2xl font-bold text-gray-900">
            {rfqs.filter(r => r.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Sent</div>
          <div className="text-2xl font-bold text-blue-600">
            {rfqs.filter(r => r.status === 'sent').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600">
            {rfqs.filter(r => r.status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Received</div>
          <div className="text-2xl font-bold text-green-600">
            {rfqs.filter(r => r.status === 'received').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">RFQs</h3>
          <input 
            type="text"
            placeholder="Search RFQs..." 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading RFQs...
            </div>
          ) : rfqs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No RFQs found. Create your first RFQ.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">RFQ Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {rfq.rfqNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {rfq.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(rfq.rfqDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {rfq.deadlineDate ? new Date(rfq.deadlineDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusColor(
                          rfq.status
                        )}`}
                      >
                        {rfq.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        {rfq.status === 'draft' && (
                          <button
                            onClick={() => handleSendRFQ(rfq.id)}
                            disabled={sendingRFQ === rfq.id}
                            className="text-blue-600 border hover:text-blue-700 font-medium p-1 text-xs rounded-md cursor-pointer"
                          >
                            {sendingRFQ === rfq.id ? 'Sending...' : 'Send'}
                          </button>
                        )}
                        <button
                          onClick={() => handleViewRFQ(rfq.id)}
                          className="text-blue-600 text-xs rounded-md cursor-pointer hover:text-blue-700 border font-medium p-1"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RFQModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchRFQs}
        apiPrefix="/api/warehouse-manager/purchasing"
      />

      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />

      {showViewModal && selectedRFQ && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-xl font-semibold text-gray-900">RFQ Details: {selectedRFQ.rfqNumber}</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <div className="text-sm text-gray-500">RFQ Number</div>
                  <div className="font-semibold">{selectedRFQ.rfqNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRFQ.status)}`}>
                    {selectedRFQ.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">RFQ Date</div>
                  <div className="font-semibold">{selectedRFQ.rfqDate ? new Date(selectedRFQ.rfqDate).toLocaleDateString() : '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Deadline</div>
                  <div className="font-semibold">
                    {selectedRFQ.deadlineDate ? new Date(selectedRFQ.deadlineDate).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              {/* Title and Description */}
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedRFQ.title || 'RFQ'}</h3>
                {selectedRFQ.description && (
                  <p className="text-gray-600">{selectedRFQ.description}</p>
                )}
              </div>

              {/* Line Items */}
              {selectedRFQ.lines && selectedRFQ.lines.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Requested Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">#</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Quantity</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedRFQ.lines.map((line: any, index: number) => (
                          <tr key={line.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{index + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium">{line.product?.name || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-right">{line.quantityRequested || 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{line.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Suppliers */}
              {selectedRFQ.suppliers && selectedRFQ.suppliers.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Invited Suppliers</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supplier</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedRFQ.suppliers.map((supplier: any) => (
                          <tr key={supplier.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">{supplier.supplier?.name || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{supplier.supplier?.email || '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs ${supplier.responded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {supplier.responded ? 'Responded' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedRFQ.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-gray-700">{selectedRFQ.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setShowViewModal(false)} 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
