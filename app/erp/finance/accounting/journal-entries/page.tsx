'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Plus, FileText, Calendar, Check, X } from 'lucide-react';
import AddJournalEntryModal from '@/components/modals/AddJournalEntryModal';

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const fetchJournalEntries = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/erp/finance/accounting/journal-entries', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setEntries(data.journalEntries || []);
      }
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: any = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft', icon: FileText },
      posted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Posted', icon: Check },
      reversed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Reversed', icon: X },
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon size={12} className="mr-1" />
        {badge.label}
      </span>
    );
  };

  const filteredEntries = entries.filter(entry => {
    if (filter === 'all') return true;
    return entry.status === filter;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Journal Entries</h2>
          <p className="text-sm text-gray-500">Record and manage accounting transactions</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus size={20} className="mr-2" />
          New Journal Entry
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Entries
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filter === 'draft'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Drafts
          </button>
          <button
            onClick={() => setFilter('posted')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filter === 'posted'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Posted
          </button>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading journal entries...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No journal entries found</p>
            <p className="text-sm text-gray-400">Create your first journal entry to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Journal #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Narration</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 text-sm font-mono text-blue-600">{entry.journal_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(entry.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.reference_number || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{entry.narration}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    ₹{parseFloat(entry.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    ₹{parseFloat(entry.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(entry.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Journal Entry Modal */}
      <AddJournalEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchJournalEntries();
          setIsModalOpen(false);
        }}
        authToken={getAuthToken() || ''}
      />
    </div>
  );
}
