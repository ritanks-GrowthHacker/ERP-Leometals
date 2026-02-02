'use client';

import { useState, useEffect } from 'react';
import VendorInvoiceModal from '@/components/modal/VendorInvoiceModal';
import SupplierInvoiceViewModal from '@/components/modal/SupplierInvoiceViewModal';
import MarkPaidModal from '@/components/modal/MarkPaidModal';
import { Input, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  payment_status: string;
  total_amount: string;
  paid_amount: string;
  supplier_name: string;
  supplier_code: string;
  quotation_number?: string;
  rfq_number?: string;
}

interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: string;
  amountPaid: string;
  supplier: {
    name: string;
  };
  purchaseOrder?: {
    poNumber: string;
  };
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  totalAmount: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface InvoiceLine {
  productId: string;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  discountPercentage: string;
  lineTotal: number;
}

export default function InvoicesPage() {
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<'vendor' | 'supplier'>('supplier'); // Default to supplier invoices
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [formData, setFormData] = useState({
    supplierId: '',
    purchaseOrderId: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    shippingCharges: '0',
    discountAmount: '0',
    notes: '',
  });

  useEffect(() => {
    fetchVendorInvoices();
    fetchSupplierInvoices();
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchProducts();
  }, []);

  const fetchVendorInvoices = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/invoices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVendorInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching vendor invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierInvoices = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-invoices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSupplierInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching supplier invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/invoices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVendorInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
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

  const fetchPurchaseOrders = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data.purchaseOrders || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
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
    setInvoiceLines([...invoiceLines, {
      productId: '',
      productName: '',
      description: '',
      quantity: '1',
      unitPrice: '0',
      taxRate: '0',
      discountPercentage: '0',
      lineTotal: 0,
    }]);
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...invoiceLines];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].productName = product.name;
        updated[index].description = product.name;
      }
    }
    
    // Calculate line total: qty * price * (1 - discount/100) * (1 + tax/100)
    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unitPrice) || 0;
    const discount = parseFloat(updated[index].discountPercentage) || 0;
    const tax = parseFloat(updated[index].taxRate) || 0;
    const subtotal = qty * price * (1 - discount / 100);
    updated[index].lineTotal = subtotal * (1 + tax / 100);
    
    setInvoiceLines(updated);
  };

  const removeLineItem = (index: number) => {
    setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = invoiceLines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const discount = parseFloat(line.discountPercentage) || 0;
      return sum + (qty * price * (1 - discount / 100));
    }, 0);
    
    const taxAmount = invoiceLines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const discount = parseFloat(line.discountPercentage) || 0;
      const tax = parseFloat(line.taxRate) || 0;
      const lineSubtotal = qty * price * (1 - discount / 100);
      return sum + (lineSubtotal * tax / 100);
    }, 0);
    
    const shipping = parseFloat(formData.shippingCharges) || 0;
    const invoiceDiscount = parseFloat(formData.discountAmount) || 0;
    
    return { 
      subtotal, 
      taxAmount, 
      shipping,
      invoiceDiscount,
      total: subtotal + taxAmount + shipping - invoiceDiscount 
    };
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || !formData.invoiceNumber || invoiceLines.length === 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in all required fields and add at least one line item' });
      return;
    }
    
    try {
      const token = getAuthToken();
      const totals = calculateTotals();
      
      const response = await fetch('/api/erp/purchasing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          purchaseOrderId: formData.purchaseOrderId || null,
          invoiceNumber: formData.invoiceNumber,
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          shippingCharges: parseFloat(formData.shippingCharges),
          discountAmount: parseFloat(formData.discountAmount),
          notes: formData.notes,
          lines: invoiceLines.map(line => ({
            productId: line.productId,
            description: line.description,
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.unitPrice),
            taxRate: parseFloat(line.taxRate),
            discountPercentage: parseFloat(line.discountPercentage),
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Invoice created successfully!' });
        setShowCreateModal(false);
        resetForm();
        fetchInvoices();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to create invoice' });
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create invoice' });
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      purchaseOrderId: '',
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: '',
      shippingCharges: '0',
      discountAmount: '0',
      notes: '',
    });
    setInvoiceLines([]);
  };

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleMarkPaid = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowMarkPaidModal(true);
  };

  const handlePayWithRazorpay = async (invoice: any) => {
    try {
      const token = getAuthToken();
      
      // Calculate balance amount
      const totalAmount = parseFloat(invoice.total_amount);
      const paidAmount = parseFloat(invoice.paid_amount || '0');
      const balanceAmount = totalAmount - paidAmount;

      if (balanceAmount <= 0) {
        showAlert({ type: 'error', title: 'Error', message: 'Invoice already paid' });
        return;
      }

      // Create Razorpay order
      const orderResponse = await fetch('/api/payment/supplier/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        showAlert({ type: 'error', title: 'Error', message: orderData.error || 'Failed to create payment order' });
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'ERP System',
        description: `Payment for Invoice ${invoice.invoice_number}`,
        order_id: orderData.order.id,
        handler: async function (response: any) {
          try {
            const verifyResponse = await fetch('/api/payment/supplier/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                invoiceId: invoice.id,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.success) {
              showAlert({ type: 'success', title: 'Success', message: 'Payment successful! Invoice updated.' });
              fetchSupplierInvoices();
            } else {
              showAlert({ type: 'error', title: 'Error', message: verifyData.error || 'Payment verification failed' });
            }
          } catch (err) {
            showAlert({ type: 'error', title: 'Error', message: 'Payment verification failed' });
          }
        },
        prefill: {
          name: invoice.supplier_name || '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#3b82f6',
        },
        modal: {
          ondismiss: function () {
            console.log('Payment cancelled');
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Error initiating payment:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to initiate payment' });
    }
  };

  const handleMarkPaidSuccess = () => {
    fetchSupplierInvoices();
    fetchVendorInvoices();
  };

  // Get current invoices based on active tab
  const currentInvoices = tab === 'supplier' ? supplierInvoices : vendorInvoices;
  const statusField = tab === 'supplier' ? 'payment_status' : 'status';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const totals = calculateTotals();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Vendor Invoices</h2>
          <p className="text-sm text-gray-500 mt-1">Manage supplier bills and payments</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Record Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setTab('supplier')}
            className={`px-6 py-3 font-medium ${tab === 'supplier' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Supplier Invoices ({supplierInvoices.length})
          </button>
          <button
            onClick={() => setTab('vendor')}
            className={`px-6 py-3 font-medium ${tab === 'vendor' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Vendor Invoices ({vendorInvoices.length})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {currentInvoices.filter((i: any) => (tab === 'supplier' ? i.payment_status === 'pending' : i.status === 'pending')).length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Approved/Paid</div>
          <div className="text-2xl font-bold text-blue-600">
            {currentInvoices.filter((i: any) => (tab === 'supplier' ? i.payment_status === 'paid' : i.status === 'approved')).length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Paid</div>
          <div className="text-2xl font-bold text-green-600">
            {currentInvoices.filter((i: any) => (tab === 'supplier' ? i.payment_status === 'paid' : i.status === 'paid')).length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Overdue</div>
          <div className="text-2xl font-bold text-red-600">
            {currentInvoices.filter((i: any) => (tab === 'supplier' ? i.payment_status === 'overdue' : i.status === 'overdue')).length}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Invoices</h3>
          <input placeholder="Search invoices..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading invoices...
            </div>
          ) : currentInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No invoices found. Record your first invoice.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PO Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentInvoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tab === 'supplier' ? invoice.invoice_number : invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(tab === 'supplier' ? invoice.invoice_date : invoice.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tab === 'supplier' ? invoice.supplier_name : invoice.supplier.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tab === 'supplier' ? (invoice.quotation_number || '-') : (invoice.purchaseOrder?.poNumber || '-')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(tab === 'supplier' ? invoice.due_date : invoice.dueDate) 
                        ? new Date(tab === 'supplier' ? invoice.due_date : invoice.dueDate).toLocaleDateString() 
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{parseFloat(tab === 'supplier' ? invoice.total_amount : invoice.totalAmount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{parseFloat(tab === 'supplier' ? (invoice.paid_amount || 0) : invoice.amountPaid).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tab === 'supplier' ? invoice.payment_status : invoice.status)}`}>
                        {(tab === 'supplier' ? invoice.payment_status : invoice.status).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                        {tab === 'supplier' && invoice.payment_status !== 'paid' && (
                          <>
                            <button 
                              onClick={() => handlePayWithRazorpay(invoice)}
                              className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                              title="Pay with Razorpay"
                            >
                              💳 Pay
                            </button>
                            <button 
                              onClick={() => handleMarkPaid(invoice)}
                              className="text-green-600 hover:text-green-800 font-medium text-xs"
                            >
                              Mark Paid
                            </button>
                          </>
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

      {/* Vendor Invoice Modal */}
      <VendorInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchInvoices();
        }}
      />

      {/* Supplier Invoice View Modal */}
      {showViewModal && selectedInvoice && (
        <SupplierInvoiceViewModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onMarkPaid={() => {
            setShowViewModal(false);
            handleMarkPaid(selectedInvoice);
          }}
        />
      )}

      {/* Mark as Paid Modal */}
      {showMarkPaidModal && selectedInvoice && (
        <MarkPaidModal
          isOpen={showMarkPaidModal}
          onClose={() => {
            setShowMarkPaidModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onSuccess={handleMarkPaidSuccess}
        />
      )}
    </div>
  );
}
