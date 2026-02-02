'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';

interface SendStatementModalProps {
  isOpen: boolean;
  customer: any;
  onClose: () => void;
}

export default function SendStatementModal({ isOpen, customer, onClose }: SendStatementModalProps) {
  const { showAlert } = useAlert();
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);

  const handleSend = async () => {
    if (!email) {
      showAlert({ type: 'error', title: 'Error', message: 'Please enter email address' });
      return;
    }

    const token = getAuthToken();
    setSending(true);

    try {
      const response = await fetch('/api/erp/sales/statements/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: customer.id,
          email,
          startDate,
          endDate,
        }),
      });

      if (response.ok) {
        setShowEmailAnimation(true);
        setTimeout(() => {
          showAlert({ type: 'success', title: 'Success', message: 'Statement sent successfully' });
          onClose();
        }, 2000);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to send statement' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send statement' });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold">Send Statement</h2>
          <button onClick={onClose} className="text-white hover:bg-blue-500 rounded-full p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <div className="text-gray-900 font-semibold">{customer.name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={customer.email || 'Enter email'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Statement'}
            </button>
          </div>
        </div>
      </div>

      {/* Email Sent Animation */}
      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />
    </div>
  );
}
