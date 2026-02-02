'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';

import POModal from '@/components/modal/POModal';
import ViewPOModal from '@/components/modal/ViewPOModal';
import { useAlert } from '@/components/common/CustomAlert';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  totalAmount: string;
  hasReceipt?: boolean;
  supplier: {
    name: string;
  };
  warehouse: {
    name: string;
  };
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
}

interface POLine {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: number;
}

export default function PurchaseOrdersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [sendingPO, setSendingPO] = useState<string | null>(null);
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [poLines, setPOLines] = useState<POLine[]>([]);
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    expectedDeliveryDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchWarehouses();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.purchaseOrders || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/products', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addLineItem = () => {
    setPOLines([...poLines, {
      productId: '',
      productName: '',
      quantity: '1',
      unitPrice: '0',
      taxRate: '0',
      lineTotal: 0,
    }]);
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...poLines];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].productName = product.name;
        // Auto-populate unit price from product's cost price
        updated[index].unitPrice = product.costPrice || '0';
      }
    }
    
    // Calculate line total
    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unitPrice) || 0;
    const tax = parseFloat(updated[index].taxRate) || 0;
    updated[index].lineTotal = qty * price * (1 + tax / 100);
    
    setPOLines(updated);
  };

  const removeLineItem = (index: number) => {
    setPOLines(poLines.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = poLines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
    
    const taxAmount = poLines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const tax = parseFloat(line.taxRate) || 0;
      return sum + (qty * price * tax / 100);
    }, 0);
    
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || !formData.warehouseId || poLines.length === 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in all required fields and add at least one line item' });
      return;
    }
    
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: poLines.map(line => ({
            productId: line.productId,
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.unitPrice),
            taxRate: parseFloat(line.taxRate),
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Purchase Order created successfully!' });
        setShowCreateModal(false);
        resetForm();
        fetchOrders();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create purchase order' });
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: '',
      notes: '',
    });
    setPOLines([]);
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
      const response = await fetch(`/api/erp/purchasing/orders/${orderId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setTimeout(() => {
          setShowEmailAnimation(false);
          showAlert({ type: 'success', title: 'Success', message: 'Purchase Order sent successfully!' });
          fetchOrders(); // Refresh to show updated status
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
          const response = await fetch(`/api/erp/purchasing/orders/${orderId}/generate-receipt`, {
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
      const response = await fetch(`/api/erp/purchasing/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data.order);
        setShowViewModal(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
    }
  };

  const handleEditOrder = async (orderId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const order = data.order;
        setSelectedOrder(order);
        setFormData({
          supplierId: order.supplierId,
          warehouseId: order.warehouseId,
          expectedDeliveryDate: order.expectedDeliveryDate?.split('T')[0] || '',
          notes: order.notes || '',
        });
        setPOLines(
          order.lines.map((line: any) => ({
            productId: line.productId,
            productName: line.productName || line.product?.name,
            quantity: line.quantityOrdered.toString(),
            unitPrice: line.unitPrice.toString(),
            taxRate: line.taxRate?.toString() || '0',
            lineTotal:
              parseFloat(line.quantityOrdered) *
              parseFloat(line.unitPrice) *
              (1 + (parseFloat(line.taxRate || '0') / 100)),
          }))
        );
        setShowEditModal(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load order details' });
    }
  };

  const handleUpdatePO = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId || !formData.warehouseId || poLines.length === 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in all required fields and add at least one line item' });
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: poLines.map((line) => ({
            productId: line.productId,
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.unitPrice),
            taxRate: parseFloat(line.taxRate),
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Purchase Order updated successfully!' });
        setShowEditModal(false);
        resetForm();
        fetchOrders();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create purchase order' });
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

  const totals = calculateTotals();

  return (
    <div className="p-6">
      {/* Header */}
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

      {/* Stats */}
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

      {/* Orders List */}
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
                      {new Date(order.poDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.supplier?.name || <span className="text-gray-400 italic">No supplier</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.warehouse?.name || <span className="text-gray-400 italic">No warehouse</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">₹{order.totalAmount}</td>
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
                        {['draft', 'confirmed'].includes(order.status) && order.supplier?.name && order.warehouse?.name && (
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
                        {order.status === 'draft' && (
                          <button
                            onClick={() => handleEditOrder(order.id)}
                            className="text-gray-600 text-xs rounded-md cursor-pointer hover:text-gray-700 border p-1 font-medium"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create PO Modal */}
      <POModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchOrders}
      />

      {/* Email Sent Animation */}
      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />

      {/* View PO Modal */}
      {showViewModal && selectedOrder && (
        <ViewPOModal order={selectedOrder} onClose={() => setShowViewModal(false)} />
      )}

      {/* Edit PO Modal */}
      {showEditModal && selectedOrder && (
        <POModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            fetchOrders();
          }}
          mode="edit"
          orderId={selectedOrder.id}
        />
      )}
    </div>
  );
}
