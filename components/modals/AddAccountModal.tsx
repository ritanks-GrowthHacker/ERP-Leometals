'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  authToken: string;
}

export default function AddAccountModal({
  isOpen,
  onClose,
  onSuccess,
  authToken,
}: AddAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    account_subtype: '',
    parent_account_id: '',
    is_gst_account: false,
    gst_account_type: '',
    opening_balance: '0',
    opening_balance_date: '',
    description: '',
  });

  // Auto-generate account code when modal opens or account type changes
  useEffect(() => {
    if (isOpen && authToken) {
      generateAccountCode(formData.account_type);
    }
  }, [isOpen, formData.account_type, authToken]);

  const generateAccountCode = async (accountType: string) => {
    try {
      // Define prefixes for each account type
      const prefixes: { [key: string]: string } = {
        asset: '1',
        liability: '2',
        equity: '3',
        revenue: '4',
        expense: '5',
      };
      
      const prefix = prefixes[accountType] || '1';
      
      // Fetch existing accounts to get the next number
      const res = await fetch('/api/erp/finance/accounting/accounts', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        const existingCodes = data.accounts
          .map((acc: any) => acc.account_code)
          .filter((code: string) => code.startsWith(prefix));
        
        // Find the highest number
        let maxNum = 0;
        existingCodes.forEach((code: string) => {
          const num = parseInt(code.substring(1));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
        
        // Generate new code
        const newCode = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
        setFormData(prev => ({ ...prev, account_code: newCode }));
      }
    } catch (error) {
      console.error('Error generating account code:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/erp/finance/accounting/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...formData,
          opening_balance: parseFloat(formData.opening_balance) || 0,
          gst_account_type: formData.is_gst_account ? formData.gst_account_type : null,
          opening_balance_date: formData.opening_balance_date || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const event = new CustomEvent('showToast', {
          detail: { message: 'Account created successfully!', type: 'success' }
        });
        window.dispatchEvent(event);
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          account_code: '',
          account_name: '',
          account_type: 'asset',
          account_subtype: '',
          parent_account_id: '',
          is_gst_account: false,
          gst_account_type: '',
          opening_balance: '0',
          opening_balance_date: '',
          description: '',
        });
      } else {
        const event = new CustomEvent('showToast', {
          detail: { message: data.error || 'Failed to create account', type: 'error' }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error creating account:', error);
      const event = new CustomEvent('showToast', {
        detail: { message: 'Failed to create account', type: 'error' }
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add New Account
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Account Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Code <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Auto-generated)</span>
              </label>
              <input
                type="text"
                required
                value={formData.account_code}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                placeholder="e.g., 10001"
              />
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Cash in Hand"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {/* Account Subtype */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account Subtype
              </label>
              <input
                type="text"
                value={formData.account_subtype}
                onChange={(e) => setFormData({ ...formData, account_subtype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., current_asset"
              />
            </div>

            {/* Opening Balance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Opening Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="0.00"
              />
            </div>

            {/* Opening Balance Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Opening Balance Date
              </label>
              <input
                type="date"
                value={formData.opening_balance_date}
                onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Is GST Account */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_gst_account"
              checked={formData.is_gst_account}
              onChange={(e) => setFormData({ ...formData, is_gst_account: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="is_gst_account" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              This is a GST Account
            </label>
          </div>

          {/* GST Account Type - Show only if GST account */}
          {formData.is_gst_account && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GST Account Type <span className="text-red-500">*</span>
              </label>
              <select
                required={formData.is_gst_account}
                value={formData.gst_account_type}
                onChange={(e) => setFormData({ ...formData, gst_account_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select GST Type</option>
                <option value="cgst_input">CGST Input</option>
                <option value="sgst_input">SGST Input</option>
                <option value="igst_input">IGST Input</option>
                <option value="cgst_output">CGST Output</option>
                <option value="sgst_output">SGST Output</option>
                <option value="igst_output">IGST Output</option>
                <option value="cess">Cess</option>
                <option value="rcm">Reverse Charge Mechanism</option>
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Optional description for this account"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
