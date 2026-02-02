"use client";
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Eye, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import ReworkOrderModal from '@/components/modal/ReworkOrderModal';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface ReworkOrder {
  id: string;
  reworkNumber: string;
  parentMoId: string;
  parentMoNumber: string;
  productName: string;
  productSku: string;
  defectQuantity: number;
  reworkQuantity: number;
  defectType: string;
  defectDescription: string;
  rootCause: string;
  correctiveAction: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdAt: string;
}

export default function ReworkOrdersPage() {
  const { showAlert } = useAlert();
  const [reworkOrders, setReworkOrders] = useState<ReworkOrder[]>([]);
  const [manufacturingOrders, setManufacturingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRework, setSelectedRework] = useState<ReworkOrder | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch rework orders
      const reworkRes = await fetch('/api/erp/manufacturing/rework', { headers });
      if (!reworkRes.ok) throw new Error('Failed to fetch rework orders');
      const reworkData = await reworkRes.json();
      setReworkOrders(reworkData);

      // Fetch manufacturing orders for dropdown
      const moRes = await fetch('/api/erp/manufacturing/orders', { headers });
      if (!moRes.ok) throw new Error('Failed to fetch manufacturing orders');
      const moData = await moRes.json();
      setManufacturingOrders(moData);

    } catch (err: any) {
      showAlert({ type: 'error', title: 'Error', message: err.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reworkId: string, newStatus: string) => {
    try {
      setUpdatingStatus(reworkId);
      const token = getAuthToken();
      const response = await fetch(`/api/erp/manufacturing/rework/${reworkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      showAlert({ type: 'success', title: 'Success', message: 'Rework order status updated successfully' });
      fetchData();
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Error', message: err.message || 'Failed to update status' });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getDefectTypeColor = (type: string) => {
    const colors = {
      dimensional: 'bg-purple-100 text-purple-800',
      visual: 'bg-blue-100 text-blue-800',
      functional: 'bg-red-100 text-red-800',
      material: 'bg-orange-100 text-orange-800',
      assembly: 'bg-teal-100 text-teal-800',
      finish: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading rework orders...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              Rework Orders
            </h1>
            <p className="text-gray-600 mt-1">Manage defective products and rework operations</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Create Rework Order
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rework #</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Parent MO</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Defect Type</th>
                <th className="text-right p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Defect Qty</th>
                <th className="text-right p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rework Qty</th>
                <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Schedule</th>
                <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reworkOrders.map((rework) => (
                <React.Fragment key={rework.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-red-700">{rework.reworkNumber}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-gray-900">{rework.parentMoNumber}</span>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-gray-900">{rework.productName}</p>
                      <p className="text-sm text-gray-500">{rework.productSku}</p>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getDefectTypeColor(rework.defectType)}`}>
                      {rework.defectType?.toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-red-600">{rework.defectQuantity}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-blue-600">{rework.reworkQuantity}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(rework.priority)}`}>
                      {rework.priority?.toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(rework.status)}`}>
                      {rework.status?.replace('_', ' ').toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {rework.scheduledStart && (
                        <p className="text-gray-600">Start: {new Date(rework.scheduledStart).toLocaleDateString()}</p>
                      )}
                      {rework.scheduledEnd && (
                        <p className="text-gray-600">End: {new Date(rework.scheduledEnd).toLocaleDateString()}</p>
                      )}
                      {!rework.scheduledStart && !rework.scheduledEnd && (
                        <p className="text-gray-400 italic">Not scheduled</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setExpandedRow(expandedRow === rework.id ? null : rework.id)}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {expandedRow === rework.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>

                {expandedRow === rework.id && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50 p-6">
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-gray-800 mb-3">Update Status</h4>
                          <div className="flex gap-4 items-center">
                            <select
                              value={rework.status}
                              onChange={(e) => handleStatusUpdate(rework.id, e.target.value)}
                              disabled={updatingStatus === rework.id}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            {updatingStatus === rework.id && (
                              <div className="text-sm text-gray-600">Updating...</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-gray-800 mb-2">Details</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Defect Description:</span>
                              <p className="text-gray-900 mt-1">{rework.defectDescription || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Root Cause:</span>
                              <p className="text-gray-900 mt-1">{rework.rootCause || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Corrective Action:</span>
                              <p className="text-gray-900 mt-1">{rework.correctiveAction || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}            
            </tbody>
          </table>
        </div>

        {reworkOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No rework orders found</p>
            <p className="text-sm mt-2">Create a rework order to track defective products</p>
          </div>
        )}
      </div>

      <ReworkOrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchData}
        parentMO={null}
      />
    </div>
  );
}