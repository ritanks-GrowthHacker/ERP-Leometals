'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import StockMovementModal from '@/components/modal/StockMovementModal';
import StockMovementViewModal from '@/components/modal/StockMovementViewModal';
import { useAlert } from '@/components/common/CustomAlert';

interface StockMovement {
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
  }>;
}

export default function MovementsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const itemsPerPage = 20;



  useEffect(() => {
    fetchMovements();
  }, [selectedType, selectedStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedStatus]);

  const fetchMovements = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedType) params.append('movementType', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/erp/inventory/movements?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMovements(data.movements || []);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmMovement = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Complete Movement',
      message: 'Are you sure you want to complete this movement? This will update stock levels.',
      confirmText: 'Complete',
      cancelText: 'Cancel',
      onConfirm: async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/movements/${id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Movement completed successfully!' });
        await fetchMovements();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to complete movement: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error confirming movement:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to complete movement' });
        }
      }
    });
  };

  const handleViewMovement = (id: string) => {
    setSelectedMovementId(id);
    setShowViewModal(true);
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

  const getMovementTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      receipt: 'bg-blue-100 text-blue-800',
      delivery: 'bg-orange-100 text-orange-800',
      internal_transfer: 'bg-purple-100 text-purple-800',
      adjustment: 'bg-yellow-100 text-yellow-800',
      return: 'bg-indigo-100 text-indigo-800',
      scrap: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      receipt: '📥 Receipt',
      delivery: '📤 Delivery',
      internal_transfer: '🔄 Transfer',
      adjustment: '✏️ Adjustment',
      return: '↩️ Return',
      scrap: '🗑️ Scrap',
    };
    return labels[type] || type;
  };

  // Pagination calculation
  const totalPages = Math.ceil(movements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMovements = movements.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading stock movements...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Stock Movements</h2>
          <p className="text-sm text-gray-500 mt-1">Track inventory transfers and changes</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + New Movement
        </button>
      </div>

      {/* Create Movement Modal */}
      <StockMovementModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchMovements}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Movement Type
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="receipt">Receipt</option>
                <option value="delivery">Delivery</option>
                <option value="internal_transfer">Internal Transfer</option>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return</option>
                <option value="scrap">Scrap</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Movements List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableHead>Date</TableHead>
                <TableHead>Product(s)</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No stock movements found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMovements.map((movement) => (
                  <TableRow key={movement.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <div className="text-sm">
                        {new Date(movement.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(movement.createdAt).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {movement.lines?.[0]?.product.name || 'N/A'}
                      </div>
                      {movement.lines && movement.lines.length > 1 && (
                        <div className="text-xs text-gray-500">
                          +{movement.lines.length - 1} more item(s)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${getMovementTypeColor(movement.movementType)}`}>
                        {getMovementTypeLabel(movement.movementType)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {movement.lines?.[0]?.quantityOrdered || '0'}
                      {movement.status === 'completed' && movement.lines?.[0]?.quantityProcessed && (
                        <div className="text-xs text-gray-500">
                          ({movement.lines[0].quantityProcessed} processed)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {movement.sourceWarehouse && (
                          <div className="text-gray-700">
                            From: <span className="font-medium">{movement.sourceWarehouse.name}</span>
                          </div>
                        )}
                        {movement.destinationWarehouse && (
                          <div className="text-gray-700">
                            To: <span className="font-medium">{movement.destinationWarehouse.name}</span>
                          </div>
                        )}
                        {movement.notes && (
                          <div className="text-xs text-gray-500 mt-1">{movement.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(movement.status)}`}>
                        {movement.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {movement.status === 'draft' && (
                          <button
                            onClick={() => confirmMovement(movement.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors"
                          >
                            ✓ Complete
                          </button>
                        )}
                        <button
                          onClick={() => handleViewMovement(movement.id)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* View Movement Modal */}
        {selectedMovementId && (
          <StockMovementViewModal
            isOpen={showViewModal}
            onClose={() => {
              setShowViewModal(false);
              setSelectedMovementId(null);
            }}
            movementId={selectedMovementId}
          />
        )}
        
        {movements.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, movements.length)} of {movements.length} items
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

