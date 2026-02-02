'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface RoutingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRouting?: any;
}

interface Operation {
  sequence: number;
  operationName: string;
  workCenterId: string;
  setupTime: number;
  runTimePerUnit: number;
  description: string;
}

export default function RoutingFormModal({
  isOpen,
  onClose,
  onSuccess,
  editRouting,
}: RoutingFormModalProps) {
  const [formData, setFormData] = useState({
    routingCode: '',
    name: '',
    productId: '',
    status: 'active',
    notes: '',
  });
  const [operations, setOperations] = useState<Operation[]>([
    { sequence: 10, operationName: '', workCenterId: '', setupTime: 0, runTimePerUnit: 0, description: '' },
  ]);
  const [products, setProducts] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchWorkCenters();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editRouting) {
      setFormData({
        routingCode: editRouting.routingCode || '',
        name: editRouting.name || '',
        productId: editRouting.productId || '',
        status: editRouting.status || 'active',
        notes: editRouting.notes || '',
      });
      if (editRouting.operations && editRouting.operations.length > 0) {
        setOperations(editRouting.operations);
      }
    } else {
      // Auto-generate routing code for new routing
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      setFormData({
        routingCode: `RT-${timestamp}-${randomSuffix}`,
        name: '',
        productId: '',
        status: 'active',
        notes: '',
      });
      setOperations([
        { sequence: 10, operationName: '', workCenterId: '', setupTime: 0, runTimePerUnit: 0, description: '' },
      ]);
    }
    setError('');
  }, [editRouting, isOpen]);

  const fetchProducts = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWorkCenters = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/erp/manufacturing/work-centers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkCenters(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching work centers:', error);
    }
  };

  const addOperation = () => {
    const lastSequence = operations.length > 0 ? Math.max(...operations.map(op => op.sequence)) : 0;
    setOperations([
      ...operations,
      {
        sequence: lastSequence + 10,
        operationName: '',
        workCenterId: '',
        setupTime: 0,
        runTimePerUnit: 0,
        description: '',
      },
    ]);
  };

  const removeOperation = (index: number) => {
    if (operations.length > 1) {
      setOperations(operations.filter((_, i) => i !== index));
    }
  };

  const updateOperation = (index: number, field: keyof Operation, value: any) => {
    const updated = [...operations];
    updated[index] = { ...updated[index], [field]: value };
    setOperations(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = getAuthToken();
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    // Validate operations
    const hasEmptyOperations = operations.some(
      op => !op.operationName || !op.workCenterId
    );
    if (hasEmptyOperations) {
      setError('All operations must have a name and work center');
      setLoading(false);
      return;
    }

    try {
      const url = editRouting
        ? `/api/erp/manufacturing/routing/${editRouting.id}`
        : '/api/erp/manufacturing/routing';

      const method = editRouting ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routingCode: formData.routingCode,
          name: formData.name,
          productId: formData.productId,
          status: formData.status,
          notes: formData.notes,
          operations: operations.map(op => ({
            sequence: op.sequence,
            operationName: op.operationName,
            workCenterId: op.workCenterId,
            setupTime: parseFloat(op.setupTime.toString()),
            runTimePerUnit: parseFloat(op.runTimePerUnit.toString()),
            description: op.description,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save routing');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-xl flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold">
            {editRouting ? 'Edit Routing' : 'Create Routing'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Routing Header */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Routing Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.routingCode}
                onChange={(e) => setFormData({ ...formData, routingCode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="RT-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Routing Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Standard Production Process"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="under_review">Under Review</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Additional notes..."
            />
          </div>

          {/* Operations Section */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Operations <span className="text-sm text-gray-500">(Sequential)</span>
              </h3>
              <button
                type="button"
                onClick={addOperation}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Operation
              </button>
            </div>

            <div className="space-y-4">
              {operations.map((operation, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-5 gap-3">
                      {/* Sequence */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Seq
                        </label>
                        <input
                          type="number"
                          required
                          value={operation.sequence}
                          onChange={(e) => updateOperation(index, 'sequence', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Operation Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Operation *
                        </label>
                        <input
                          type="text"
                          required
                          value={operation.operationName}
                          onChange={(e) => updateOperation(index, 'operationName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          placeholder="Cutting"
                        />
                      </div>

                      {/* Work Center */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Work Center *
                        </label>
                        <select
                          required
                          value={operation.workCenterId}
                          onChange={(e) => updateOperation(index, 'workCenterId', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select</option>
                          {workCenters.map((wc) => (
                            <option key={wc.id} value={wc.id}>
                              {wc.code} - {wc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Setup Time */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Setup (min)
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.1"
                          value={operation.setupTime}
                          onChange={(e) => updateOperation(index, 'setupTime', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Run Time */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Run/Unit (min)
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.1"
                          value={operation.runTimePerUnit}
                          onChange={(e) => updateOperation(index, 'runTimePerUnit', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => removeOperation(index)}
                      disabled={operations.length === 1}
                      className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={operation.description}
                      onChange={(e) => updateOperation(index, 'description', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      placeholder="Operation details..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:bg-purple-300"
              disabled={loading}
            >
              {loading ? 'Saving...' : editRouting ? 'Update Routing' : 'Create Routing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
