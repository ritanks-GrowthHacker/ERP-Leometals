import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface GSTConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingConfig?: any;
}

interface IndianState {
  state_code: string;
  state_name: string;
}

export default function GSTConfigurationModal({
  isOpen,
  onClose,
  onSuccess,
  editingConfig,
}: GSTConfigurationModalProps) {
  const [formData, setFormData] = useState({
    gstin: '',
    legal_name: '',
    trade_name: '',
    state_code: '',
    registration_date: '',
    gst_type: 'regular' as 'regular' | 'composition' | 'sez',
    annual_turnover: '',
    is_primary: false,
    is_active: true,
  });
  const [states, setStates] = useState<IndianState[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchStates();
      if (editingConfig) {
        setFormData({
          gstin: editingConfig.gstin || '',
          legal_name: editingConfig.legal_name || '',
          trade_name: editingConfig.trade_name || '',
          state_code: editingConfig.state_code || '',
          registration_date: editingConfig.registration_date?.split('T')[0] || '',
          gst_type: editingConfig.gst_type || 'regular',
          annual_turnover: editingConfig.annual_turnover?.toString() || '',
          is_primary: editingConfig.is_primary || false,
          is_active: editingConfig.is_active !== false,
        });
      }
    }
  }, [isOpen, editingConfig]);

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
      newErrors.gstin = 'Invalid GSTIN format';
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

    setLoading(true);
    setSubmitError('');
    setSuccessMessage('');
    
    try {
      const token = getAuthToken();
      const method = editingConfig ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        annual_turnover: formData.annual_turnover ? parseFloat(formData.annual_turnover) : null,
        ...(editingConfig && { id: editingConfig.id }),
      };

      const response = await fetch('/api/erp/finance/gst/configuration', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccessMessage(editingConfig ? 'Configuration updated successfully!' : 'Configuration created successfully!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        const error = await response.json();
        setSubmitError(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save GST configuration:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingConfig ? 'Edit' : 'Add'} GST Configuration
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={loading}>
              <X size={24} />
            </button>
          </div>
          {submitError && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">{submitError}</span>
            </div>
          )}
          {successMessage && (
            <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-2">
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">{successMessage}</span>
            </div>
          )}
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
                className={`w-full border ${errors.gstin ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2`}
                placeholder="22AAAAA0000A1Z5"
              />
              {errors.gstin && <p className="text-xs text-red-600 mt-1">{errors.gstin}</p>}
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
                className={`w-full border ${errors.legal_name ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2`}
              />
              {errors.legal_name && <p className="text-xs text-red-600 mt-1">{errors.legal_name}</p>}
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state_code}
                onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                className={`w-full border ${errors.state_code ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2`}
              >
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.state_code} value={state.state_code}>
                    {state.state_name}
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
                className={`w-full border ${errors.registration_date ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2`}
              />
              {errors.registration_date && <p className="text-xs text-red-600 mt-1">{errors.registration_date}</p>}
            </div>

            {/* GST Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Type</label>
              <select
                value={formData.gst_type}
                onChange={(e) => setFormData({ ...formData, gst_type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="regular">Regular</option>
                <option value="composition">Composition</option>
                <option value="sez">SEZ</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Set as Primary GSTIN</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:bg-gray-300"
            >
              {loading ? 'Saving...' : (
                <>
                  <Save size={18} className="mr-2" />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
