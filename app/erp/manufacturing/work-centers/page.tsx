"use client";
import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Activity, AlertTriangle, Plus, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import WorkCenterFormModal from '@/components/modal/WorkCenterFormModal';

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: 'machine' | 'assembly_line' | 'testing' | 'packaging';
  capacityPerDay: number;
  capacityUom: string;
  costPerHour: number;
  efficiency: number;
  status: 'active' | 'maintenance' | 'idle' | 'breakdown';
  location: string;
  createdAt: string;
}

interface WorkCenterDetails {
  workCenter: WorkCenter;
  scheduledOperations: Array<{
    id: string;
    sequence: number;
    operationName: string;
    scheduledStart: string;
    setupTime: number;
    runTimePerUnit: number;
    manufacturingOrder: {
      moNumber: string;
      product: {
        name: string;
      };
    };
  }>;
  downtimeLog: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    reason: string;
    downtime_type: 'scheduled' | 'unscheduled';
    description: string;
  }>;
}

export default function WorkCentersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [centerDetails, setCenterDetails] = useState<WorkCenterDetails | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingWorkCenter, setEditingWorkCenter] = useState<any>(null);

  useEffect(() => {
    fetchWorkCenters();
  }, []);

  const fetchWorkCenters = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const res = await fetch('/api/erp/manufacturing/work-centers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch work centers');
      }
      const data = await res.json();
      console.log('Work centers data:', data);
      const centersArray = Array.isArray(data) ? data : (data.workCenters || []);
      setWorkCenters(centersArray);
    } catch (error) {
      console.error('Error fetching work centers:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load work centers' });
      setWorkCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    fetchWorkCenters();
    showAlert({ type: 'success', title: 'Success', message: 'Work center saved successfully' });
  };

  const handleEdit = (workCenter: WorkCenter) => {
    setEditingWorkCenter(workCenter);
    setShowFormModal(true);
  };

  const handleCreateNew = () => {
    setEditingWorkCenter(null);
    setShowFormModal(true);
  };

  const toggleExpand = async (centerId: string) => {
    if (expandedRow === centerId) {
      setExpandedRow(null);
      setCenterDetails(null);
    } else {
      setExpandedRow(centerId);
      await fetchCenterDetails(centerId);
    }
  };

  const fetchCenterDetails = async (centerId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/manufacturing/work-centers/${centerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch work center details');
      const data = await res.json();
      setCenterDetails({
        workCenter: data.workCenter,
        scheduledOperations: data.scheduledOperations || [],
        downtimeLog: data.downtimeLog || [],
      });
    } catch (error) {
      console.error('Error fetching work center details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Delete Work Center',
      message: 'Are you sure you want to delete this work center?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/erp/manufacturing/work-centers/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error('Failed to delete work center');
          await fetchWorkCenters();
        } catch (error) {
          console.error('Error deleting work center:', error);
          showAlert({
            title: 'Error',
            message: 'Failed to delete work center',
            type: 'error',
          });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      idle: 'bg-gray-100 text-gray-800',
      breakdown: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      machine: 'bg-blue-100 text-blue-800',
      assembly_line: 'bg-purple-100 text-purple-800',
      testing: 'bg-indigo-100 text-indigo-800',
      packaging: 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center py-12">
          <Activity className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading work centers...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: workCenters.length,
    active: workCenters.filter(wc => wc.status === 'active').length,
    maintenance: workCenters.filter(wc => wc.status === 'maintenance').length,
    breakdown: workCenters.filter(wc => wc.status === 'breakdown').length,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Work Centers
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage production work centers and capacity
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            Create Work Center
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Total</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Active</div>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Maintenance</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.maintenance}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Breakdown</div>
            <div className="text-3xl font-bold text-red-600">{stats.breakdown}</div>
          </div>
        </div>

        {/* Work Centers Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Capacity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Efficiency</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cost/Hour</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Location</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Expand</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workCenters.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No work centers found
                    </td>
                  </tr>
                ) : (
                  workCenters.map((center) => (
                    <React.Fragment key={center.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{center.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{center.name}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(center.type)}`}>
                            {center.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {center.capacityPerDay} {center.capacityUom}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${center.efficiency}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-semibold">{center.efficiency}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">₹{center.costPerHour}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(center.status)}`}>
                            {center.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{center.location}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(center.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {expandedRow === center.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {expandedRow === center.id && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50 p-6">
                            <div className="space-y-6">
                              {/* Action Buttons */}
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => handleEdit(center)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(center.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>

                              {centerDetails && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Scheduled Operations */}
                                  <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                      📅 Scheduled Operations (Next 10)
                                    </h3>
                                    {centerDetails.scheduledOperations.length === 0 ? (
                                      <p className="text-gray-500 text-sm">No scheduled operations</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {centerDetails.scheduledOperations.map((op) => (
                                          <div key={op.id} className="bg-white p-3 rounded-lg border">
                                            <div className="flex justify-between items-start">
                                              <div>
                                                <p className="font-semibold text-sm text-gray-900">
                                                  {op.manufacturingOrder.moNumber}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                  {op.manufacturingOrder.product.name}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {op.operationName}
                                                </p>
                                              </div>
                                              <div className="text-right text-xs">
                                                <p className="text-gray-600">
                                                  {new Date(op.scheduledStart).toLocaleDateString()}
                                                </p>
                                                <p className="text-gray-500">
                                                  Setup: {op.setupTime}m
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Downtime Log */}
                                  <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                      ⚠️ Downtime Log (Last 10)
                                    </h3>
                                    {centerDetails.downtimeLog.length === 0 ? (
                                      <p className="text-gray-500 text-sm">No downtime recorded</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {centerDetails.downtimeLog.map((log) => (
                                          <div key={log.id} className="bg-white p-3 rounded-lg border">
                                            <div className="flex justify-between items-start">
                                              <div>
                                                <p className="font-semibold text-sm text-gray-900">
                                                  {log.reason}
                                                </p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                  {log.description}
                                                </p>
                                              </div>
                                              <div className="text-right text-xs">
                                                <p className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                  log.downtime_type === 'scheduled' 
                                                    ? 'bg-blue-100 text-blue-800' 
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {log.downtime_type}
                                                </p>
                                                <p className="text-gray-600 mt-1">
                                                  {new Date(log.startTime).toLocaleDateString()}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
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

      {/* Work Center Form Modal */}
      <WorkCenterFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingWorkCenter(null);
        }}
        onSuccess={handleFormSuccess}
        editWorkCenter={editingWorkCenter}
      />
    </div>
  );
}