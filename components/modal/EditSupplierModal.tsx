'use client';

interface EditSupplierModalProps {
  isOpen: boolean;
  editFormData: any;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: any) => void;
}

export default function EditSupplierModal({
  isOpen,
  editFormData,
  onClose,
  onSubmit,
  onChange,
}: EditSupplierModalProps) {
  if (!isOpen || !editFormData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Edit Supplier</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-sm mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name || ''}
                    onChange={(e) => onChange({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Supplier Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.code || ''}
                    onChange={(e) => onChange({ ...editFormData, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email || ''}
                    onChange={(e) => onChange({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={editFormData.phone || ''}
                    onChange={(e) => onChange({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1">Website</label>
                  <input
                    type="url"
                    value={editFormData.website || ''}
                    onChange={(e) => onChange({ ...editFormData, website: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-sm mb-3">Address</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Street Address</label>
                  <input
                    type="text"
                    value={editFormData.address || ''}
                    onChange={(e) => onChange({ ...editFormData, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">City</label>
                    <input
                      type="text"
                      value={editFormData.city || ''}
                      onChange={(e) => onChange({ ...editFormData, city: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">State</label>
                    <input
                      type="text"
                      value={editFormData.state || ''}
                      onChange={(e) => onChange({ ...editFormData, state: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Country</label>
                    <input
                      type="text"
                      value={editFormData.country || ''}
                      onChange={(e) => onChange({ ...editFormData, country: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={editFormData.postalCode || ''}
                      onChange={(e) => onChange({ ...editFormData, postalCode: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-sm mb-3">Financial Information</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Tax ID / GST</label>
                  <input
                    type="text"
                    value={editFormData.taxId || ''}
                    onChange={(e) => onChange({ ...editFormData, taxId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Terms (days)</label>
                  <input
                    type="number"
                    value={editFormData.paymentTerms || 0}
                    onChange={(e) =>
                      onChange({
                        ...editFormData,
                        paymentTerms: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Currency</label>
                  <select
                    value={editFormData.currencyCode || 'INR'}
                    onChange={(e) => onChange({ ...editFormData, currencyCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Status and Notes */}
            <div>
              <div className="mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.isActive ?? true}
                    onChange={(e) =>
                      onChange({ ...editFormData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium">Active Supplier</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => onChange({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}