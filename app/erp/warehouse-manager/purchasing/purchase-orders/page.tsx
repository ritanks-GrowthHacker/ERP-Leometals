'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import POModal from '@/components/modal/POModal';
import ViewPOModal from '@/components/modal/ViewPOModal';
import { useAlert } from '@/components/common/CustomAlert';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  totalAmount: string;
  hasReceipt?: boolean;
  supplierName?: string;
  warehouseName?: string;
  supplier?: {
    name: string;
  };
  warehouse?: {
    name: string;
  };
}

export default function WarehouseManagerPurchaseOrdersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [sendingPO, setSendingPO] = useState<string | null>(null);
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/warehouse-manager/purchasing/purchase-orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data.purchaseOrders || []);
        setOrders(mapped);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPO = async (orderId: string) => {
    showConfirm({
      title: 'Send Purchase Order',
      message: 'Send this Purchase Order to the supplier via email?',
      confirmText: 'Send Email',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setSendingPO(orderId);
          // Wait for confirmation dialog to close, then show animation
          setTimeout(() => setShowEmailAnimation(true), 300);
          const token = getAuthToken();
          const response = await fetch(`/api/warehouse-manager/purchasing/purchase-orders/${orderId}/send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setTimeout(() => {
              setShowEmailAnimation(false);
              showAlert({ type: 'success', title: 'Success', message: 'Purchase Order sent successfully!' });
              fetchOrders();
            }, 2000);
          } else {
            setShowEmailAnimation(false);
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          setShowEmailAnimation(false);
          console.error('Error sending purchase order:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to send purchase order' });
        } finally {
          setSendingPO(null);
        }
      }
    });
  };

  const handleGenerateReceipt = async (orderId: string) => {
    showConfirm({
      title: 'Generate Receipt',
      message: 'Generate a goods receipt for this purchase order?',
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const response = await fetch(`/api/warehouse-manager/purchasing/purchase-orders/${orderId}/generate-receipt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            showAlert({ 
              type: 'success', 
              title: 'Success', 
              message: `Receipt ${data.receipt.receiptNumber} generated successfully!` 
            });
            fetchOrders();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error generating receipt:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to generate receipt' });
        }
      }
    });
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/warehouse-manager/purchasing/purchase-orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // API returns PO directly, not wrapped in .order
        setSelectedOrder(data);
        setShowViewModal(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      partially_received: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Purchase Orders</h2>
          <p className="text-sm text-gray-500 mt-1">Manage supplier orders and deliveries</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Create Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Draft</div>
          <div className="text-2xl font-bold text-gray-900">
            {orders.filter(o => o.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Confirmed</div>
          <div className="text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === 'confirmed' || o.status === 'sent').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">
            {orders.filter(o => o.status === 'partially_received').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Received</div>
          <div className="text-2xl font-bold text-purple-600">
            {orders.filter(o => o.status === 'received').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Purchase Orders</h3>
          <input 
            type="text"
            placeholder="Search orders..." 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading purchase orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No purchase orders found. Create your first purchase order.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.poNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.poDate ? new Date(order.poDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.supplierName || order.supplier?.name || <span className="text-gray-400 italic">No supplier</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.warehouseName || order.warehouse?.name || <span className="text-gray-400 italic">No warehouse</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">₹{order.totalAmount || '0.00'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        {['draft', 'confirmed'].includes(order.status) && (order.supplierName || order.supplier?.name) && (order.warehouseName || order.warehouse?.name) && (
                          <button
                            onClick={() => handleSendPO(order.id)}
                            disabled={sendingPO === order.id}
                            className="text-blue-600 border hover:text-blue-700 font-medium p-1 text-xs rounded-md cursor-pointer"
                          >
                            {sendingPO === order.id ? 'Sending...' : 'Send'}
                          </button>
                        )}
                        {['draft', 'confirmed', 'sent', 'partially_received'].includes(order.status) && (
                          <button
                            onClick={() => handleGenerateReceipt(order.id)}
                            disabled={order.hasReceipt}
                            className={`border font-medium text-xs p-1 rounded-md ${
                              order.hasReceipt 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'text-purple-600 hover:text-purple-700 cursor-pointer'
                            }`}
                          >
                            {order.hasReceipt ? 'Receipt Generated' : 'Generate Receipt'}
                          </button>
                        )}
                        <button
                          onClick={() => handleViewOrder(order.id)}
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

      <POModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchOrders}
        apiPrefix="/api/warehouse-manager/purchasing"
        userRole="warehouse_manager"
        userWarehouseId={getAuthToken() ? JSON.parse(atob(getAuthToken()!.split('.')[1])).warehouseId : undefined}
      />

      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />

      {showViewModal && selectedOrder && (
        <ViewPOModal order={selectedOrder} onClose={() => setShowViewModal(false)} />
      )}
    </div>
  );
}
