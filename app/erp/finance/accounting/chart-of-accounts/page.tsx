'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Plus, Edit, Trash2, Search, BookOpen } from 'lucide-react';
import AddAccountModal from '@/components/modals/AddAccountModal';

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/erp/finance/accounting/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         acc.account_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || acc.account_type === filterType;
    return matchesSearch && matchesType;
  });

  const getAccountTypeBadge = (type: string) => {
    const badges: any = {
      asset: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Asset' },
      liability: { bg: 'bg-red-100', text: 'text-red-700', label: 'Liability' },
      equity: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Equity' },
      revenue: { bg: 'bg-green-100', text: 'text-green-700', label: 'Revenue' },
      expense: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Expense' },
    };
    const badge = badges[type] || badges.asset;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Chart of Accounts</h2>
          <p className="text-sm text-gray-500">Manage your general ledger accounts</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Add Account
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Account Types</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading accounts...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No accounts found</p>
            <p className="text-sm text-gray-400">Create your first account to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{account.account_code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{account.account_name}</td>
                  <td className="px-6 py-4 text-sm">{getAccountTypeBadge(account.account_type)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ₹{parseFloat(account.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button className="text-blue-600 hover:text-blue-700 mr-3">
                      <Edit size={16} />
                    </button>
                    <button className="text-red-600 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchAccounts();
          setIsModalOpen(false);
        }}
        authToken={getAuthToken() || ''}
      />
    </div>
  );
}
