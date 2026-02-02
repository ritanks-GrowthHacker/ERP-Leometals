'use client';
import React from 'react';

interface BOMViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bom: any;
}

export default function BOMViewModal({ isOpen, onClose, bom }: BOMViewModalProps) {
  if (!isOpen || !bom) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl max-w-4xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">BOM Details</h3>
            <p className="text-sm text-slate-500 mt-1">{bom.bomNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium">Product</label>
              <p className="text-sm font-semibold text-gray-900">{bom.productName}</p>
              <p className="text-xs text-gray-500">{bom.productSku}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Version</label>
              <p className="text-sm font-semibold text-gray-900">v{bom.version}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Effective From</label>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(bom.effectiveFrom).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Effective To</label>
              <p className="text-sm font-semibold text-gray-900">
                {bom.effectiveTo ? new Date(bom.effectiveTo).toLocaleDateString('en-IN') : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Scrap Percentage</label>
              <p className="text-sm font-semibold text-yellow-600">{bom.scrapPercentage}%</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Status</label>
              <p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  bom.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {bom.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </p>
            </div>
          </div>

          {/* Components */}
          {bom.lines && bom.lines.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Components</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Component</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">UOM</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Scrap %</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bom.lines.map((line: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">
                          <div className="font-medium text-gray-900">{line.component?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{line.component?.sku}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{parseFloat(line.quantity).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">{line.uom || 'Units'}</td>
                        <td className="px-4 py-2 text-sm text-right">{line.scrapPercentage || 0}%</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            line.componentType === 'raw_material' ? 'bg-blue-100 text-blue-800' :
                            line.componentType === 'semi_finished' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {line.componentType?.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {bom.notes && (
            <div>
              <label className="text-xs text-gray-500 font-medium">Notes</label>
              <p className="text-sm text-gray-900 mt-1">{bom.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
