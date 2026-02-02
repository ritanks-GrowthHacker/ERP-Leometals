'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Eye, Plus } from 'lucide-react';
import AdjustmentModal from '@/components/modal/AdjustmentModal';
import AdjustmentViewModal from '@/components/modal/AdjustmentViewModal';
import { useAlert } from '@/components/common/CustomAlert';

interface StockAdjustment {
  id: string;
  adjustmentType: string;
  status: string;
  adjustmentDate: string;
  notes: string | null;
  warehouse: {
    name: string;
  };
  lines: Array<{
    product: {
      name: string;
      sku: string;
    };
    countedQuantity: string;
    systemQuantity: string;
  }>;
}

export default function AdjustmentsPage() {
  const { showAlert } = useAlert();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  useEffect(() => {
    fetchAdjustments();
  }, [selectedStatus]);

  const fetchAdjustments = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/warehouse-manager/inventory/adjustments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAdjustments(data.adjustments || []);
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAdjustment = (id: string) => {
    setSelectedAdjustmentId(id);
    setShowViewModal(true);
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
    };
    return labels[type] || type;
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      cycle_count: 'bg-blue-100 text-blue-800',
      write_off: 'bg-red-100 text-red-800',
      damage: 'bg-orange-100 text-orange-800',
      found: 'bg-green-100 text-green-800',
      correction: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading stock adjustments...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Stock Adjustments</h2>
          <p className="text-sm text-gray-500 mt-1">Track and manage inventory adjustments</p>
        </div>
        <button
          onClick={() => setShowAdjustmentModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Create Adjustment
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Adjustments List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableHead>Date</TableHead>
                <TableHead>Product(s)</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No stock adjustments found
                  </TableCell>
                </TableRow>
              ) : (
                adjustments.map((adjustment) => {
                  const firstLine = adjustment.lines?.[0];
                  const difference = firstLine 
                    ? parseFloat(firstLine.countedQuantity) - parseFloat(firstLine.systemQuantity)
                    : 0;
                  
                  return (
                    <TableRow key={adjustment.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="text-sm">
                          {new Date(adjustment.adjustmentDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(adjustment.adjustmentDate).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {firstLine?.product.name || 'N/A'}
                        </div>
                        {adjustment.lines && adjustment.lines.length > 1 && (
                          <div className="text-xs text-gray-500">
                            +{adjustment.lines.length - 1} more item(s)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{adjustment.warehouse.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${getAdjustmentTypeColor(adjustment.adjustmentType)}`}>
                          {getAdjustmentTypeLabel(adjustment.adjustmentType)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {firstLine && (
                          <div>
                            <div className={`text-sm font-medium ${
                              difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : ''
                            }`}>
                              {difference > 0 ? '+' : ''}{difference.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {firstLine.systemQuantity} → {firstLine.countedQuantity}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {adjustment.notes || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(adjustment.status)}`}>
                          {adjustment.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewAdjustment(adjustment.id)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Adjustment Modal */}
      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        onSuccess={() => {
          setShowAdjustmentModal(false);
          fetchAdjustments();
        }}
        apiPrefix="/api/warehouse-manager/inventory"
      />

      {/* View Adjustment Modal */}
      {selectedAdjustmentId && (
        <AdjustmentViewModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAdjustmentId(null);
          }}
          adjustmentId={selectedAdjustmentId}
          apiPrefix="/api/warehouse-manager/inventory"
        />
      )}
    </div>
  );
}
