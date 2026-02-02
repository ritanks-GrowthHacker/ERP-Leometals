'use client';

import { X } from 'lucide-react';

interface ProductViewModalProps {
  isOpen: boolean;
  product: any;
  onClose: () => void;
  onEdit: (product: any) => void;
  onViewLifecycle: (productId: string) => void;
}

export default function ProductViewModal({ isOpen, product, onClose, onEdit, onViewLifecycle }: ProductViewModalProps) {
  if (!isOpen || !product) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{product.name}</h2>
              <p className="text-blue-100 text-sm font-mono mt-1">{product.sku}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-xs font-medium text-gray-600 mb-1">Cost Price</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{product.costPrice && !isNaN(parseFloat(product.costPrice)) ? parseFloat(product.costPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-xs font-medium text-gray-600 mb-1">Sale Price</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{product.salePrice && !isNaN(parseFloat(product.salePrice)) ? parseFloat(product.salePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <p className="text-xs font-medium text-gray-600 mb-1">Min value (Default reorder point)</p>
              <p className="text-2xl font-bold text-gray-900">{product.reorderPoint || '—'}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <p className="text-xs font-medium text-gray-600 mb-1">Reorder Qty</p>
              <p className="text-2xl font-bold text-gray-900">{product.reorderQuantity || '—'}</p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Product Type</label>
                <div className="mt-2">
                  <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800 capitalize">
                    {product.productType}
                  </span>
                </div>
              </div>
              {product.category && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Category</label>
                  <p className="text-lg font-medium text-gray-900 mt-2">{product.category.name}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                <div className="mt-2">
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${product.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {product.isActive ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Profit Margin</label>
                <p className="text-lg font-bold text-green-600 mt-2">
                  {product.costPrice && product.salePrice && !isNaN(parseFloat(product.costPrice)) && !isNaN(parseFloat(product.salePrice)) && parseFloat(product.costPrice) !== 0
                    ? ((parseFloat(product.salePrice) - parseFloat(product.costPrice)) / parseFloat(product.costPrice) * 100).toFixed(1) + '%'
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
            <button
              onClick={() => onViewLifecycle(product.id)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              View Lifecycle
            </button>
            <button
              onClick={() => { onClose(); onEdit(product); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
