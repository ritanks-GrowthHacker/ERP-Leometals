'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { inputFieldDesign, modalLabels } from '@/components/modal/modalInputDesigns';
import { X, Plus, Trash2, Package, TrendingUp, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';
import AssignDeliveryModal from '@/components/modal/AssignDeliveryModal';
import React from 'react';
import Lottie from 'lottie-react';
import salesAnimation from '@/lib/lottie/sales.json';

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

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface WarehouseLocation {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  salePrice: string;
}

interface OrderLine {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  discount: string;
  warehouseLocationId: string;
  availableStock: number;
}

export default function SalesOrdersPage() {
  const { showAlert, showConfirm } = useAlert();
  const [showLoader, setShowLoader] = useState(true);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<any>(null);
  const itemsPerPage = 15;
  const [formData, setFormData] = useState({
    customerId: '',
    warehouseId: '',
    warehouseLocationId: '',
    expectedDeliveryDate: '',
    shippingAddress: '',
    notes: '',
  });
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [currentPage, searchTerm, customerFilter, sortBy]);

  useEffect(() => {
    fetchCustomers();
    fetchWarehouses();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(
        `/api/erp/sales/orders?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}&customerId=${customerFilter}&sort=${sortBy}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOrders(data.salesOrders || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch('/api/erp/sales/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses((data.warehouses || []).filter((w: any) => w.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchProducts = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts((data.products || []).filter((p: any) => p.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWarehouseLocations = async (warehouseId: string) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouseLocations(data.locations || []);
      } else {
        setWarehouseLocations([]);
      }
    } catch (error) {
      console.error('Error fetching warehouse locations:', error);
      setWarehouseLocations([]);
    }
  };

  const fetchStockLevel = async (productId: string, warehouseId: string, locationId: string) => {
    const token = getAuthToken();
    try {
      const params = new URLSearchParams({
        productId,
        warehouseId,
        ...(locationId && { locationId })
      });
      const response = await fetch(`/api/erp/inventory/stock-levels?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const stockLevel = data.stockLevels?.[0];
        return parseFloat(stockLevel?.quantityOnHand || '0');
      }
      return 0;
    } catch (error) {
      console.error('Error fetching stock level:', error);
      return 0;
    }
  };

  const toggleExpand = async (orderId: string) => {
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
      const response = await fetch(`/api/erp/sales/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data.salesOrder);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const handleAddLine = () => {
    if (!formData.warehouseId) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select a warehouse first' });
      return;
    }
    if (!formData.warehouseLocationId) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select a warehouse location first' });
      return;
    }
    setOrderLines([...orderLines, {
      productId: '',
      productName: '',
      quantity: '1',
      unitPrice: '0',
      taxRate: '18',
      discount: '0',
      warehouseLocationId: formData.warehouseLocationId,
      availableStock: 0,
    }]);
  };

  const handleRemoveLine = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const handleLineChange = async (index: number, field: keyof OrderLine, value: string) => {
    const updated = [...orderLines];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update product details when product is selected
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].productName = product.name;
        updated[index].unitPrice = product.salePrice;
      }
      // Fetch stock level using global warehouse location
      if (value && formData.warehouseId && formData.warehouseLocationId) {
        const stock = await fetchStockLevel(value, formData.warehouseId, formData.warehouseLocationId);
        updated[index].availableStock = stock;
      }
    }
    
    // Validate quantity
    if (field === 'quantity') {
      const qty = parseFloat(value || '0');
      if (qty > updated[index].availableStock) {
        showAlert({ 
          type: 'error', 
          title: 'Insufficient Stock', 
          message: `Only ${updated[index].availableStock} units available in stock` 
        });
        updated[index].quantity = updated[index].availableStock.toString();
      }
    }
    
    setOrderLines(updated);
  };

  const calculateTotal = () => {
    return orderLines.reduce((sum, line) => {
      const subtotal = parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0');
      const discountAmount = subtotal * (parseFloat(line.discount || '0') / 100);
      const afterDiscount = subtotal - discountAmount;
      const tax = afterDiscount * (parseFloat(line.taxRate || '0') / 100);
      return sum + afterDiscount + tax;
    }, 0);
  };

  const calculateSubtotal = () => {
    return orderLines.reduce((sum, line) => {
      return sum + (parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0'));
    }, 0);
  };

  const calculateTotalDiscount = () => {
    return orderLines.reduce((sum, line) => {
      const subtotal = parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0');
      return sum + (subtotal * (parseFloat(line.discount || '0') / 100));
    }, 0);
  };

  const calculateTotalTax = () => {
    return orderLines.reduce((sum, line) => {
      const subtotal = parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0');
      const discountAmount = subtotal * (parseFloat(line.discount || '0') / 100);
      const afterDiscount = subtotal - discountAmount;
      return sum + (afterDiscount * (parseFloat(line.taxRate || '0') / 100));
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (orderLines.length === 0) {
      showAlert({ type: 'error', title: 'Error', message: 'Please add at least one product to the order' });
      return;
    }

    const token = getAuthToken();
    try {
      const response = await fetch('/api/erp/sales/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: orderLines,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Sales order created successfully!' });
        resetForm();
        fetchOrders();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create sales order' });
      }
    } catch (error) {
      console.error('Error creating sales order:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create sales order' });
    }
  };

  const handleDeliver = async (orderId: string) => {
    const token = getAuthToken();

    showConfirm({
      title: 'Mark as Delivered',
      message: 'Mark this order as delivered? This will update inventory and sales history.',
      confirmText: 'Mark as Delivered',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/erp/sales/orders/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              status: 'delivered',
              deliveryDate: new Date().toISOString(),
            }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Order marked as delivered! Sales history updated.' });
            fetchOrders();
          } else {
            const error = await response.json();
            showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to update order' });
          }
        } catch (error) {
          console.error('Error updating order:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to update order' });
        }
      }
    });
  };

  const handleAssignDelivery = (order: any) => {
    // Prepare order data for delivery assignment
    setSelectedOrderForDelivery({
      id: order.id,
      orderNumber: order.soNumber,
      customerName: order.customer.name,
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
      toggleExpand(expandedRow); // Refresh expanded details
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormData({
      customerId: '',
      warehouseId: '',
      warehouseLocationId: '',
      expectedDeliveryDate: '',
      shippingAddress: '',
      notes: '',
    });
    setOrderLines([]);
    setSelectedProduct('');
    setWarehouseLocations([]);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="relative min-h-screen">
      {showLoader && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
          <div className="w-96 h-96">
            <Lottie animationData={salesAnimation} loop={true} />
          </div>
        </div>
      )}

      <div style={{ opacity: showLoader ? 0 : 1, transition: 'opacity 0.5s' }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Sales Orders</h2>
              <p className="text-sm text-gray-500 mt-1">Manage customer orders and deliveries</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Create Sales Order
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Draft Orders</div>
          <div className="text-2xl font-bold text-gray-900">
            {orders.filter(o => o.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Confirmed</div>
          <div className="text-2xl font-bold text-blue-600">
            {orders.filter(o => o.status === 'confirmed').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600">
            {orders.filter(o => o.status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Delivered</div>
          <div className="text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === 'delivered').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="text"
            placeholder="Search orders..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="customer_asc">Customer A-Z</option>
            <option value="customer_desc">Customer Z-A</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Sales Orders</h3>
          <div className="text-sm text-gray-600">
            Showing {orders.length} orders {totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading sales orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No sales orders found. Create your first sales order.
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
                    <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(order.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                         
                          {order.soNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(order.soDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.warehouse.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{(typeof order.totalAmount === 'string' ? parseFloat(order.totalAmount) : order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expandedRow === order.id ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
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
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && resetForm()}
        >
          <div className="bg-white rounded-xl max-w-4xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create Sales Order</h3>
                  <p className="text-sm text-slate-500 mt-1">Add a new customer order</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabels}>Customer *</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={modalLabels}>Warehouse *</label>
                  <select
                    value={formData.warehouseId}
                    onChange={(e) => {
                      const warehouseId = e.target.value;
                      setFormData({ ...formData, warehouseId, warehouseLocationId: '' });
                      if (warehouseId) {
                        fetchWarehouseLocations(warehouseId);
                      } else {
                        setWarehouseLocations([]);
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={modalLabels}>Warehouse Location *</label>
                  <select
                    value={formData.warehouseLocationId}
                    onChange={(e) => setFormData({ ...formData, warehouseLocationId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    required
                    disabled={!formData.warehouseId}
                  >
                    <option value="">Select Location</option>
                    {warehouseLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={modalLabels}>Expected Delivery Date</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                  />
                </div>

                <div>
                  <label className={modalLabels}>Shipping Address</label>
                  <input
                    type="text"
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="Enter shipping address"
                  />
                </div>
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800">Order Items</h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                {/* Order Lines Table - Always Visible */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase">Product *</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase w-24">Avail.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase w-24">Qty *</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase w-28">Unit Price</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase w-24">Disc %</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase w-24">Tax %</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase w-32">Amount</th>
                          <th className="px-3 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {orderLines.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No items added. Click "Add Item" to start.
                            </td>
                          </tr>
                        ) : (
                          orderLines.map((line, index) => {
                            const subtotal = parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0');
                            const discountAmount = subtotal * (parseFloat(line.discount || '0') / 100);
                            const afterDiscount = subtotal - discountAmount;
                            const tax = afterDiscount * (parseFloat(line.taxRate || '0') / 100);
                            const lineTotal = afterDiscount + tax;

                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <select
                                    value={line.productId}
                                    onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                  >
                                    <option value="">Select Product</option>
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <div className={`text-sm text-center font-medium ${
                                    line.availableStock > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {line.availableStock > 0 ? line.availableStock : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                    max={line.availableStock || undefined}
                                    step="1"
                                    required
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={line.unitPrice}
                                    onChange={(e) => handleLineChange(index, 'unitPrice', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={line.discount}
                                    onChange={(e) => handleLineChange(index, 'discount', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="100"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={line.taxRate}
                                    onChange={(e) => handleLineChange(index, 'taxRate', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="100"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₹{lineTotal.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLine(index)}
                                    className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  {orderLines.length > 0 && (
                    <div className="bg-gray-50 border-t">
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-semibold text-gray-900">₹{calculateSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Discount:</span>
                          <span className="font-semibold text-red-600">- ₹{calculateTotalDiscount().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Tax:</span>
                          <span className="font-semibold text-gray-900">₹{calculateTotalTax().toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="text-base font-bold text-gray-900">Grand Total:</span>
                          <span className="text-lg font-bold text-blue-600">₹{calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={modalLabels}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                  rows={3}
                  placeholder="Additional notes or instructions..."
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Assignment Modal */}
      <AssignDeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => {
          setShowDeliveryModal(false);
          setSelectedOrderForDelivery(null);
        }}
        onSuccess={handleDeliveryAssignmentSuccess}
        salesOrder={selectedOrderForDelivery}
      />
    </div>
      </div>
    </div>
  );
}
