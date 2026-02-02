'use client';
import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SupplierFormModal({ isOpen, onClose, onSuccess }: SupplierFormModalProps) {
  const { showAlert } = useAlert();
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form fields
  const [supplierCode, setSupplierCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [creditLimit, setCreditLimit] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateSupplierCode();
    }
  }, [isOpen]);

  const generateSupplierCode = async () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setSupplierCode(`SUP-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierCode || !name) {
      showAlert({ type: 'error', message: 'Supplier Code and Name are required' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/purchasing/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: supplierCode,
          name,
          email,
          phone,
          address,
          city,
          state,
          country,
          postalCode: pincode,
          taxId: gstNumber || panNumber,
          paymentTerms: paymentTerms === 'net30' ? 30 : paymentTerms === 'net60' ? 60 : 15,
          currencyCode: 'INR',
          notes,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success!', message: 'Supplier created successfully' });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Failed to create supplier', message: error.error || 'Unknown error' });
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create supplier. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierCode('');
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setCountry('India');
    setGstNumber('');
    setPanNumber('');
    setPaymentTerms('net30');
    setCreditLimit('');
    setStatus('active');
    setNotes('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
   <div 
  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  onClick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div className="bg-white rounded-xl max-w-4xl w-full mx-auto shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Create Supplier</h3>
        <p className="text-sm text-slate-500 mt-1">Add a new supplier to the system</p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        disabled={submitting}
        className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 disabled:opacity-50"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {/* Form - Scrollable Area */}
    <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Supplier Code with Generate Button */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Supplier Code <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="SUP-2024-001"
            />
            <button
              type="button"
              onClick={generateSupplierCode}
              disabled={generating}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
              Generate
            </button>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="ABC Suppliers Pvt Ltd"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Contact Person
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="supplier@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="+91 1234567890"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            placeholder="Street address, Building name, etc."
          />
        </div>

        {/* Location Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Mumbai"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Maharashtra"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pincode
            </label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="400001"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="India"
            />
          </div>
        </div>

        {/* Tax Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              GST Number
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="29XXXXX1234X1Z5"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              PAN Number
            </label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="ABCDE1234F"
            />
          </div>
        </div>

        {/* Payment Terms and Credit Limit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="immediate">Immediate</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="net45">Net 45</option>
              <option value="net60">Net 60</option>
              <option value="net90">Net 90</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Credit Limit (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="100000"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            placeholder="Additional notes about the supplier..."
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
  );
}
