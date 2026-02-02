'use client';

import React, { useState, useEffect } from 'react';
import { X, Play, Pause, CheckCircle, AlertTriangle, User, Clock } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface OperationExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  operation: any;
}

export default function OperationExecutionModal({
  isOpen,
  onClose,
  onSuccess,
  operation,
}: OperationExecutionModalProps) {
  const [formData, setFormData] = useState({
    operatorName: '',
    actualTime: '',
    scrapQuantity: '0',
    scrapReason: '',
    notes: '',
  });
  const [action, setAction] = useState<'start' | 'pause' | 'resume' | 'complete'>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (operation) {
      // Determine available action based on operation status
      if (operation.status === 'pending') {
        setAction('start');
      } else if (operation.status === 'in_progress') {
        setAction('pause');
      } else if (operation.status === 'paused') {
        setAction('resume');
      }

      setFormData({
        operatorName: operation.operatorName || '',
        actualTime: operation.actualTime?.toString() || '',
        scrapQuantity: operation.scrapQuantity?.toString() || '0',
        scrapReason: operation.scrapReason || '',
        notes: operation.notes || '',
      });
    }
  }, [operation, isOpen]);

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
      const response = await fetch(`/api/erp/manufacturing/operations/${operation.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          operatorName: formData.operatorName,
          actualTime: formData.actualTime ? parseFloat(formData.actualTime) : null,
          scrapQuantity: parseFloat(formData.scrapQuantity),
          scrapReason: formData.scrapReason,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute operation');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getActionButton = () => {
    switch (action) {
      case 'start':
        return {
          icon: <Play size={18} />,
          label: 'Start Operation',
          color: 'bg-green-600 hover:bg-green-700',
        };
      case 'pause':
        return {
          icon: <Pause size={18} />,
          label: 'Pause Operation',
          color: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'resume':
        return {
          icon: <Play size={18} />,
          label: 'Resume Operation',
          color: 'bg-blue-600 hover:bg-blue-700',
        };
      case 'complete':
        return {
          icon: <CheckCircle size={18} />,
          label: 'Complete Operation',
          color: 'bg-purple-600 hover:bg-purple-700',
        };
    }
  };

  const actionButton = getActionButton();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold">Operation Execution</h2>
            <p className="text-sm text-blue-100 mt-1">{operation?.operationName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Operation Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Work Center:</span>
              <span className="ml-2 font-medium">{operation?.workCenterName}</span>
            </div>
            <div>
              <span className="text-gray-600">Sequence:</span>
              <span className="ml-2 font-medium">{operation?.sequence}</span>
            </div>
            <div>
              <span className="text-gray-600">Setup Time:</span>
              <span className="ml-2 font-medium">{operation?.setupTime} min</span>
            </div>
            <div>
              <span className="text-gray-600">Run Time:</span>
              <span className="ml-2 font-medium">{operation?.runTime} min</span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                operation?.status === 'done' ? 'bg-green-100 text-green-800' :
                operation?.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                operation?.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {operation?.status?.replace('_', ' ')}
              </span>
            </div>
            {operation?.pauseCount > 0 && (
              <div>
                <span className="text-gray-600">Pause Count:</span>
                <span className="ml-2 font-medium">{operation.pauseCount} ({operation.pauseDuration} min)</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Action Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <div className="grid grid-cols-2 gap-2">
              {operation?.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => setAction('start')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    action === 'start'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Play size={16} className="inline mr-2" />
                  Start
                </button>
              )}
              {operation?.status === 'in_progress' && (
                <>
                  <button
                    type="button"
                    onClick={() => setAction('pause')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      action === 'pause'
                        ? 'border-yellow-600 bg-yellow-50 text-yellow-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Pause size={16} className="inline mr-2" />
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('complete')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      action === 'complete'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <CheckCircle size={16} className="inline mr-2" />
                    Complete
                  </button>
                </>
              )}
              {operation?.status === 'paused' && (
                <button
                  type="button"
                  onClick={() => setAction('resume')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    action === 'resume'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Play size={16} className="inline mr-2" />
                  Resume
                </button>
              )}
            </div>
          </div>

          {/* Operator Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User size={16} className="inline mr-1" />
              Operator Name *
            </label>
            <input
              type="text"
              value={formData.operatorName}
              onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter operator name"
              required
            />
          </div>

          {/* Actual Time (for complete action) */}
          {action === 'complete' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} className="inline mr-1" />
                Actual Time (minutes)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.actualTime}
                onChange={(e) => setFormData({ ...formData, actualTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter actual time taken"
              />
              <p className="text-xs text-gray-500 mt-1">
                Planned: {operation?.setupTime + operation?.runTime} minutes
              </p>
            </div>
          )}

          {/* Scrap Quantity (for complete action) */}
          {action === 'complete' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scrap Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.scrapQuantity}
                  onChange={(e) => setFormData({ ...formData, scrapQuantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scrap Reason
                </label>
                <input
                  type="text"
                  value={formData.scrapReason}
                  onChange={(e) => setFormData({ ...formData, scrapReason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter reason if any"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any additional notes..."
            />
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
              className={`flex-1 px-6 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                actionButton.color
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  {actionButton.icon}
                  {actionButton.label}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
