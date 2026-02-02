'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, Package, Warehouse, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';

interface AdjustmentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  adjustmentId: string;
  apiPrefix?: string;
}

interface AdjustmentDetails {
  id: string;
  adjustmentType: string;
  status: string;
  referenceNumber: string | null;
  adjustmentDate: string;
  notes: string | null;
  createdAt: string;
  warehouse: {
    name: string;
    code: string;
  };
  lines: Array<{
    product: {
      name: string;
      sku: string;
    };
    countedQuantity: string;
    systemQuantity: string;
    differenceQuantity: string;
    reason: string | null;
  }>;
}

export default function AdjustmentViewModal({ isOpen, onClose, adjustmentId, apiPrefix = '/api/erp/inventory' }: AdjustmentViewModalProps) {
  const [adjustment, setAdjustment] = useState<AdjustmentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && adjustmentId) {
      fetchAdjustmentDetails();
    }
  }, [isOpen, adjustmentId]);

  const fetchAdjustmentDetails = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${apiPrefix}/adjustments/${adjustmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAdjustment(data.adjustment);
      }
    } catch (error) {
      console.error('Error fetching adjustment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAdjustmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cycle_count: 'Cycle Count',
      write_off: 'Write Off',
      damage: 'Damage',
      found: 'Found',
      correction: 'Correction',
      physical_count: 'Physical Count',
      theft: 'Theft',
      expiry: 'Expiry',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      cycle_count: 'bg-blue-100 text-blue-800',
      physical_count: 'bg-blue-100 text-blue-800',
      write_off: 'bg-red-100 text-red-800',
      damage: 'bg-orange-100 text-orange-800',
      found: 'bg-green-100 text-green-800',
      correction: 'bg-purple-100 text-purple-800',
      theft: 'bg-red-200 text-red-900',
      expiry: 'bg-orange-200 text-orange-900',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl max-w-4xl w-full mx-auto shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Stock Adjustment Details</h3>
            <p className="text-sm text-slate-500 mt-1">View adjustment information</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading adjustment details...</p>
            </div>
          ) : adjustment ? (
            <div className="space-y-6">
              {/* Adjustment Info Card */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Adjustment Type</p>
                    <span className={`inline-block px-3 py-1 text-sm rounded-full ${getAdjustmentTypeColor(adjustment.adjustmentType)}`}>
                      {getAdjustmentTypeLabel(adjustment.adjustmentType)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 text-sm rounded-full ${getStatusColor(adjustment.status)}`}>
                      {adjustment.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Reference Number</p>
                    <p className="font-semibold text-slate-900">
                      {adjustment.referenceNumber || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warehouse Information */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-blue-600" />
                  Warehouse Information
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-slate-900">{adjustment.warehouse.name}</p>
                  <p className="text-sm text-slate-600">Code: {adjustment.warehouse.code}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Timeline
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Created</p>
                    <p className="font-medium text-slate-900">
                      {new Date(adjustment.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(adjustment.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Adjustment Date</p>
                    <p className="font-medium text-slate-900">
                      {new Date(adjustment.adjustmentDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(adjustment.adjustmentDate).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Products ({adjustment.lines.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SKU</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">System Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Counted Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Difference</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {adjustment.lines.map((line, idx) => {
                        const difference = parseFloat(line.countedQuantity) - parseFloat(line.systemQuantity);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{line.product.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 font-mono">{line.product.sku}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium">{parseFloat(line.systemQuantity).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium">{parseFloat(line.countedQuantity).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold">
                              <div className={`flex items-center justify-end gap-1 ${
                                difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-slate-600'
                              }`}>
                                {difference > 0 ? (
                                  <>
                                    <TrendingUp className="w-4 h-4" />
                                    +{difference.toFixed(2)}
                                  </>
                                ) : difference < 0 ? (
                                  <>
                                    <TrendingDown className="w-4 h-4" />
                                    {difference.toFixed(2)}
                                  </>
                                ) : (
                                  '0.00'
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{line.reason || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {adjustment.notes && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Notes
                  </h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{adjustment.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-red-500">
              Failed to load adjustment details
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
