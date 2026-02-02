'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface CustomerOrdersModalProps {
  isOpen: boolean;
  customer: any;
  onClose: () => void;
}

export default function CustomerOrdersModal({ isOpen, customer, onClose }: CustomerOrdersModalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && customer) {
      setLoading(true);
      fetchOrders();
    }
  }, [isOpen, customer]);

  const fetchOrders = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/sales/orders?customerId=${customer.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Customer orders data:', data);
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Customer Orders</h2>
            <p className="text-sm text-blue-100 mt-1">{customer.name}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-500 rounded-full p-2">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="text-center py-8">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Order #</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{order.soNumber}</td>
                      <td className="px-4 py-3 text-sm">{new Date(order.soDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm font-semibold">₹{parseFloat(order.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
