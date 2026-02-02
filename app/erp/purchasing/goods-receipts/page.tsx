'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import POReceiptViewModal from '@/components/modal/POReceiptViewModal';
import { useAlert } from '@/components/common/CustomAlert';

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  receipt_number?: string; // For supplier invoice receipts
  receiptDate: string;
  created_at?: string; // For supplier invoice receipts
  receipt_date?: string;
  status: string;
  purchaseOrder?: {
    poNumber: string;
  };
  po_number?: string;
  supplier?: {
    name: string;
  };
  supplier_name?: string;
  warehouse?: {
    name: string;
  };
  warehouse_name?: string;
  invoice_id?: string; // For supplier invoice receipts
  invoice_number?: string;
  receipt_type?: string; // 'purchase_order' or 'supplier_invoice'
  amount?: string;
  payment_method?: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  lines: POLine[];
}

interface POLine {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  quantityOrdered: string;
  quantityReceived: string;
}

interface ReceiptLine {
  purchaseOrderLineId: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityAlreadyReceived: number;
  quantityReceived: string;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason: string;
  warehouseLocationId: string;
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
}

export default function GoodsReceiptsPage() {
  const { showAlert } = useAlert();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [poReceipts, setPOReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [poReceiptsLoading, setPOReceiptsLoading] = useState(true);
  const [showPOReceiptModal, setShowPOReceiptModal] = useState(false);
  const [selectedPOReceiptId, setSelectedPOReceiptId] = useState<string>('');

  useEffect(() => {
    fetchReceipts();
    fetchPOReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/goods-receipts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReceipts(data.goodsReceipts || []);
      }
    } catch (error) {
      console.error('Error fetching goods receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPOReceipts = async () => {
    try {
      setPOReceiptsLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/po-receipts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPOReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching PO receipts:', error);
    } finally {
      setPOReceiptsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      received: 'bg-blue-100 text-blue-800',
      quality_check: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      downloaded: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      partially_accepted: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipts</h1>
          <p className="text-gray-600 mt-1">View and download goods receipts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Receipts</div>
          <div className="text-2xl font-bold text-gray-900">
            {receipts.length + poReceipts.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">PO Goods Receipts</div>
          <div className="text-2xl font-bold text-blue-600">
            {poReceipts.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Invoice Receipts</div>
          <div className="text-2xl font-bold text-teal-600">
            {receipts.filter(r => r.receipt_type === 'supplier_invoice').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Accepted</div>
          <div className="text-2xl font-bold text-green-600">
            {receipts.filter(r => r.status === 'accepted' || r.status === 'downloaded').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {receipts.filter(r => r.status === 'received' || r.status === 'quality_check' || r.status === 'pending').length}
          </div>
        </div>
      </div>

      {/* Receipts List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Goods Receipts</h2>
            <Input placeholder="Search receipts..." className="w-64" />
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading goods receipts...
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No receipts found. Receive goods from purchase orders.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Receipt #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">PO/Invoice</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supplier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Warehouse</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {receipt.receiptNumber || receipt.receipt_number}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(receipt.receiptDate || receipt.created_at || receipt.receipt_date || '').toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          receipt.receipt_type === 'supplier_invoice' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {receipt.receipt_type === 'supplier_invoice' ? 'Invoice' : 'PO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {receipt.receipt_type === 'supplier_invoice' 
                          ? (receipt.invoice_number || 'N/A')
                          : (receipt.purchaseOrder?.poNumber || receipt.po_number || 'N/A')}
                        {receipt.invoice_id && (
                          <div className="text-xs text-gray-500">ID: {receipt.invoice_id.substring(0, 8)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {receipt.supplier?.name || receipt.supplier_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {receipt.warehouse?.name || receipt.warehouse_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(receipt.status)}`}>
                          {receipt.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button 
                            onClick={async () => {
                              const token = getAuthToken();
                              const response = await fetch(`/api/erp/purchasing/receipts/${receipt.id}/download`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              
                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Receipt_${receipt.receipt_number || receipt.receiptNumber}.html`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } else {
                                showAlert({ type: 'error', title: 'Error', message: 'Failed to download receipt' });
                              }
                            }}
                            className={`text-sm font-medium ${
                              receipt.receipt_type === 'supplier_invoice' 
                                ? 'text-purple-600 hover:text-purple-800' 
                                : 'text-blue-600 hover:text-blue-800'
                            }`}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PO Goods Receipts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">PO Goods Receipts</h2>
              <p className="text-sm text-gray-600 mt-1">Purchase order receipt tracking and supplier attachment</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {poReceiptsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : poReceipts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900">No PO receipts</h3>
              <p className="text-sm text-gray-500 mt-1">Generate receipts from purchase orders</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Receipt #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {poReceipts.map((receipt: any) => (
                  <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {receipt.receipt_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                      {receipt.po_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{receipt.supplier_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{receipt.warehouse_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{receipt.line_count} items</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                          receipt.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : receipt.status === 'sent'
                            ? 'bg-blue-100 text-blue-800'
                            : receipt.status === 'received'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {receipt.status}
                        {receipt.supplier_attached && ' ✓'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedPOReceiptId(receipt.id);
                          setShowPOReceiptModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* PO Receipt View Modal */}
      <POReceiptViewModal
        isOpen={showPOReceiptModal}
        onClose={() => {
          setShowPOReceiptModal(false);
          setSelectedPOReceiptId('');
        }}
        receiptId={selectedPOReceiptId}
        onAttachSupplier={fetchPOReceipts}
      />
    </div>
  );
}
