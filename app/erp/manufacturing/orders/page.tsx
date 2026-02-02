"use client";
import React, { useState, useEffect } from 'react';
import { Edit, Eye, Trash2, Play, CheckCircle, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';
import MOFormModal from '@/components/modal/MOFormModal';
import MOViewModal from '@/components/modal/MOViewModal';
import OperationExecutionModal from '@/components/modal/OperationExecutionModal';
import ReworkOrderModal from '@/components/modal/ReworkOrderModal';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface ManufacturingOrder {
  id: string;
  moNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  bomVersion: string;
  plannedQuantity: number;
  producedQuantity: number;
  uom: string;
  status: 'draft' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
}

export default function ManufacturingOrdersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [routings, setRoutings] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [progressUpdate, setProgressUpdate] = useState<{ orderId: string; producedQty: number } | null>(null);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkParentMO, setReworkParentMO] = useState<any | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setError(null);
      await Promise.all([
        fetchOrders(),
        fetchProducts(),
        fetchBOMs(),
        fetchRoutings(),
        fetchWarehouses(),
      ]);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/manufacturing/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch orders`);
      }

      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    }
  };

  const fetchProducts = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/inventory/products', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const fetchBOMs = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/manufacturing/bom', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBoms(Array.isArray(data) ? data : data.boms || []);
      }
    } catch (error) {
      console.error('Error fetching BOMs:', error);
      setBoms([]);
    }
  };

  const fetchRoutings = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/manufacturing/routing', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRoutings(Array.isArray(data) ? data : data.routings || []);
      }
    } catch (error) {
      console.error('Error fetching routings:', error);
      setRoutings([]);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/inventory/warehouses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(Array.isArray(data) ? data : data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setWarehouses([]);
    }
  };

  const toggleRow = async (orderId: string) => {
    if (expandedRow === orderId) {
      setExpandedRow(null);
      setOrderDetails(null);
    } else {
      setExpandedRow(orderId);
      await fetchOrderDetails(orderId);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/manufacturing/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch order details');
      const data = await res.json();
      setOrderDetails(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
      setOrderDetails(null);
    }
  };

  const handleEdit = (order: ManufacturingOrder) => {
    setEditingOrder(order);
    setShowFormModal(true);
  };

  const handleView = (order: ManufacturingOrder) => {
    setViewingOrder(order);
    fetchOrderDetails(order.id).then(() => {
      setShowViewModal(true);
    });
  };

  const handleDelete = async (orderId: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Delete Manufacturing Order',
      message: 'Are you sure you want to delete this manufacturing order?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/erp/manufacturing/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) throw new Error('Failed to delete order');

          await fetchOrders();
          showAlert({ type: 'success', title: 'Success', message: 'Manufacturing order deleted successfully' });
        } catch (error) {
          console.error('Error deleting order:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to delete manufacturing order' });
        }
      }
    });
  };

  const handleUpdateProgress = async (orderId: string, producedQty: number) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/erp/manufacturing/orders/${orderId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ producedQuantity: producedQty }),
      });

      if (!res.ok) throw new Error('Failed to update progress');

      await fetchOrders();
      setProgressUpdate(null);
      showAlert({ type: 'success', title: 'Success', message: 'Production progress updated' });
    } catch (error) {
      console.error('Error updating progress:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update progress' });
    }
  };

  const handleCreateNew = () => {
    setEditingOrder(null);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    await fetchOrders();
    setShowFormModal(false);
    setEditingOrder(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return colors[priority] || 'bg-gray-100 text-gray-700';
  };

  const stats = {
    total: orders.length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'done').length,
    pending: orders.filter(o => o.status === 'draft' || o.status === 'confirmed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading manufacturing orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6 flex items-center justify-center">
        <div className="max-w-md bg-white rounded-xl shadow-lg p-6 border border-red-200">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error Loading Orders</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Please check that the API endpoint is configured correctly at <code className="bg-gray-100 px-2 py-1 rounded">/api/erp/manufacturing/orders</code></p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Manufacturing Orders
              </h1>
              <p className="text-gray-600 mt-1">Manage production orders and track progress</p>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              Create Order
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">MO Number</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="text-right p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Planned</th>
                  <th className="text-right p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Produced</th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Schedule</th>
                  <th className="text-center p-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Expand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <span className="font-medium text-gray-900">{order.moNumber}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900">{order.productName}</p>
                          <p className="text-sm text-gray-500">{order.productSku}</p>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-medium">{order.plannedQuantity}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-medium">{order.producedQuantity}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min((order.producedQuantity / order.plannedQuantity) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-600 w-12 text-right">
                            {Math.round((order.producedQuantity / order.plannedQuantity) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}>
                          {order.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="text-gray-600">Start: {order.scheduledStart}</p>
                          <p className="text-gray-600">End: {order.scheduledEnd}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleRow(order.id)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {expandedRow === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                    </tr>

                    {expandedRow === order.id && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 p-6">
                          <div className="space-y-6">
                            {/* Progress Update Section */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="font-semibold text-gray-800 mb-3">Update Production Progress</h4>
                              <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Produced Quantity
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={order.plannedQuantity}
                                    value={progressUpdate?.orderId === order.id ? progressUpdate.producedQty : order.producedQuantity}
                                    onChange={(e) => setProgressUpdate({ 
                                      orderId: order.id, 
                                      producedQty: parseFloat(e.target.value) || 0 
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter produced quantity"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Planned: {order.plannedQuantity} {order.uom}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    if (progressUpdate?.orderId === order.id) {
                                      handleUpdateProgress(order.id, progressUpdate.producedQty);
                                    }
                                  }}
                                  disabled={!progressUpdate || progressUpdate.orderId !== order.id}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  <Play className="w-4 h-4 inline mr-2" />
                                  Update Progress
                                </button>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      (order.producedQuantity / order.plannedQuantity) * 100 === 100 
                                        ? 'bg-green-600' 
                                        : 'bg-blue-600'
                                    }`}
                                    style={{ 
                                      width: `${Math.min((order.producedQuantity / order.plannedQuantity) * 100, 100)}%` 
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-600">
                                  {Math.round((order.producedQuantity / order.plannedQuantity) * 100)}%
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleView(order)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </button>
                              <button
                                onClick={() => handleEdit(order)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setReworkParentMO(order);
                                  setShowReworkModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                Create Rework
                              </button>
                              <button
                                onClick={() => handleDelete(order.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>

                            {orderDetails && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {orderDetails.operations?.length > 0 && (
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <h4 className="font-semibold text-gray-800 mb-3">Operations</h4>
                                    <div className="space-y-2">
                                      {orderDetails.operations.map((op: any) => (
                                        <div key={op.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                                          <div className="flex-1">
                                            <span className="text-gray-900 font-medium">{op.operationName}</span>
                                            <span className="text-gray-500 text-xs ml-2">({op.workCenter})</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(op.status)}`}>
                                              {op.status}
                                            </span>
                                            <button
                                              onClick={() => {
                                                setSelectedOperation(op);
                                                setShowOperationModal(true);
                                              }}
                                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1"
                                            >
                                              <Play className="w-3 h-3" />
                                              Execute
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {orderDetails.materialConsumption?.length > 0 && (
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <h4 className="font-semibold text-gray-800 mb-3">Materials</h4>
                                    <div className="space-y-2">
                                      {orderDetails.materialConsumption.map((mat: any) => (
                                        <div key={mat.id} className="flex justify-between items-center text-sm">
                                          <span className="text-gray-700">{mat.componentName}</span>
                                          <span className="text-gray-600">
                                            {mat.consumedQty}/{mat.requiredQty} {mat.uom}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
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

          {orders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No manufacturing orders found</p>
            </div>
          )}
        </div>
      </div>

      <MOFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingOrder(null);
        }}
        onSave={handleSave}
        order={editingOrder}
        products={products}
        boms={boms}
        routings={routings}
        warehouses={warehouses}
      />

      <MOViewModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingOrder(null);
        }}
        order={viewingOrder}
        details={orderDetails}
      />

      <OperationExecutionModal
        isOpen={showOperationModal}
        onClose={() => {
          setShowOperationModal(false);
          setSelectedOperation(null);
        }}
        onSuccess={async () => {
          setShowOperationModal(false);
          if (expandedRow) {
            await fetchOrderDetails(expandedRow);
          }
          await fetchOrders();
        }}
        operation={selectedOperation}
      />

      <ReworkOrderModal
        isOpen={showReworkModal}
        onClose={() => {
          setShowReworkModal(false);
          setReworkParentMO(null);
        }}
        onSuccess={() => {
          fetchOrders();
          setShowReworkModal(false);
          setReworkParentMO(null);
        }}
        parentMO={reworkParentMO}
      />
    </div>
  );
}