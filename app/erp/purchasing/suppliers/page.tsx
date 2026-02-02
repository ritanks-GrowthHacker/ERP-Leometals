'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthToken } from '@/lib/utils/token';
import Link from 'next/link';
import SupplierFormModal from '@/components/modal/SupplierFormModal';
import { useAlert } from '@/components/common/CustomAlert';

interface Supplier {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  taxId: string;
  paymentTerms: number;
  currencyCode: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  isPrimary: boolean;
}

export default function SuppliersPage() {
  const { showAlert } = useAlert();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    taxId: '',
    paymentTerms: 30,
    currencyCode: 'INR',
    notes: '',
  });
  const [contacts, setContacts] = useState<Array<{
    name: string;
    email: string;
    phone: string;
    position: string;
    isPrimary: boolean;
  }>>([]);

  const fetchSuppliers = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          contacts: contacts.length > 0 ? contacts : undefined,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          name: '',
          code: '',
          email: '',
          phone: '',
          website: '',
          address: '',
          city: '',
          state: '',
          country: '',
          postalCode: '',
          taxId: '',
          paymentTerms: 30,
          currencyCode: 'INR',
          notes: '',
        });
        setContacts([]);
        fetchSuppliers();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create supplier' });
      }
    } catch (error) {
      console.error('Failed to create supplier:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create supplier' });
    }
  };

  const addContact = () => {
    setContacts([...contacts, {
      name: '',
      email: '',
      phone: '',
      position: '',
      isPrimary: contacts.length === 0,
    }]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: string, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.isActive).length,
    inactive: suppliers.filter(s => !s.isActive).length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Suppliers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your vendor directory</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.total}</div>
          <div className="text-sm font-medium text-gray-600 mt-1">Total Suppliers</div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{loading ? '...' : stats.active}</div>
          <div className="text-sm font-medium text-gray-600 mt-1">Active Suppliers</div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-2xl font-bold text-gray-400">{loading ? '...' : stats.inactive}</div>
          <div className="text-sm font-medium text-gray-600 mt-1">Inactive Suppliers</div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">All Suppliers</h3>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No suppliers found. Click "Add Supplier" to create one.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment Terms</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-sm font-medium text-gray-900">{supplier.code || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-500">{supplier.taxId || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{supplier.email || '—'}</div>
                      <div className="text-sm text-gray-500">{supplier.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {supplier.city && supplier.state
                          ? `${supplier.city}, ${supplier.state}`
                          : supplier.city || supplier.state || '—'}
                      </div>
                      <div className="text-sm text-gray-500">{supplier.country || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{supplier.paymentTerms} days</div>
                      <div className="text-sm text-gray-500">{supplier.currencyCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        supplier.isActive
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <Link href={`/erp/purchasing/suppliers/${supplier.id}`}>
                          <button className="text-blue-600 hover:text-blue-700 font-medium">View</button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Supplier Modal */}
      <SupplierFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchSuppliers}
      />
    </div>
  );
}
