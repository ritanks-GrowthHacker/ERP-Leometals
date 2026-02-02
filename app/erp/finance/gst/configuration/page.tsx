'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { 
  Building, Plus, Edit, Trash2, CheckCircle, XCircle, 
  AlertCircle, Save, X, Star
} from 'lucide-react';

interface GSTConfig {
  id: string;
  gstin: string;
  legal_name: string;
  trade_name?: string;
  state_code: string;
  registration_date: string;
  gst_type: 'regular' | 'composition' | 'sez';
  composition_scheme: boolean;
  annual_turnover?: number;
  is_active: boolean;
  is_primary: boolean;
}

interface IndianState {
  state_code: string;
  state_name: string;
  tin_code: string;
  is_union_territory: boolean;
}

export default function GSTConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [configurations, setConfigurations] = useState<GSTConfig[]>([]);
  const [states, setStates] = useState<IndianState[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    gstin: '',
    legal_name: '',
    trade_name: '',
    state_code: '',
    registration_date: '',
    gst_type: 'regular' as 'regular' | 'composition' | 'sez',
    composition_scheme: false,
    annual_turnover: '',
    is_active: true,
    is_primary: false,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchConfigurations();
    fetchStates();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/finance/gst/configuration', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigurations(data.configurations || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch GST configurations:', error);
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const response = await fetch('/api/erp/finance/master/indian-states');
      if (response.ok) {
        const data = await response.json();
        setStates(data.states || []);
      }
    } catch (error) {
      console.error('Failed to fetch states:', error);
    }
  };

  const validateGSTIN = (gstin: string): boolean => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.gstin.trim()) {
      newErrors.gstin = 'GSTIN is required';
    } else if (!validateGSTIN(formData.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format (15 characters)';
    }

    if (!formData.legal_name.trim()) {
      newErrors.legal_name = 'Legal name is required';
    }

    if (!formData.state_code) {
      newErrors.state_code = 'State is required';
    }

    if (!formData.registration_date) {
      newErrors.registration_date = 'Registration date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const token = getAuthToken();
      const url = editingId
        ? `/api/erp/finance/gst/configuration`
        : '/api/erp/finance/gst/configuration';
      
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        annual_turnover: formData.annual_turnover ? parseFloat(formData.annual_turnover) : null,
        ...(editingId && { id: editingId }),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(editingId ? 'GST configuration updated successfully!' : 'GST configuration created successfully!');
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchConfigurations();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to save GST configuration'}`);
      }
    } catch (error) {
      console.error('Failed to save GST configuration:', error);
      alert('Failed to save GST configuration. Please try again.');
    }
  };

  const handleEdit = (config: GSTConfig) => {
    setFormData({
      gstin: config.gstin,
      legal_name: config.legal_name,
      trade_name: config.trade_name || '',
      state_code: config.state_code,
      registration_date: config.registration_date.split('T')[0],
      gst_type: config.gst_type,
      composition_scheme: config.composition_scheme,
      annual_turnover: config.annual_turnover?.toString() || '',
      is_active: config.is_active,
      is_primary: config.is_primary,
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this GST configuration?')) {
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/finance/gst/configuration?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        alert('GST configuration deleted successfully!');
        fetchConfigurations();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to delete GST configuration'}`);
      }
    } catch (error) {
      console.error('Failed to delete GST configuration:', error);
      alert('Failed to delete GST configuration. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      gstin: '',
      legal_name: '',
      trade_name: '',
      state_code: '',
      registration_date: '',
      gst_type: 'regular',
      composition_scheme: false,
      annual_turnover: '',
      is_active: true,
      is_primary: false,
    });
    setErrors({});
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">GST Configuration</h2>
          <p className="text-sm text-gray-500">Manage your organization's GSTIN details</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Add GSTIN
        </button>
      </div>

      {/* Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit GST Configuration' : 'Add GST Configuration'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* GSTIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    className={`w-full border ${errors.gstin ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  {errors.gstin && <p className="text-xs text-red-600 mt-1">{errors.gstin}</p>}
                  <p className="text-xs text-gray-500 mt-1">Format: 2 digits (state) + 10 digits (PAN) + 3 characters</p>
                </div>

                {/* Legal Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.legal_name}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className={`w-full border ${errors.legal_name ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="ABC Private Limited"
                  />
                  {errors.legal_name && <p className="text-xs text-red-600 mt-1">{errors.legal_name}</p>}
                </div>

                {/* Trade Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trade Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.trade_name}
                    onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC Company"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.state_code}
                    onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                    className={`w-full border ${errors.state_code ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.state_code} value={state.state_code}>
                        {state.state_name} ({state.state_code})
                      </option>
                    ))}
                  </select>
                  {errors.state_code && <p className="text-xs text-red-600 mt-1">{errors.state_code}</p>}
                </div>

                {/* Registration Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.registration_date}
                    onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                    className={`w-full border ${errors.registration_date ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {errors.registration_date && <p className="text-xs text-red-600 mt-1">{errors.registration_date}</p>}
                </div>

                {/* GST Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GST Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gst_type}
                    onChange={(e) => setFormData({ ...formData, gst_type: e.target.value as 'regular' | 'composition' | 'sez' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="composition">Composition Scheme</option>
                    <option value="sez">SEZ</option>
                  </select>
                </div>

                {/* Annual Turnover */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Turnover (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.annual_turnover}
                    onChange={(e) => setFormData({ ...formData, annual_turnover: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10000000"
                    step="0.01"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.composition_scheme}
                      onChange={(e) => setFormData({ ...formData, composition_scheme: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Composition Scheme</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_primary}
                      onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Set as Primary GSTIN</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Save size={18} className="mr-2" />
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configurations List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading configurations...</p>
          </div>
        ) : configurations.length > 0 ? (
          configurations.map((config) => (
            <div key={config.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Building className="text-blue-600 mr-2" size={24} />
                    <h3 className="text-lg font-semibold text-gray-900">{config.legal_name}</h3>
                    {config.is_primary && (
                      <span className="ml-3 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                        <Star size={12} className="mr-1" fill="currentColor" />
                        Primary
                      </span>
                    )}
                    {config.is_active ? (
                      <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                        <CheckCircle size={12} className="mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="ml-2 bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                        <XCircle size={12} className="mr-1" />
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">GSTIN</p>
                      <p className="text-sm font-mono font-semibold text-gray-900">{config.gstin}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">State</p>
                      <p className="text-sm text-gray-900">{config.state_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">GST Type</p>
                      <p className="text-sm text-gray-900 capitalize">{config.gst_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Registration Date</p>
                      <p className="text-sm text-gray-900">
                        {new Date(config.registration_date).toLocaleDateString()}
                      </p>
                    </div>
                    {config.trade_name && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Trade Name</p>
                        <p className="text-sm text-gray-900">{config.trade_name}</p>
                      </div>
                    )}
                    {config.annual_turnover && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Annual Turnover</p>
                        <p className="text-sm text-gray-900">
                          ₹{config.annual_turnover.toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No GST Configurations</h3>
            <p className="text-gray-600 mb-6">Add your first GSTIN to start managing GST compliance</p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <Plus size={20} className="mr-2" />
              Add First GSTIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
