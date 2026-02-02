'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface JournalLine {
  id: string;
  account_id: string;
  account_name: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
}

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface AddJournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  authToken: string;
}

export default function AddJournalEntryModal({
  isOpen,
  onClose,
  onSuccess,
  authToken,
}: AddJournalEntryModalProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    journal_type: 'general',
    transaction_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    narration: '',
  });
  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', account_id: '', account_name: '', description: '', debit_amount: '0', credit_amount: '0' },
    { id: '2', account_id: '', account_name: '', description: '', debit_amount: '0', credit_amount: '0' },
  ]);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchAccounts();
    }
  }, [isOpen, authToken]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/erp/finance/accounting/accounts', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now().toString(),
        account_id: '',
        account_name: '',
        description: '',
        debit_amount: '0',
        credit_amount: '0',
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 2) {
      setLines(lines.filter((line) => line.id !== id));
    }
  };

  const updateLine = (id: string, field: string, value: string) => {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updated = { ...line, [field]: value };
          
          // If account is selected, update account name
          if (field === 'account_id') {
            const account = accounts.find((a) => a.id === value);
            updated.account_name = account ? `${account.account_code} - ${account.account_name}` : '';
          }
          
          // If debit is entered, clear credit
          if (field === 'debit_amount' && parseFloat(value || '0') > 0) {
            updated.credit_amount = '0';
          }
          
          // If credit is entered, clear debit
          if (field === 'credit_amount' && parseFloat(value || '0') > 0) {
            updated.debit_amount = '0';
          }
          
          return updated;
        }
        return line;
      })
    );
  };

  const getTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || '0'), 0);
    const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || '0'), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { totalDebit, totalCredit, difference } = getTotals();
    
    // Validation
    if (Math.abs(difference) > 0.01) {
      // Show error toast
      const event = new CustomEvent('showToast', {
        detail: { message: 'Journal entry is not balanced! Debit and Credit totals must be equal.', type: 'error' }
      });
      window.dispatchEvent(event);
      return;
    }
    
    if (totalDebit === 0 || totalCredit === 0) {
      const event = new CustomEvent('showToast', {
        detail: { message: 'Journal entry must have both debit and credit entries.', type: 'error' }
      });
      window.dispatchEvent(event);
      return;
    }
    
    const validLines = lines.filter(
      (line) => line.account_id && (parseFloat(line.debit_amount) > 0 || parseFloat(line.credit_amount) > 0)
    );
    
    if (validLines.length < 2) {
      const event = new CustomEvent('showToast', {
        detail: { message: 'Journal entry must have at least 2 lines with accounts selected.', type: 'error' }
      });
      window.dispatchEvent(event);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/erp/finance/accounting/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: validLines.map((line) => ({
            account_id: line.account_id,
            description: line.description || formData.narration,
            debit_amount: parseFloat(line.debit_amount || '0'),
            credit_amount: parseFloat(line.credit_amount || '0'),
          })),
          total_debit: totalDebit,
          total_credit: totalCredit,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const event = new CustomEvent('showToast', {
          detail: { message: 'Journal entry created successfully!', type: 'success' }
        });
        window.dispatchEvent(event);
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          journal_type: 'general',
          transaction_date: new Date().toISOString().split('T')[0],
          reference_number: '',
          narration: '',
        });
        setLines([
          { id: '1', account_id: '', account_name: '', description: '', debit_amount: '0', credit_amount: '0' },
          { id: '2', account_id: '', account_name: '', description: '', debit_amount: '0', credit_amount: '0' },
        ]);
      } else {
        const event = new CustomEvent('showToast', {
          detail: { message: data.error || 'Failed to create journal entry', type: 'error' }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error creating journal entry:', error);
      const event = new CustomEvent('showToast', {
        detail: { message: 'Failed to create journal entry', type: 'error' }
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  };

  const { totalDebit, totalCredit, difference } = getTotals();
  const isBalanced = Math.abs(difference) < 0.01;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            New Journal Entry
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Journal Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.journal_type}
                onChange={(e) => setFormData({ ...formData, journal_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="general">General</option>
                <option value="sales">Sales</option>
                <option value="purchase">Purchase</option>
                <option value="payment">Payment</option>
                <option value="receipt">Receipt</option>
                <option value="opening">Opening</option>
                <option value="closing">Closing</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transaction Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., INV-2025-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Narration <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={formData.narration}
              onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Describe this journal entry..."
            />
          </div>

          {/* Journal Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Journal Lines
              </label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Line
              </button>
            </div>

            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Account
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Debit
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                      Credit
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lines.map((line) => (
                    <tr key={line.id} className="bg-white dark:bg-gray-800">
                      <td className="px-3 py-2">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Select Account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_code} - {acc.account_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit_amount}
                          onChange={(e) => updateLine(line.id, 'debit_amount', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit_amount}
                          onChange={(e) => updateLine(line.id, 'credit_amount', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Totals:
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                      ₹{totalDebit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                      ₹{totalCredit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Difference:
                    </td>
                    <td colSpan={2} className={`px-3 py-2 text-right text-sm font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      {isBalanced ? '✓ Balanced' : `₹${Math.abs(difference).toFixed(2)} ${difference > 0 ? 'Debit' : 'Credit'}`}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
              disabled={loading || !isBalanced}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Journal Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
