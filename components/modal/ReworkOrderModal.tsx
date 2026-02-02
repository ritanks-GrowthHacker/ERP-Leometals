'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Plus, Trash2, Package } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface ReworkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentMO: any;
  editRework?: any;
}

export default function ReworkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  parentMO,
  editRework,
}: ReworkOrderModalProps) {
  const [formData, setFormData] = useState({
    defectQuantity: '',
    reworkQuantity: '',
    defectType: '',
    defectDescription: '',
    rootCause: '',
    correctiveAction: '',
    priority: 'medium',
    scheduledStart: '',
    scheduledEnd: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editRework) {
      setFormData({
        defectQuantity: editRework.defectQuantity?.toString() || '',
        reworkQuantity: editRework.reworkQuantity?.toString() || '',
        defectType: editRework.defectType || '',
        defectDescription: editRework.defectDescription || '',
        rootCause: editRework.rootCause || '',
        correctiveAction: editRework.correctiveAction || '',
        priority: editRework.priority || 'medium',
        scheduledStart: editRework.scheduledStart || '',
        scheduledEnd: editRework.scheduledEnd || '',
      });
    } else {
      setFormData({
        defectQuantity: '',
        reworkQuantity: '',
        defectType: '',
        defectDescription: '',
        rootCause: '',
        correctiveAction: '',
        priority: 'medium',
        scheduledStart: '',
        scheduledEnd: '',
      });
    }
    setError('');
  }, [editRework, isOpen]);

  if (!isOpen) return null;

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

    try {
      const url = editRework
        ? `/api/erp/manufacturing/rework/${editRework.id}`
        : '/api/erp/manufacturing/rework';
      
      const method = editRework ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          parentMoId: parentMO.id,
          productId: parentMO.productId,
          defectQuantity: parseFloat(formData.defectQuantity),
          reworkQuantity: parseFloat(formData.reworkQuantity),
          defectType: formData.defectType,
          defectDescription: formData.defectDescription,
          rootCause: formData.rootCause,
          correctiveAction: formData.correctiveAction,
          priority: formData.priority,
          scheduledStart: formData.scheduledStart,
          scheduledEnd: formData.scheduledEnd,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create rework order');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold">
              {editRework ? 'Edit Rework Order' : 'Create Rework Order'}
            </h2>
            <p className="text-sm text-orange-100 mt-1">
              Parent MO: {parentMO?.moNumber} - {parentMO?.productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Defect Quantity *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.defectQuantity}
                onChange={(e) => setFormData({ ...formData, defectQuantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Enter defect quantity"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rework Quantity *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.reworkQuantity}
                onChange={(e) => setFormData({ ...formData, reworkQuantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Enter rework quantity"
                required
              />
            </div>
          </div>

          {/* Defect Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Defect Type *
            </label>
            <select
              value={formData.defectType}
              onChange={(e) => setFormData({ ...formData, defectType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            >
              <option value="">Select defect type</option>
              <option value="dimensional">Dimensional</option>
              <option value="visual">Visual Defect</option>
              <option value="functional">Functional Failure</option>
              <option value="material">Material Issue</option>
              <option value="assembly">Assembly Error</option>
              <option value="finish">Finish Defect</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Defect Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Defect Description *
            </label>
            <textarea
              value={formData.defectDescription}
              onChange={(e) => setFormData({ ...formData, defectDescription: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Describe the defect in detail..."
              required
            />
          </div>

          {/* Root Cause */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Root Cause Analysis
            </label>
            <textarea
              value={formData.rootCause}
              onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="What caused this defect?"
            />
          </div>

          {/* Corrective Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Corrective Action Plan
            </label>
            <textarea
              value={formData.correctiveAction}
              onChange={(e) => setFormData({ ...formData, correctiveAction: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="How will this be fixed?"
            />
          </div>

          {/* Priority and Schedule */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled Start
              </label>
              <input
                type="date"
                value={formData.scheduledStart}
                onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled End
              </label>
              <input
                type="date"
                value={formData.scheduledEnd}
                onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-medium transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:from-orange-700 hover:to-red-700'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                <span>{editRework ? 'Update' : 'Create'} Rework Order</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
