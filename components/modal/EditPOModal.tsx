import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';

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
}

interface POLine {
  productId: string;
  productName?: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  expectedDeliveryDate?: string;
  notes?: string;
}

interface EditPOModalProps {
  order: PurchaseOrder;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: Product[];
  formData: {
    supplierId: string;
    warehouseId: string;
    expectedDeliveryDate: string;
    notes: string;
  };
  poLines: POLine[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormDataChange: (field: string, value: string) => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (index: number, field: string, value: string) => void;
  onRemoveLineItem: (index: number) => void;
}

export default function EditPOModal({
  order,
  suppliers,
  warehouses,
  products,
  formData,
  poLines,
  onClose,
  onSubmit,
  onFormDataChange,
  onAddLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
}: EditPOModalProps) {
  if (typeof window === 'undefined') return null;

  // Calculate totals
  const subtotal = poLines.reduce((sum, line) => {
    const qty = parseFloat(line.quantity || '0');
    const price = parseFloat(line.unitPrice || '0');
    return sum + qty * price;
  }, 0);

  const taxAmount = poLines.reduce((sum, line) => {
    const qty = parseFloat(line.quantity || '0');
    const price = parseFloat(line.unitPrice || '0');
    const tax = parseFloat(line.taxRate || '0');
    return sum + (qty * price * tax) / 100;
  }, 0);

  const total = subtotal + taxAmount;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Purchase Order</h2>
            <p className="text-sm text-gray-600 mt-1">PO #{order.poNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
               <select
                  value={formData.supplierId || ''}
                  onChange={(e) => onFormDataChange('supplierId', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.warehouseId || ''}
                  onChange={(e) => onFormDataChange('warehouseId', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery Date
                </label>
                <Input
                  type="date"
                  value={formData.expectedDeliveryDate || ''}
                  onChange={(e) => onFormDataChange('expectedDeliveryDate', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => onFormDataChange('notes', e.target.value)}
                  rows={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Order Items</h3>
                <button
                  type="button"
                  onClick={onAddLineItem}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add Item
                </button>
              </div>

              {poLines.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  No items added. Click "Add Item" to start.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Product
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Unit Price (₹)
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Tax %
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Total (₹)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {poLines.map((line, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <select
                                value={line.productId}
                                onChange={(e) => onUpdateLineItem(index, 'productId', e.target.value)}
                                required
                                className="w-full min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="">Select Product</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} ({product.sku})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                value={line.quantity}
                                onChange={(e) => onUpdateLineItem(index, 'quantity', e.target.value)}
                                min="0"
                                step="0.01"
                                required
                                className="w-24"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                value={line.unitPrice}
                                onChange={(e) => onUpdateLineItem(index, 'unitPrice', e.target.value)}
                                min="0"
                                step="0.01"
                                required
                                className="w-28"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                value={line.taxRate}
                                onChange={(e) => onUpdateLineItem(index, 'taxRate', e.target.value)}
                                min="0"
                                step="0.01"
                                className="w-20"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-900">
                                ₹{line.lineTotal.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => onRemoveLineItem(index)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Remove item"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Totals Section */}
            {poLines.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="max-w-md ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">Subtotal:</span>
                    <span className="font-semibold text-gray-900">
                      ₹{subtotal.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">Tax Amount:</span>
                    <span className="font-semibold text-gray-900">
                      ₹{taxAmount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-blue-300 pt-2">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-blue-600">
                      ₹{total.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Update Purchase Order
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
