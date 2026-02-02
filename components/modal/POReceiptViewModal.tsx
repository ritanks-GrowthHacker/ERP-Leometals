'use client';

import { useState, useEffect } from 'react';
import { X, Package, Calendar, User, FileText, CheckCircle, XCircle, Building2, Warehouse } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface POReceiptViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: string;
  onAttachSupplier?: () => void;
}

interface ReceiptLine {
  id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: string;
  quantity_pending: string;
  quantity_received: string;
  unit_price: string;
  notes: string;
}

interface Receipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  status: string;
  supplier_attached: boolean;
  notes: string;
  po_number: string;
  purchase_order_id: string;
  po_date: string;
  po_total_amount: string;
  supplier_name: string;
  supplier_id: string;
  supplier_email: string;
  supplier_phone: string;
  warehouse_name: string;
  warehouse_id: string;
  lines: ReceiptLine[];
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export default function POReceiptViewModal({
  isOpen,
  onClose,
  receiptId,
  onAttachSupplier,
}: POReceiptViewModalProps) {
  const { showAlert } = useAlert();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [warehouseSearch, setWarehouseSearch] = useState('');

  useEffect(() => {
    if (isOpen && receiptId) {
      fetchReceipt();
      fetchSuppliers();
      fetchWarehouses();
    }
  }, [isOpen, receiptId]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/erp/purchasing/po-receipts/${receiptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReceipt(data.receipt);
        if (data.receipt.supplier_id) setSelectedSupplierId(data.receipt.supplier_id);
        if (data.receipt.warehouse_id) setSelectedWarehouseId(data.receipt.warehouse_id);
      }
    } catch (error) {
      console.error('Error fetching receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
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
      if (!token) return;
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleAttachAndSend = async () => {
    if (!receipt || !selectedSupplierId || !selectedWarehouseId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select both supplier and warehouse' });
      return;
    }

    try {
      setUpdating(true);
      const token = getAuthToken();
      if (!token) return;
      const response = await fetch(`/api/erp/purchasing/po-receipts/${receiptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          action: 'attach_supplier',
          supplierId: selectedSupplierId,
          warehouseId: selectedWarehouseId
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Receipt sent to supplier and warehouse manager!' });
        await fetchReceipt();
        if (onAttachSupplier) onAttachSupplier();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to send receipt' });
      }
    } catch (error) {
      console.error('Error attaching supplier:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send receipt' });
    } finally {
      setUpdating(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
    w.code.toLowerCase().includes(warehouseSearch.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      sent: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Sent to Supplier' },
      received: { bg: 'bg-green-100', text: 'text-green-800', label: 'Received' },
      completed: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Completed' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">PO Goods Receipt</h2>
            <p className="text-purple-100 text-sm mt-1">
              {loading ? 'Loading...' : receipt?.receipt_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading receipt details...</p>
            </div>
          </div>
        ) : receipt ? (
          <div className="flex-1 overflow-y-auto">
            {/* Receipt Info */}
            <div className="p-6 space-y-6">
              {/* Status and Actions */}
              <div className="space-y-4">
                {/* Supplier and Warehouse Selection (if not attached) */}
                {!receipt.supplier_attached && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      Attach Supplier & Warehouse
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Supplier Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Supplier *
                        </label>
                        <input
                          type="text"
                          placeholder="Search supplier..."
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">-- Select Supplier --</option>
                          {filteredSuppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name} {supplier.email && `(${supplier.email})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Warehouse Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Warehouse *
                        </label>
                        <input
                          type="text"
                          placeholder="Search warehouse..."
                          value={warehouseSearch}
                          onChange={(e) => setWarehouseSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <select
                          value={selectedWarehouseId}
                          onChange={(e) => setSelectedWarehouseId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">-- Select Warehouse --</option>
                          {filteredWarehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} ({warehouse.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleAttachAndSend}
                      disabled={updating || !selectedSupplierId || !selectedWarehouseId}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {updating ? 'Sending...' : 'Attach & Send Email'}
                    </button>
                    <p className="text-xs text-gray-600 text-center">
                      Email will be sent to supplier and warehouse manager
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div>{getStatusBadge(receipt.status)}</div>
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <FileText className="w-4 h-4" />
                      <span>Purchase Order</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">{receipt.po_number}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      PO Date: {new Date(receipt.po_date).toLocaleDateString('en-IN')}
                    </div>
                    <div className="text-sm text-gray-600">
                      Total: ₹{parseFloat(receipt.po_total_amount).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>Receipt Details</span>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>Receipt Date: {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}</div>
                      <div>Warehouse: {receipt.warehouse_name}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Package className="w-4 h-4" />
                      <span>Supplier Information</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">{receipt.supplier_name}</div>
                    {receipt.supplier_email && (
                      <div className="text-sm text-gray-600 mt-1">{receipt.supplier_email}</div>
                    )}
                    {receipt.supplier_phone && (
                      <div className="text-sm text-gray-600">{receipt.supplier_phone}</div>
                    )}
                    <div className="mt-2">
                      {receipt.supplier_attached ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          <CheckCircle className="w-3 h-3" />
                          Supplier Notified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          <XCircle className="w-3 h-3" />
                          Not Attached
                        </span>
                      )}
                    </div>
                  </div>

                  {receipt.notes && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <FileText className="w-4 h-4" />
                        <span>Notes</span>
                      </div>
                      <div className="text-sm text-gray-700">{receipt.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Receipt Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">SKU</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Ordered</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Pending</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Received</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {receipt.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{line.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{line.product_sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{line.quantity_ordered}</td>
                          <td className="px-4 py-3 text-sm text-yellow-600 text-right font-medium">{line.quantity_pending}</td>
                          <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">{line.quantity_received}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            ₹{parseFloat(line.unit_price).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                            ₹{(parseFloat(line.quantity_ordered) * parseFloat(line.unit_price)).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12">
            <p className="text-gray-500">Receipt not found</p>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
