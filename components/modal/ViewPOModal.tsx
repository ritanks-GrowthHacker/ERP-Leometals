import React from 'react';
import { createPortal } from 'react-dom';

interface POLine {
  id: string;
  productId: string;
  productName?: string;
  product?: {
    name: string;
  };
  quantityOrdered: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate?: string;
  status: string;
  totalAmount: string | number;
  notes?: string;
  supplier?: {
    name: string;
  };
  warehouse?: {
    name: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
    address?: string;
  };
  lines?: POLine[];
}

interface ViewPOModalProps {
  order: PurchaseOrder;
  onClose: () => void;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'partially_received':
      return 'bg-yellow-100 text-yellow-800';
    case 'received':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function ViewPOModal({ order, onClose }: ViewPOModalProps) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Purchase Order Details</h2>
            <p className="text-sm text-gray-600 mt-1">PO #{order.poNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-3xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Supplier</div>
              <div className="text-base font-semibold text-gray-900">
                {order.supplier?.name || 'N/A'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Warehouse</div>
              <div className="text-base font-semibold text-gray-900">
                {order.warehouse?.name || 'N/A'}
              </div>
            </div>

            {order.location && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-xs font-medium text-blue-700 uppercase mb-1">Delivery Location</div>
                <div className="text-base font-semibold text-gray-900">
                  {order.location.name} ({order.location.code})
                </div>
                {order.location.address && (
                  <div className="text-sm text-gray-600 mt-1">
                    {order.location.address}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">PO Date</div>
              <div className="text-base font-semibold text-gray-900">
                {order.poDate
                  ? new Date(order.poDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Expected Delivery</div>
              <div className="text-base font-semibold text-gray-900">
                {order.expectedDeliveryDate
                  ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Status</div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs font-medium text-green-700 uppercase mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-green-600">
                ₹{parseFloat(String(order.totalAmount || 0)).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-xs font-medium text-blue-700 uppercase mb-2">Notes</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</div>
            </div>
          )}

          {/* Order Lines Table */}
          {order.lines && order.lines.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tax %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Line Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.lines.map((line, index) => {
                      const qty = parseFloat(String(line.quantityOrdered || 0));
                      const price = parseFloat(String(line.unitPrice || 0));
                      const tax = parseFloat(String(line.taxRate || 0));
                      const lineTotal = qty * price * (1 + tax / 100);

                      return (
                        <tr key={line.id || index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {line.productName || line.product?.name || 'Unknown Product'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">
                            {qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">
                            ₹{price.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{tax}%</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            ₹{lineTotal.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
