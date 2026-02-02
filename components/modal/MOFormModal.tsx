'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface MOFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  order: any | null;
  products: any[];
  boms: any[];
  routings: any[];
  warehouses: any[];
}

export default function MOFormModal({
  isOpen,
  onClose,
  onSave,
  order,
  products,
  boms,
  routings,
  warehouses
}: MOFormModalProps) {
  const { showAlert } = useAlert();
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    moNumber: '',
    productId: '',
    bomId: '',
    routingId: '',
    plannedQuantity: '',
    status: 'draft',
    priority: 'medium',
    scheduledStart: '',
    scheduledEnd: '',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    notes: '',
  });

  useEffect(() => {
    if (order) {
      setFormData({
        moNumber: order.moNumber || '',
        productId: order.productId || '',
        bomId: order.bomId || '',
        routingId: order.routingId || '',
        plannedQuantity: order.plannedQuantity?.toString() || '',
        status: order.status || 'draft',
        priority: order.priority || 'medium',
        scheduledStart: order.scheduledStart || '',
        scheduledEnd: order.scheduledEnd || '',
        sourceWarehouseId: order.sourceWarehouseId || '',
        destinationWarehouseId: order.destinationWarehouseId || '',
        notes: order.notes || '',
      });
    } else {
      // Auto-generate MO number for new orders
      generateMONumber();
      setFormData({
        moNumber: '',
        productId: '',
        bomId: '',
        routingId: '',
        plannedQuantity: '',
        status: 'draft',
        priority: 'medium',
        scheduledStart: '',
        scheduledEnd: '',
        sourceWarehouseId: '',
        destinationWarehouseId: '',
        notes: '',
      });
    }
  }, [order]);

  const generateMONumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const moNumber = `MO-${timestamp}-${random}`;
    setFormData(prev => ({ ...prev, moNumber }));
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getAuthToken();
    try {
      const url = order 
        ? `/api/erp/manufacturing/orders/${order.id}`
        : '/api/erp/manufacturing/orders';
      
      const method = order ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save manufacturing order');

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving MO:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save manufacturing order' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {order ? 'Edit Manufacturing Order' : 'Create Manufacturing Order'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MO Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.moNumber}
                  onChange={(e) => setFormData({ ...formData, moNumber: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MO-2024-001"
                />
                <button
                  type="button"
                  onClick={generateMONumber}
                  disabled={generating || !!order}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                  title={order ? "Cannot regenerate for existing orders" : "Generate new MO number"}
                >
                  <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BOM</label>
              <select
                value={formData.bomId}
                onChange={(e) => setFormData({ ...formData, bomId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select BOM</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bomNumber} - {b.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Routing</label>
              <select
                value={formData.routingId}
                onChange={(e) => setFormData({ ...formData, routingId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Routing</option>
                {routings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routingCode} - {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planned Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.plannedQuantity}
                onChange={(e) => setFormData({ ...formData, plannedQuantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Start <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.scheduledStart}
                onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled End <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.scheduledEnd}
                onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse</label>
              <select
                value={formData.sourceWarehouseId}
                onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Warehouse</label>
              <select
                value={formData.destinationWarehouseId}
                onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {order ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
