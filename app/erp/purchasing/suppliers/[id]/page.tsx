'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAuthToken } from '@/lib/utils/token';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { createPortal } from 'react-dom';
import { useAlert } from '@/components/common/CustomAlert';
import QuotationViewModal from '@/components/modal/QuotationViewModal';
import EditSupplierModal from '@/components/modal/EditSupplierModal';
import { ChevronDown } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  taxId: string;
  paymentTerms: number;
  currencyCode: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  contacts?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
    isPrimary: boolean;
  }>;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  totalAmount: string;
  expectedDeliveryDate: string;
  lines: any[];
}

interface RFQ {
  id: string;
  rfqNumber: string;
  rfqDate: string;
  title: string;
  status: string;
  deadlineDate: string;
}

interface Invoice {
  id: string;
  // ERP vendor invoice fields
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: string;
  status?: string;
  // Supplier portal invoice fields
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: string;
  payment_status?: string;
}

interface Quotation {
  id: string;
  submission_number: string;
  submission_date: string;
  status: string;
  total_amount: string;
  valid_until: string;
  delivery_time_in_days: number;
  rfq_number: string;
  rfq_title: string;
  quotation_type: string;
  file_url?: string;
  file_name?: string;
}

export default function SupplierDetailPage() {
  const { showAlert, showConfirm } = useAlert();
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pos' | 'rfqs' | 'quotations' | 'invoices' | 'receipts' | 'products'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  useEffect(() => {
    if (supplierId) {
      fetchSupplierDetails();
    }
  }, [supplierId]);

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/suppliers/${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSupplier(data.supplier);
        setPurchaseOrders(data.purchaseOrders || []);
        setRfqs(data.rfqs || []);
        setQuotations(data.quotations || []);
        setInvoices(data.invoices || []);
        setReceipts(data.receipts || []);
        setStatistics(data.statistics);
        setProducts(data.products || []);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch supplier details' });
      }
    } catch (error) {
      console.error('Failed to fetch supplier details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch supplier details' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (supplier) {
      setEditFormData({
        name: supplier.name,
        code: supplier.code,
        email: supplier.email,
        phone: supplier.phone,
        website: supplier.website,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        country: supplier.country,
        postalCode: supplier.postalCode,
        taxId: supplier.taxId,
        paymentTerms: supplier.paymentTerms,
        currencyCode: supplier.currencyCode,
        notes: supplier.notes,
        isActive: supplier.isActive,
      });
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        setShowEditModal(false);
        fetchSupplierDetails();
        showAlert({ type: 'success', title: 'Success', message: 'Supplier updated successfully' });
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to update supplier' });
      }
    } catch (error) {
      console.error('Failed to update supplier:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update supplier' });
    }
  };

  const handleAcceptQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Accept Quotation',
      message: 'Are you sure you want to accept this quotation?',
      confirmText: 'Accept',
      confirmVariant: 'primary',
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
          const response = await fetch('/api/erp/purchasing/supplier-quotations', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              quotationId,
              status: 'accepted',
            }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Quotation accepted successfully!' });
            setShowQuotationModal(false);
            fetchSupplierDetails();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error accepting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to accept quotation' });
        }
      },
    });
  };

  const handleRejectQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Reject Quotation',
      message: 'Are you sure you want to reject this quotation? This will notify the supplier.',
      confirmText: 'Reject',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
          const response = await fetch('/api/erp/purchasing/supplier-quotations', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              quotationId,
              status: 'rejected',
              rejectionNotes: 'Rejected by customer',
            }),
          });

          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'Quotation rejected' });
            setShowQuotationModal(false);
            fetchSupplierDetails();
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error rejecting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to reject quotation' });
        }
      },
    });
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      partially_received: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      in_progress: 'bg-purple-100 text-purple-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getQuotationStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Loading supplier details...</p>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Supplier not found</p>
          <button
            onClick={() => router.push('/erp/purchasing/suppliers')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Suppliers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 italic">{supplier.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Supplier Code: {supplier.code}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleEditClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Edit
          </button>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              supplier.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {supplier.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Purchase Orders</div>
          <div className="text-2xl font-bold text-gray-900">{statistics?.totalPurchaseOrders || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Pending POs</div>
          <div className="text-2xl font-bold text-yellow-600">{statistics?.pendingPurchaseOrders || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">RFQs Sent</div>
          <div className="text-2xl font-bold text-purple-600">{statistics?.totalRFQs || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Purchase Value</div>
          <div className="text-2xl font-bold text-green-600">
            ₹{(parseFloat(statistics?.totalPurchaseValue || '0') || 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          {['overview', 'pos', 'products', 'rfqs', 'quotations', 'invoices', 'receipts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-1 font-medium text-sm ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'pos' && `Purchase Orders (${purchaseOrders.length})`}
              {tab === 'products' && `Products (${products.length})`}
              {tab === 'rfqs' && `RFQs (${rfqs.length})`}
              {tab === 'quotations' && `Quotations (${quotations.length})`}
              {/* {tab === 'invoices' && `Invoices (${invoices.length})`} */}
              {tab === 'receipts' && `Receipts (${receipts.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Email</div>
                <div className="text-sm font-medium">{supplier.email || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Phone</div>
                <div className="text-sm font-medium">{supplier.phone || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Website</div>
                <div className="text-sm font-medium">{supplier.website || '—'}</div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Street Address</div>
                <div className="text-sm font-medium">{supplier.address || '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">City</div>
                  <div className="text-sm font-medium">{supplier.city || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">State</div>
                  <div className="text-sm font-medium">{supplier.state || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Country</div>
                  <div className="text-sm font-medium">{supplier.country || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Postal Code</div>
                  <div className="text-sm font-medium">{supplier.postalCode || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Financial Information</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Tax ID / GST</div>
                <div className="text-sm font-medium">{supplier.taxId || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Payment Terms</div>
                <div className="text-sm font-medium">{supplier.paymentTerms} days</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Currency</div>
                <div className="text-sm font-medium">{supplier.currencyCode}</div>
              </div>
            </div>
          </div>

          {/* Contact Persons */}
          {supplier.contacts && supplier.contacts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Persons</h3>
              <div className="space-y-3">
                {supplier.contacts.map((contact) => (
                  <div key={contact.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{contact.name}</div>
                        <div className="text-xs text-gray-500">{contact.position}</div>
                      </div>
                      {contact.isPrimary && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {contact.email} • {contact.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {supplier.notes && (
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pos' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Purchase Orders</h3>
            <p className="text-sm text-gray-500">{purchaseOrders.length} orders found</p>
          </div>
          <div className="overflow-x-auto">
            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-500 text-lg mb-2">No purchase orders found</p>
                <p className="text-gray-400 text-sm">Purchase orders will appear here once created.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="font-semibold text-gray-700">PO Number</TableHead>
                    <TableHead className="font-semibold text-gray-700">Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Expected Delivery</TableHead>
                    <TableHead className="font-semibold text-gray-700">Items</TableHead>
                    <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <React.Fragment key={po.id}>
                      <TableRow className="hover:bg-blue-50 cursor-pointer transition-colors">
                        <TableCell className="font-medium text-gray-900">{po.poNumber}</TableCell>
                        <TableCell className="text-sm">{new Date(po.poDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">
                          {po.expectedDeliveryDate
                            ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{po.lines?.length || 0}</TableCell>
                        <TableCell className="font-semibold text-gray-900 text-sm">
                          ₹{parseFloat(po.totalAmount).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              po.status
                            )}`}
                          >
                            {po.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => toggleRow(po.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                          >
                            <ChevronDown
                              className={`w-5 h-5 text-gray-600 transition-transform ${
                                expandedRows.has(po.id) ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(po.id) && (
                        <TableRow className="bg-gray-50">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-6 space-y-4">
                              {/* PO Details Header */}
                              <div className="grid grid-cols-3 gap-4 border-b border-gray-200 pb-4">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">PO Number</div>
                                  <div className="font-semibold text-gray-900">{po.poNumber}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">PO Date</div>
                                  <div className="font-medium text-gray-900">
                                    {new Date(po.poDate).toLocaleDateString()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Expected Delivery</div>
                                  <div className="font-medium text-gray-900">
                                    {po.expectedDeliveryDate
                                      ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                                      : '—'}
                                  </div>
                                </div>
                              </div>

                              {/* Line Items */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                          Product
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                          SKU
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">
                                          Quantity
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">
                                          Unit Price
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {po.lines && po.lines.length > 0 ? (
                                        po.lines.map((line: any, index: number) => (
                                          <tr key={index} className="hover:bg-white">
                                            <td className="px-4 py-3">
                                              <div className="font-medium text-gray-900">
                                                {line.product?.name || line.productName || '—'}
                                              </div>
                                              {line.description && (
                                                <div className="text-xs text-gray-500">{line.description}</div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                              {line.product?.sku || line.productSku || line.sku || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                              {line.quantityOrdered || line.quantity || 0}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                              ₹{parseFloat(line.unitPrice || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold">
                                              ₹
                                              {(
                                                (line.quantityOrdered || line.quantity || 0) *
                                                parseFloat(line.unitPrice || 0)
                                              ).toLocaleString('en-IN')}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            No line items found
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Total Section */}
                              <div className="flex justify-end pt-4 border-t border-gray-200">
                                <div className="w-64 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-medium">
                                      ₹{parseFloat(po.totalAmount || '0').toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-base font-semibold pt-2 border-t">
                                    <span>Total Amount:</span>
                                    <span className="text-blue-600">
                                      ₹{parseFloat(po.totalAmount || '0').toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Supplier Products</h3>
            <p className="text-sm text-gray-500">{products.length} products linked to this supplier</p>
          </div>
          <div className="overflow-x-auto">
            {products.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-500 text-lg mb-2">No products linked</p>
                <p className="text-gray-400 text-sm">Products associated with this supplier will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="font-semibold text-gray-700">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">SKU</TableHead>
                    <TableHead className="font-semibold text-gray-700">Supplier Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">Supplier SKU</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Cost Price</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Lead Time (Days)</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Primary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover:bg-blue-50 transition-colors">
                      <TableCell className="font-medium text-gray-900">{product.productName}</TableCell>
                      <TableCell className="text-sm text-gray-600">{product.productSku}</TableCell>
                      <TableCell className="text-sm">{product.supplierProductName || '—'}</TableCell>
                      <TableCell className="text-sm">{product.supplierSku || '—'}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        ₹{parseFloat(product.costPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">{product.leadTimeDays || '—'}</TableCell>
                      <TableCell className="text-center">
                        {product.isPrimary ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Primary
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rfqs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Request for Quotations</h3>
        <p className="text-sm text-gray-500">{rfqs.length} RFQs found</p>
      </div>
      <div className="overflow-x-auto">
        {rfqs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500 text-lg mb-2">No RFQs sent</p>
            <p className="text-gray-400 text-sm">RFQs sent to this supplier will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700">RFQ Number</TableHead>
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Title</TableHead>
                <TableHead className="font-semibold text-gray-700">Deadline</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfqs.map((rfq) => (
                <React.Fragment key={rfq.id}>
                  <TableRow className="hover:bg-blue-50 cursor-pointer transition-colors">
                    <TableCell className="font-medium text-gray-900">{rfq.rfqNumber}</TableCell>
                    <TableCell className="text-sm">{new Date(rfq.rfqDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{rfq.title}</TableCell>
                    <TableCell className="text-sm">
                      {rfq.deadlineDate ? new Date(rfq.deadlineDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          rfq.status
                        )}`}
                      >
                        {rfq.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => toggleRow(rfq.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown
                          className={`w-5 h-5 text-gray-600 transition-transform ${
                            expandedRows.has(rfq.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(rfq.id) && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={6} className="p-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">RFQ Number</div>
                              <div className="font-semibold text-gray-900">{rfq.rfqNumber}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">RFQ Date</div>
                              <div className="font-medium text-gray-900">
                                {new Date(rfq.rfqDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Deadline</div>
                              <div className="font-medium text-gray-900">
                                {rfq.deadlineDate ? new Date(rfq.deadlineDate).toLocaleDateString() : '—'}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Title</div>
                            <div className="font-medium text-gray-900">{rfq.title}</div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )}

  {activeTab === 'quotations' && (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Supplier Quotations</h3>
        <p className="text-sm text-gray-500">{quotations.length} quotations found</p>
      </div>
      <div className="overflow-x-auto">
        {quotations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">💼</div>
            <p className="text-gray-500 text-lg mb-2">No quotations submitted</p>
            <p className="text-gray-400 text-sm">Quotations from this supplier will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700">Submission #</TableHead>
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">RFQ Reference</TableHead>
                <TableHead className="font-semibold text-gray-700">Valid Until</TableHead>
                <TableHead className="font-semibold text-gray-700">Delivery Days</TableHead>
                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((quotation) => (
                <TableRow key={quotation.id} className="hover:bg-blue-50 transition-colors">
                  <TableCell className="font-medium text-gray-900">{quotation.submission_number}</TableCell>
                  <TableCell className="text-sm">{new Date(quotation.submission_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {quotation.rfq_number ? (
                      <div>
                        <div className="font-medium text-sm">{quotation.rfq_number}</div>
                        <div className="text-xs text-gray-500">{quotation.rfq_title}</div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {quotation.valid_until
                      ? new Date(quotation.valid_until).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {quotation.delivery_time_in_days ? `${quotation.delivery_time_in_days} days` : '—'}
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 text-sm">
                    ₹{parseFloat(quotation.total_amount || '0').toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQuotationStatusColor(
                        quotation.status
                      )}`}
                    >
                      {quotation.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedQuotation(quotation);
                          setShowQuotationModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        View
                      </button>
                      {quotation.quotation_type === 'file_upload' && quotation.file_url && (
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = quotation.file_url!;
                            link.download = quotation.file_name || 'quotation-file';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Download
                        </button>
                      )}
                      {(quotation.status === 'submitted' || quotation.status === 'under_review') && (
                        <>
                          <button
                            onClick={() => handleAcceptQuotation(quotation.id)}
                            className="text-green-600 hover:text-green-700 text-xs font-medium"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectQuotation(quotation.id)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )}

  {/* {activeTab === 'invoices' && (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Purchase Invoices</h3>
        <p className="text-sm text-gray-500">{invoices.length} invoices found</p>
      </div>
      <div className="overflow-x-auto">
        {invoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">🧾</div>
            <p className="text-gray-500 text-lg mb-2">No invoices found</p>
            <p className="text-gray-400 text-sm">Invoices from this supplier will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700">Invoice Number</TableHead>
                <TableHead className="font-semibold text-gray-700">Invoice Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Due Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                // Handle both ERP vendor invoices and supplier portal invoices
                const invoiceNumber = invoice.invoice_number || '-';
                const invoiceDate = invoice.invoice_date;
                const dueDate = invoice.due_date;
                const totalAmount = invoice.total_amount || '0';
                // vendor_invoices use 'status', supplier_invoices use 'payment_status'
                const status = invoice.status || invoice.payment_status || 'draft';
                
                return (
                  <React.Fragment key={invoice.id}>
                    <TableRow className="hover:bg-blue-50 cursor-pointer transition-colors">
                      <TableCell className="font-medium text-gray-900">{invoiceNumber}</TableCell>
                      <TableCell className="text-sm">
                        {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dueDate ? new Date(dueDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 text-sm">
                        ₹{parseFloat(totalAmount).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => toggleRow(invoice.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                        >
                          <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${
                              expandedRows.has(invoice.id) ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(invoice.id) && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={6} className="p-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Invoice Number</div>
                                <div className="font-semibold text-gray-900">{invoiceNumber}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Invoice Date</div>
                                <div className="font-medium text-gray-900">
                                  {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Due Date</div>
                                <div className="font-medium text-gray-900">
                                  {dueDate ? new Date(dueDate).toLocaleDateString() : '-'}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                                <div className="font-semibold text-gray-900 text-lg">
                                  ₹{parseFloat(totalAmount).toLocaleString('en-IN')}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Payment Status</div>
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                    status
                                  )}`}
                                >
                                  {status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )} */}

  {activeTab === 'receipts' && (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Payment Receipts</h3>
        <p className="text-sm text-gray-500">{receipts.length} receipts found</p>
      </div>
      <div className="overflow-x-auto">
        {receipts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-6xl mb-4">🧾</div>
            <p className="text-gray-500 text-lg mb-2">No receipts found</p>
            <p className="text-gray-400 text-sm">Payment receipts for this supplier will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700">Receipt Number</TableHead>
                <TableHead className="font-semibold text-gray-700">Receipt Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Invoice Number</TableHead>
                <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="font-semibold text-gray-700">Payment Method</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.id} className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <TableCell className="font-medium text-gray-900">{receipt.receipt_number}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell className="text-sm">{receipt.invoice_number || '-'}</TableCell>
                  <TableCell className="font-semibold text-gray-900 text-sm">
                    ₹{parseFloat(receipt.amount || 0).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-sm">{receipt.payment_method || '-'}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        receipt.status === 'downloaded'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {receipt.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={async () => {
                        try {
                          const token = getAuthToken();
                          const response = await fetch(
                            `/api/supplier-portal/receipts/${receipt.id}/download`,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );

                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `receipt-${receipt.receipt_number}.html`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            showAlert({
                              type: 'success',
                              title: 'Success',
                              message: 'Receipt downloaded successfully',
                            });
                            fetchSupplierDetails();
                          } else {
                            showAlert({
                              type: 'error',
                              title: 'Error',
                              message: 'Failed to download receipt',
                            });
                          }
                        } catch (error) {
                          console.error('Error downloading receipt:', error);
                          showAlert({
                            type: 'error',
                            title: 'Error',
                            message: 'Failed to download receipt',
                          });
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      Download
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )}

  {/* Edit Supplier Modal */}
  <EditSupplierModal
    isOpen={showEditModal}
    editFormData={editFormData}
    onClose={() => setShowEditModal(false)}
    onSubmit={handleEditSubmit}
    onChange={setEditFormData}
  />

  {/* Quotation View Modal */}
  {selectedQuotation && (
    <QuotationViewModal
      isOpen={showQuotationModal}
      quotation={{
        ...selectedQuotation,
        supplier_name: supplier?.name || '',
        supplier_code: supplier?.code || '',
      }}
      onClose={() => {
        setShowQuotationModal(false);
        setSelectedQuotation(null);
      }}
      onAccept={() => handleAcceptQuotation(selectedQuotation.id)}
      onReject={() => handleRejectQuotation(selectedQuotation.id)}
      showActions={
        selectedQuotation.status === 'submitted' || selectedQuotation.status === 'under_review'
      }
    />
  )}
</div>
  )}