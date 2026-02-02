'use client';

import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';
import { getAuthToken } from '@/lib/utils/token';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    warehouseId?: string;
    warehouseName?: string;
    availableQuantity?: number;
    reorderPoint?: number;
  };
  onSuccess: () => void;
}

export default function RestockModal({ isOpen, onClose, product, onSuccess }: RestockModalProps) {
  const { showAlert } = useAlert();
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(product.warehouseId || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchWarehouses();
      setSelectedWarehouse(product.warehouseId || '');
      setOtpSent(false);
      setOtp('');
      setOtpVerified(false);
    }
  }, [isOpen, product.warehouseId]);

  const fetchWarehouses = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleSendOTP = async () => {
    if (!selectedWarehouse) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select a warehouse first',
      });
      return;
    }

    setSendingOtp(true);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/restock/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          productId: product.id,
          productName: product.name,
        }),
      });

      if (response.ok) {
        setOtpSent(true);
        showAlert({
          type: 'success',
          title: 'OTP Sent',
          message: 'OTP has been sent to warehouse manager email. Valid for 10 minutes.',
        });
      } else {
        const data = await response.json();
        showAlert({
          type: 'error',
          title: 'Error',
          message: data.error || 'Failed to send OTP',
        });
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to send OTP',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please enter a valid 6-digit OTP',
      });
      return;
    }

    setLoading(true);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/restock/send-otp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          productId: product.id,
          otp: otp,
        }),
      });

      if (response.ok) {
        setOtpVerified(true);
        showAlert({
          type: 'success',
          title: 'OTP Verified',
          message: 'OTP verified successfully. You can now proceed with restock.',
        });
      } else {
        const data = await response.json();
        showAlert({
          type: 'error',
          title: 'Error',
          message: data.error || 'Invalid OTP',
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to verify OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpVerified) {
      showAlert({
        type: 'warning',
        title: 'Verification Required',
        message: 'Please verify OTP from warehouse manager before restocking',
      });
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please enter a valid restock quantity',
      });
      return;
    }

    if (!selectedWarehouse) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select a warehouse',
      });
      return;
    }

    setLoading(true);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/restock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity: parseFloat(quantity),
          notes: notes || `Restock for ${product.name}`,
        }),
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Restock Successful',
          message: `${quantity} units added to stock for ${product.name}`,
        });
        setQuantity('');
        setNotes('');
        setOtpSent(false);
        setOtp('');
        setOtpVerified(false);
        onClose();
        // Call onSuccess after closing to refresh data
        setTimeout(() => {
          onSuccess();
        }, 100);
      } else {
        const data = await response.json();
        showAlert({
          type: 'error',
          title: 'Error',
          message: data.error || 'Failed to restock product',
        });
      }
    } catch (error) {
      console.error('Error restocking product:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to restock product',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Restock Product</h2>
              <p className="text-sm text-gray-500">Add inventory to stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Product:</span>
              <span className="text-sm font-medium text-gray-900">{product.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">SKU:</span>
              <span className="text-sm font-medium text-gray-900">{product.sku}</span>
            </div>
            {product.availableQuantity !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Current Stock:</span>
                <span className="text-sm font-medium text-red-600">{product.availableQuantity}</span>
              </div>
            )}
            {product.reorderPoint !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Min value (Default reorder point):</span>
                <span className="text-sm font-medium text-gray-900">{product.reorderPoint}</span>
              </div>
            )}
          </div>

          {/* Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warehouse <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>

          {/* Restock Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Restock Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter quantity to add"
              min="1"
              step="1"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Add any notes about this restock"
              rows={3}
            />
          </div>

          {/* Digital Signature - OTP Verification */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🔐</span>
              </div>
              <h3 className="text-sm font-semibold text-blue-900">Digital Signature Required</h3>
            </div>
            
            {!otpSent ? (
              <div>
                <p className="text-xs text-blue-700 mb-3">
                  An OTP will be sent to the warehouse manager's email for verification
                </p>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={sendingOtp || !selectedWarehouse}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingOtp ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending OTP...
                    </>
                  ) : (
                    <>📧 Send OTP to Manager</>
                  )}
                </button>
              </div>
            ) : !otpVerified ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-blue-900 mb-1">
                    Enter 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-wider"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={loading || otp.length !== 6}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={sendingOtp}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Resend
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">OTP Verified ✓</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Restocking...
                </span>
              ) : (
                'Restock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
