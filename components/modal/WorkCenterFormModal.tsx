'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface WorkCenterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editWorkCenter?: any;
}

export default function WorkCenterFormModal({
  isOpen,
  onClose,
  onSuccess,
  editWorkCenter,
}: WorkCenterFormModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'machine',
    capacityPerDay: '',
    capacityUom: 'units',
    costPerHour: '',
    efficiency: '100',
    status: 'active',
    location: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editWorkCenter) {
      setFormData({
        code: editWorkCenter.code || '',
        name: editWorkCenter.name || '',
        type: editWorkCenter.type || 'machine',
        capacityPerDay: editWorkCenter.capacityPerDay?.toString() || '',
        capacityUom: editWorkCenter.capacityUom || 'units',
        costPerHour: editWorkCenter.costPerHour?.toString() || '',
        efficiency: editWorkCenter.efficiency?.toString() || '100',
        status: editWorkCenter.status || 'active',
        location: editWorkCenter.location || '',
        notes: editWorkCenter.notes || '',
      });
    } else {
      // Auto-generate work center code for new work center
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      setFormData({
        code: `WC-${timestamp}-${randomSuffix}`,
        name: '',
        type: 'machine',
        capacityPerDay: '',
        capacityUom: 'units',
        costPerHour: '',
        efficiency: '100',
        status: 'active',
        location: '',
        notes: '',
      });
    }
    setError('');
  }, [editWorkCenter, isOpen]);

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
      const url = editWorkCenter
        ? `/api/erp/manufacturing/work-centers/${editWorkCenter.id}`
        : '/api/erp/manufacturing/work-centers';

      const method = editWorkCenter ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          capacityPerDay: parseFloat(formData.capacityPerDay),
          capacityUom: formData.capacityUom,
          costPerHour: parseFloat(formData.costPerHour),
          efficiency: parseFloat(formData.efficiency),
          status: formData.status,
          location: formData.location,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save work center');
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {editWorkCenter ? 'Edit Work Center' : 'Create Work Center'}
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

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Center Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="WC-001"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="machine">Machine</option>
                <option value="assembly_line">Assembly Line</option>
                <option value="testing">Testing</option>
                <option value="packaging">Packaging</option>
              </select>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="CNC Machine #1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Capacity Per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity Per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.capacityPerDay}
                onChange={(e) => setFormData({ ...formData, capacityPerDay: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="100"
              />
            </div>

            {/* Capacity UOM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity UOM <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.capacityUom}
                onChange={(e) => setFormData({ ...formData, capacityUom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="units, kg, liters"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cost Per Hour */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Per Hour (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.costPerHour}
                onChange={(e) => setFormData({ ...formData, costPerHour: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="500"
              />
            </div>

            {/* Efficiency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Efficiency (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                step="0.1"
                value={formData.efficiency}
                onChange={(e) => setFormData({ ...formData, efficiency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="maintenance">Maintenance</option>
                <option value="breakdown">Breakdown</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Shop Floor A, Bay 3"
              />
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
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
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300"
              disabled={loading}
            >
              {loading ? 'Saving...' : editWorkCenter ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
