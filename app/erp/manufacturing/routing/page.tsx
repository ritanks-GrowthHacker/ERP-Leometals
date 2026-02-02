"use client";
import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Clock, ArrowRight, Plus, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import RoutingFormModal from '@/components/modal/RoutingFormModal';

interface Routing {
  id: string;
  routingCode: string;
  name: string;
  productId: string;
  productName: string;
  productSku: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface RoutingDetails {
  routing: Routing;
  operations: Array<{
    id: string;
    sequence: number;
    operationName: string;
    workCenter: {
      code: string;
      name: string;
    };
    setupTime: number;
    runTimePerUnit: number;
    description: string;
  }>;
}

export default function RoutingPage() {
  const { showAlert, showConfirm } = useAlert();
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [routingDetails, setRoutingDetails] = useState<RoutingDetails | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRouting, setEditingRouting] = useState<any>(null);

  useEffect(() => {
    fetchRoutings();
  }, []);

  const fetchRoutings = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const res = await fetch('/api/erp/manufacturing/routing', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch routings');
      const data = await res.json();
      setRoutings(data.routings || []);
    } catch (error) {
      console.error('Error fetching routings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    fetchRoutings();
    showAlert({ type: 'success', title: 'Success', message: 'Routing saved successfully' });
  };

  const handleEdit = async (routing: Routing) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/manufacturing/routing/${routing.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEditingRouting(data.routing);
        setShowFormModal(true);
      }
    } catch (error) {
      console.error('Error fetching routing details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load routing details' });
    }
  };

  const handleCreateNew = () => {
    setEditingRouting(null);
    setShowFormModal(true);
  };

  const toggleExpand = async (routingId: string) => {
    if (expandedRow === routingId) {
      setExpandedRow(null);
      setRoutingDetails(null);
    } else {
      setExpandedRow(routingId);
      await fetchRoutingDetails(routingId);
    }
  };

  const fetchRoutingDetails = async (routingId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/manufacturing/routing/${routingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch routing details');
      const data = await res.json();
      setRoutingDetails(data);
    } catch (error) {
      console.error('Error fetching routing details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Delete Routing',
      message: 'Are you sure you want to delete this routing?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/erp/manufacturing/routing/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error('Failed to delete routing');
          await fetchRoutings();
          showAlert({ type: 'success', title: 'Success', message: 'Routing deleted successfully' });
        } catch (error) {
          console.error('Error deleting routing:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to delete routing' });
        }
      },
    });
  };

  const calculateTotalTime = (operations: any[]) => {
    if (!operations || operations.length === 0) return { setup: 0, run: 0 };
    return {
      setup: operations.reduce((sum, op) => sum + (op.setupTime || 0), 0),
      run: operations.reduce((sum, op) => sum + (op.runTimePerUnit || 0), 0),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center py-12">
          <Clock className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading routings...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: routings.length,
    active: routings.filter(r => r.status === 'active').length,
    inactive: routings.filter(r => r.status !== 'active').length,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Production Routings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage operation sequences and work center assignments
            </p>
          </div>
          <button 
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            Create Routing
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Total</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Active</div>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Inactive</div>
            <div className="text-3xl font-bold text-gray-600">{stats.inactive}</div>
          </div>
        </div>

        {/* Routings Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Routing Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Expand</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {routings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No routings found
                    </td>
                  </tr>
                ) : (
                  routings.map((routing) => (
                    <React.Fragment key={routing.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {routing.routingCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{routing.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {routing.productName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {routing.productSku || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              routing.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {routing.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(routing.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {expandedRow === routing.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {expandedRow === routing.id && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50 p-6">
                            <div className="space-y-6">
                              {/* Action Buttons */}
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => handleEdit(routing)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(routing.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>

                              {routingDetails && (
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <ArrowRight className="w-5 h-5 text-blue-600" />
                                    Operations Sequence
                                  </h3>

                                  {!routingDetails?.operations || routingDetails.operations.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No operations defined</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {routingDetails.operations.map((op, index) => (
                                        <div
                                          key={op.id}
                                          className="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow-sm"
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-3 mb-2">
                                                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                                                  {op.sequence}
                                                </span>
                                                <h4 className="text-lg font-semibold text-gray-900">
                                                  {op.operationName}
                                                </h4>
                                              </div>
                                              <p className="text-sm text-gray-600 ml-11">
                                                {op.description || 'No description'}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-semibold text-gray-900">
                                                {op.workCenter.name}
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                {op.workCenter.code}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex gap-6 mt-3 ml-11">
                                            <div className="flex items-center gap-2">
                                              <Clock className="w-4 h-4 text-gray-400" />
                                              <span className="text-sm text-gray-600">
                                                Setup: <span className="font-semibold">{op.setupTime}m</span>
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Clock className="w-4 h-4 text-gray-400" />
                                              <span className="text-sm text-gray-600">
                                                Run: <span className="font-semibold">{op.runTimePerUnit}m/unit</span>
                                              </span>
                                            </div>
                                          </div>
                                          {index < routingDetails.operations.length - 1 && (
                                            <div className="ml-4 mt-3">
                                              <ArrowRight className="w-5 h-5 text-blue-400" />
                                            </div>
                                          )}
                                        </div>
                                      ))}

                                      {/* Total Time Summary */}
                                      <div className="bg-blue-50 p-4 rounded-lg">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                          Total Time Summary
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-xs text-gray-600">Total Setup Time</p>
                                            <p className="text-lg font-bold text-blue-600">
                                              {calculateTotalTime(routingDetails.operations).setup} minutes
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-600">Total Run Time (per unit)</p>
                                            <p className="text-lg font-bold text-blue-600">
                                              {calculateTotalTime(routingDetails.operations).run} minutes
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {routingDetails.routing.notes && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                                      <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
                                        {routingDetails.routing.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
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
        </div>
      </div>

      {/* Routing Form Modal */}
      <RoutingFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingRouting(null);
        }}
        onSuccess={handleFormSuccess}
        editRouting={editingRouting}
      />
    </div>
  );
}