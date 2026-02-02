'use client';

import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';
import AssignDeliveryModal from '@/components/modal/AssignDeliveryModal';

interface SalesOrder {
  id: string;
  soNumber: string;
  soDate: string;
  status: string;
  totalAmount: string;
  customer: {
    name: string;
  };
  warehouse: {
    name: string;
  };
}

export default function WarehouseManagerSalesOrdersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/warehouse-manager/sales/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data.salesOrders || []);
        setOrders(mapped);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/warehouse-manager/sales/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data.order);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const toggleRow = async (orderId: string) => {
    if (expandedRow === orderId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(orderId);
      await fetchOrderDetails(orderId);
    }
  };

  const handleAssignDelivery = (order: any) => {
    // Prepare order data for delivery assignment
    setSelectedOrderForDelivery({
      id: order.id,
      orderNumber: order.soNumber,
      customerName: order.customer?.name,
      customerEmail: orderDetails?.customer?.email || '',
      customerPhone: orderDetails?.customer?.phone || '',
      shippingAddress: orderDetails?.shippingAddress || '',
      warehouseAddress: orderDetails?.warehouse?.address || '',
      warehouseName: orderDetails?.warehouse?.name || '',
    });
    setShowDeliveryModal(true);
  };

  const handleDeliveryAssignmentSuccess = () => {
    setShowDeliveryModal(false);
    setSelectedOrderForDelivery(null);
    fetchOrders();
    if (expandedRow) {
      toggleRow(expandedRow); // Refresh expanded details
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    showConfirm({
      title: 'Update Status',
      message: `Update order status to ${newStatus}?`,
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const response = await fetch(`/api/warehouse-manager/sales/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Status updated!' });
            fetchOrders();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          showAlert({ type: 'error', title: 'Error', message: 'Failed to update status' });
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      ready: 'bg-green-100 text-green-800',
      delivered: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Sales Orders</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage orders (No Create)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">📖 View Only - Cannot Create</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Orders</div>
          <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Processing</div>
          <div className="text-2xl font-bold text-yellow-600">
            {orders.filter(o => o.status === 'processing').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Ready</div>
          <div className="text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === 'ready').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Delivered</div>
          <div className="text-2xl font-bold text-purple-600">
            {orders.filter(o => o.status === 'delivered').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Orders</h3>
          <input 
            type="text"
            placeholder="Search orders..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading sales orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No sales orders found.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">SO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.soNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(order.soDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.customer?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.warehouse?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">₹{order.totalAmount}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleRow(order.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {expandedRow === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === order.id && orderDetails && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-gray-500">Expected Delivery</div>
                                <div className="text-sm font-medium">{orderDetails.expectedDeliveryDate ? new Date(orderDetails.expectedDeliveryDate).toLocaleDateString() : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Shipping Address</div>
                                <div className="text-sm font-medium">{orderDetails.shippingAddress || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Notes</div>
                                <div className="text-sm font-medium">{orderDetails.notes || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Created</div>
                                <div className="text-sm font-medium">{new Date(orderDetails.createdAt).toLocaleString('en-IN')}</div>
                              </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Product</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Unit Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Tax</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {orderDetails.lines?.map((line: any, idx: number) => {
                                    const qty = typeof line.quantityOrdered === 'string' ? parseFloat(line.quantityOrdered) : (line.quantityOrdered || 0);
                                    const price = typeof line.unitPrice === 'string' ? parseFloat(line.unitPrice) : (line.unitPrice || 0);
                                    const tax = typeof line.taxRate === 'string' ? parseFloat(line.taxRate) : (line.taxRate || 0);
                                    const lineTotal = qty * price * (1 + tax / 100);
                                    return (
                                      <tr key={idx} className="bg-white">
                                        <td className="px-4 py-2 text-sm">{line.product?.name || 'N/A'}</td>
                                        <td className="px-4 py-2 text-sm text-right">{qty}</td>
                                        <td className="px-4 py-2 text-sm text-right">₹{price.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-sm text-right">{tax}%</td>
                                        <td className="px-4 py-2 text-sm text-right font-semibold">₹{lineTotal.toFixed(2)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            
                            {/* Accept Order Button - Shows Delivery Assignment Modal */}
                            {(orderDetails.status === 'pending' || orderDetails.status === 'draft' || orderDetails.status === 'confirmed') && !orderDetails.deliveryAssignment && (
                              <div className="flex justify-end mt-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignDelivery(orderDetails);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  <Truck className="w-4 h-4" />
                                  Accept
                                </button>
                              </div>
                            )}
                            
                            {/* Delivery Status */}
                            {orderDetails.deliveryAssignment && (
                              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                      <Truck className="w-5 h-5" />
                                      Delivery Partner Assigned
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <span className="text-blue-700">Partner:</span>
                                        <span className="ml-2 font-medium text-gray-900">{orderDetails.deliveryAssignment.partnerName}</span>
                                      </div>
                                      <div>
                                        <span className="text-blue-700">Mobile:</span>
                                        <span className="ml-2 font-medium text-gray-900">{orderDetails.deliveryAssignment.partnerMobile}</span>
                                      </div>
                                      <div>
                                        <span className="text-blue-700">Status:</span>
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                          orderDetails.deliveryAssignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                          orderDetails.deliveryAssignment.status === 'picked_up' ? 'bg-blue-100 text-blue-800' :
                                          'bg-green-100 text-green-800'
                                        }`}>
                                          {orderDetails.deliveryAssignment.status.replace('_', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
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
          )}
        </div>
      </div>

      {/* Delivery Assignment Modal */}
      {showDeliveryModal && selectedOrderForDelivery && (
        <AssignDeliveryModal
          isOpen={showDeliveryModal}
          onClose={() => {
            setShowDeliveryModal(false);
            setSelectedOrderForDelivery(null);
          }}
          salesOrder={selectedOrderForDelivery}
          onSuccess={handleDeliveryAssignmentSuccess}
        />
      )}
    </div>
  );
}
