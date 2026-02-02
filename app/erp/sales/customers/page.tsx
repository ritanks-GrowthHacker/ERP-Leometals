'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { inputFieldDesign, modalLabels } from '@/components/modal/modalInputDesigns';
import { X, Plus, Users, Building2, Mail, Phone, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';
import { useAlert } from '@/components/common/CustomAlert';
import CustomerOrdersModal from '@/components/modal/CustomerOrdersModal';
import SendStatementModal from '@/components/modal/SendStatementModal';
import CustomerLifecycleModal from '@/components/modal/CustomerLifecycleModal';

interface Customer {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  isActive: boolean;
  creditLimit: string;
  paymentTerms: number;
  billingAddress?: string;
  shippingAddress?: string;
  postalCode?: string;
  taxId?: string;
  website?: string;
  notes?: string;
}

export default function CustomersPage() {
  const { showAlert } = useAlert();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Lifecycle Modal State
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [lifecycleCustomerId, setLifecycleCustomerId] = useState<string>('');
  const itemsPerPage = 15;
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    website: '',
    billingAddress: '',
    shippingAddress: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    taxId: '',
    paymentTerms: '30',
    creditLimit: '0',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(
        `/api/erp/sales/customers?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getAuthToken();
    const url = editingCustomer
      ? `/api/erp/sales/customers/${editingCustomer.id}`
      : '/api/erp/sales/customers';
    const method = editingCustomer ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showAlert({ 
          type: 'success', 
          title: 'Success', 
          message: editingCustomer ? 'Customer updated successfully!' : 'Customer created successfully!' 
        });
        resetForm();
        fetchCustomers();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to save customer' });
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save customer' });
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      code: customer.code || '',
      email: customer.email || '',
      phone: customer.phone || '',
      website: '',
      billingAddress: '',
      shippingAddress: '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'India',
      postalCode: '',
      taxId: '',
      paymentTerms: customer.paymentTerms?.toString() || '30',
      creditLimit: customer.creditLimit || '0',
      notes: '',
      isActive: customer.isActive !== false,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      billingAddress: '',
      shippingAddress: '',
      city: '',
      state: '',
      country: 'India',
      postalCode: '',
      taxId: '',
      paymentTerms: '30',
      creditLimit: '0',
      notes: '',
      isActive: true,
    });
  };

  const generateCustomerCode = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const code = `CUST-${timestamp}-${random}`;
    setFormData({ ...formData, code });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            // Auto-generate code when creating new customer
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000);
            setFormData(prev => ({ ...prev, code: `CUST-${timestamp}-${random}` }));
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Customers</div>
          <div className="text-2xl font-bold text-gray-900">{customers.length}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Active Customers</div>
          <div className="text-2xl font-bold text-green-600">
            {customers.filter(c => c.isActive).length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Credit Limit</div>
          <div className="text-2xl font-bold text-blue-600">
            ₹{customers.reduce((sum, c) => sum + parseFloat(c.creditLimit || '0'), 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Avg Payment Terms</div>
          <div className="text-2xl font-bold text-gray-900">
            {customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.paymentTerms, 0) / customers.length) : 0} days
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Customer List</h3>
          <div className="text-sm text-gray-600">
            Showing {customers.length} customers {totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-gray-500 mt-4">Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-gray-500 mt-4">No customers yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first customer
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <React.Fragment key={customer.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === customer.id ? null : customer.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                          
                          {customer.code || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="text-gray-400" size={16} />
                          <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex flex-col gap-1">
                          {customer.email && (
                            <div className="flex items-center gap-1">
                              <Mail size={12} className="text-gray-400" />
                              <span>{customer.email}</span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={12} className="text-gray-400" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.city || customer.state || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₹{parseFloat(customer.creditLimit || '0').toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {customer.paymentTerms} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                       {expandedRow === customer.id ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </td>
                    </tr>
                    {expandedRow === customer.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-gray-50">
                          <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                            >
                              Edit Customer
                            </button>
                            <button
                              onClick={() => { setSelectedCustomer(customer); setShowOrdersModal(true); }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
                            >
                              View Orders
                            </button>
                            <button
                              onClick={() => { setLifecycleCustomerId(customer.id); setShowLifecycleModal(true); }}
                              className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-100 font-medium text-sm"
                            >
                              View Lifecycle
                            </button>
                            <button
                              onClick={() => { setSelectedCustomer(customer); setShowStatementModal(true); }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
                            >
                              Send Statement
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Billing Address</div>
                              <div className="text-sm text-gray-900">{customer.billingAddress || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Shipping Address</div>
                              <div className="text-sm text-gray-900">{customer.shippingAddress || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Postal Code</div>
                              <div className="text-sm text-gray-900">{customer.postalCode || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Tax ID</div>
                              <div className="text-sm text-gray-900">{customer.taxId || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Website</div>
                              <div className="text-sm text-gray-900">{customer.website || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Notes</div>
                              <div className="text-sm text-gray-900">{customer.notes || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Customer Modal */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && resetForm()}
        >
          <div className="bg-white rounded-xl max-w-3xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Enter customer details below</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabels}>Customer Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div>
                  <label className={modalLabels}>
                    Customer Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className={`flex-1 px-3 py-2 border rounded-lg ${inputFieldDesign} ${editingCustomer ? 'bg-slate-50' : 'bg-blue-50'}`}
                      placeholder="Auto-generated"
                      readOnly={!!editingCustomer}
                      required
                    />
                    {!editingCustomer && (
                      <button
                        type="button"
                        onClick={generateCustomerCode}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className={modalLabels}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className={modalLabels}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label className={modalLabels}>Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className={modalLabels}>Tax ID / GST</label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                    placeholder="GSTIN or Tax ID"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={modalLabels}>Billing Address</label>
                    <textarea
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      rows={2}
                      placeholder="Enter billing address"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={modalLabels}>Shipping Address</label>
                    <textarea
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      rows={2}
                      placeholder="Enter shipping address"
                    />
                  </div>

                  <div>
                    <label className={modalLabels}>City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className={modalLabels}>State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className={modalLabels}>Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="Country"
                    />
                  </div>

                  <div>
                    <label className={modalLabels}>Postal Code</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-4">Financial Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={modalLabels}>Payment Terms (Days)</label>
                    <input
                      type="number"
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <label className={modalLabels}>Credit Limit (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Status */}
              {editingCustomer && (
                <div className="bg-gray-50/40 p-5 rounded-xl border border-gray-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Customer Status</h4>
                      <p className="text-xs text-gray-500 mt-1">Mark customer as inactive to hide from selection</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive !== false}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {formData.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={modalLabels}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${inputFieldDesign}`}
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomerOrdersModal
        isOpen={showOrdersModal}
        customer={selectedCustomer}
        onClose={() => { setShowOrdersModal(false); setSelectedCustomer(null); }}
      />

      <SendStatementModal
        isOpen={showStatementModal}
        customer={selectedCustomer}
        onClose={() => { setShowStatementModal(false); setSelectedCustomer(null); }}
      />

      {/* Customer Lifecycle Modal */}
      <CustomerLifecycleModal
        isOpen={showLifecycleModal}
        customerId={lifecycleCustomerId}
        onClose={() => setShowLifecycleModal(false)}
      />
    </div>
  );
}
