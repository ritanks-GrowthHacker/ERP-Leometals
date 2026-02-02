'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, Package, Warehouse, Calendar, FileText } from 'lucide-react';

interface StockMovementViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  movementId: string;
  apiPrefix?: string;
}

interface MovementDetails {
  id: string;
  movementType: string;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
  createdAt: string;
  sourceWarehouse?: {
    name: string;
    code: string;
  } | null;
  destinationWarehouse?: {
    name: string;
    code: string;
  } | null;
  lines: Array<{
    product: {
      name: string;
      sku: string;
    };
    quantityOrdered: string;
    quantityProcessed: string;
    unitCost: string | null;
  }>;
}

export default function StockMovementViewModal({ isOpen, onClose, movementId, apiPrefix = '/api/erp/inventory' }: StockMovementViewModalProps) {
  const [movement, setMovement] = useState<MovementDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && movementId) {
      fetchMovementDetails();
    }
  }, [isOpen, movementId]);

  const fetchMovementDetails = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${apiPrefix}/movements/${movementId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMovement(data.movement);
      }
    } catch (error) {
      console.error('Error fetching movement details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      receipt: 'Receipt',
      delivery: 'Delivery',
      internal_transfer: 'Internal Transfer',
      adjustment: 'Adjustment',
      return: 'Return',
      scrap: 'Scrap',
    };
    return labels[type] || type;
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
            <h3 className="text-xl font-bold text-slate-900">Stock Movement Details</h3>
            <p className="text-sm text-slate-500 mt-1">View movement information</p>
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
              <p className="text-slate-600 mt-4">Loading movement details...</p>
            </div>
          ) : movement ? (
            <div className="space-y-6">
              {/* Movement Info Card */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Movement Type</p>
                    <p className="font-semibold text-lg text-slate-900">
                      {getMovementTypeLabel(movement.movementType)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 text-sm rounded-full ${getStatusColor(movement.status)}`}>
                      {movement.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warehouse Information */}
              {(movement.sourceWarehouse || movement.destinationWarehouse) && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-blue-600" />
                    Warehouse Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {movement.sourceWarehouse && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-600 font-medium mb-2">From (Source)</p>
                        <p className="font-semibold text-slate-900">{movement.sourceWarehouse.name}</p>
                        <p className="text-sm text-slate-600">Code: {movement.sourceWarehouse.code}</p>
                      </div>
                    )}
                    {movement.destinationWarehouse && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-600 font-medium mb-2">To (Destination)</p>
                        <p className="font-semibold text-slate-900">{movement.destinationWarehouse.name}</p>
                        <p className="text-sm text-slate-600">Code: {movement.destinationWarehouse.code}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Timeline
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Created</p>
                    <p className="font-medium text-slate-900">
                      {new Date(movement.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(movement.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  {movement.scheduledDate && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Scheduled</p>
                      <p className="font-medium text-slate-900">
                        {new Date(movement.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {movement.completedDate && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Completed</p>
                      <p className="font-medium text-slate-900">
                        {new Date(movement.completedDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(movement.completedDate).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Products ({movement.lines.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SKU</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ordered</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Processed</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {movement.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{line.product.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">{line.product.sku}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{parseFloat(line.quantityOrdered).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                            {parseFloat(line.quantityProcessed).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {line.unitCost ? `₹${parseFloat(line.unitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {movement.notes && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Notes
                  </h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{movement.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-red-500">
              Failed to load movement details
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
