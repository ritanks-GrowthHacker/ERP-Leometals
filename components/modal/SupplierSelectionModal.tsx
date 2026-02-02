'use client';

import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, Plus, Check } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  unitPrice: string;
  leadTimeDays: number;
}

interface SupplierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onConfirm: (supplierId: string | null) => void;
}

export default function SupplierSelectionModal({
  isOpen,
  onClose,
  productId,
  productName,
  onConfirm,
}: SupplierSelectionModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [makePrimary, setMakePrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [newSupplierData, setNewSupplierData] = useState({
    supplierId: '',
    unitPrice: '',
    minimumOrderQuantity: '1',
    leadTimeDays: '7',
    isPrimary: false,
  });

  useEffect(() => {
    if (isOpen && productId) {
      fetchProductSuppliers();
      fetchAllSuppliers();
    }
  }, [isOpen, productId]);

  const fetchProductSuppliers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/erp/inventory/products/${productId}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Map the suppliers data to flatten the structure
        const mappedSuppliers = (data.suppliers || []).map((ps: any) => ({
          id: ps.supplier?.id || ps.supplierId,
          name: ps.supplier?.name || 'Unknown Supplier',
          email: ps.supplier?.email || '',
          phone: ps.supplier?.phone || '',
          isPrimary: ps.isPrimary || false,
          unitPrice: ps.unitPrice || '0',
          leadTimeDays: ps.leadTimeDays || 0,
        }));
        setSuppliers(mappedSuppliers);
        
        // Auto-select primary supplier
        const primarySupplier = mappedSuppliers.find((s: Supplier) => s.isPrimary);
        if (primarySupplier) {
          setSelectedSupplierId(primarySupplier.id);
        }
      }
    } catch (error) {
      console.error('Error fetching product suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSuppliers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching all suppliers:', error);
    }
  };

  const handleAddSupplierToProduct = async () => {
    if (!newSupplierData.supplierId || !newSupplierData.unitPrice) {
      alert('Please select a supplier and enter unit price');
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/erp/inventory/products/${productId}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: newSupplierData.supplierId,
          unitPrice: parseFloat(newSupplierData.unitPrice),
          minimumOrderQuantity: parseFloat(newSupplierData.minimumOrderQuantity),
          leadTimeDays: parseInt(newSupplierData.leadTimeDays),
          isPrimary: newSupplierData.isPrimary,
        }),
      });

      if (response.ok) {
        await fetchProductSuppliers();
        setShowAddSupplier(false);
        setNewSupplierData({
          supplierId: '',
          unitPrice: '',
          minimumOrderQuantity: '1',
          leadTimeDays: '7',
          isPrimary: false,
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add supplier');
      }
    } catch (error) {
      console.error('Error adding supplier:', error);
      alert('Error adding supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrimarySupplier = async (supplierId: string, isPrimary: boolean) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/products/${productId}/suppliers`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId,
          isPrimary,
        }),
      });

      if (response.ok) {
        await fetchProductSuppliers();
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
    }
  };

  const handleConfirm = () => {
    if (makePrimary && selectedSupplierId) {
      handleUpdatePrimarySupplier(selectedSupplierId, true);
    }
    onConfirm(selectedSupplierId);
    onClose();
  };

  const handleCancel = () => {
    // If no supplier selected, it will go to primary supplier (default behavior)
    onConfirm(null);
    onClose();
  };

  if (!isOpen) return null;

  const availableSuppliers = allSuppliers.filter(
    (s) => !suppliers.find((ps) => ps.id === s.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="max-w-2xl w-full mx-4 bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Supplier for Purchase Order</h3>
            <p className="text-sm text-gray-500 mt-1">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && suppliers.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-gray-500 mt-2">Loading suppliers...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No suppliers assigned to this product</p>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Add Supplier
              </button>
            </div>
          ) : (
            <>
              {/* Supplier List */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700">Select Supplier</h4>
                  {!showAddSupplier && (
                    <button
                      onClick={() => setShowAddSupplier(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add to Product
                    </button>
                  )}
                </div>

                {allSuppliers.map((supplier) => (
                  // Check if this supplier is already assigned to product
                  // to show "Primary" or "Assigned" badge
                  <div
                    key={supplier.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSupplierId === supplier.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedSupplierId(supplier.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Radio button */}
                        <div className="mt-0.5">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedSupplierId === supplier.id
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedSupplierId === supplier.id && (
                              <Check size={12} className="text-white" />
                            )}
                          </div>
                        </div>

                        {/* Supplier info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium text-gray-900">{supplier.name}</h5>
                            {(() => {
                              const productSupplier = suppliers.find(s => s.id === supplier.id);
                              if (productSupplier?.isPrimary) {
                                return (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                                    Primary
                                  </span>
                                );
                              } else if (productSupplier) {
                                return (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                                    Assigned
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {supplier.email && (
                            <p className="text-sm text-gray-500 mt-1">{supplier.email}</p>
                          )}
                          {supplier.phone && (
                            <p className="text-sm text-gray-500">{supplier.phone}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            {(() => {
                              const productSupplier = suppliers.find(s => s.id === supplier.id);
                              return (
                                <>
                                  {productSupplier?.unitPrice && (
                                    <span>Unit Price: ₹{parseFloat(productSupplier.unitPrice).toFixed(2)}</span>
                                  )}
                                  {productSupplier?.leadTimeDays && (
                                    <span>Lead Time: {productSupplier.leadTimeDays} days</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Make Primary Checkbox */}
              {selectedSupplierId && (() => {
                const productSupplier = suppliers.find(s => s.id === selectedSupplierId);
                if (productSupplier && !productSupplier.isPrimary) {
                  return (
                    <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={makePrimary}
                          onChange={(e) => setMakePrimary(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Make this supplier the primary supplier for this product
                        </span>
                      </label>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {/* Add Supplier Form */}
          {showAddSupplier && (
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">Add New Supplier</h4>
                <button
                  onClick={() => setShowAddSupplier(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Supplier *
                  </label>
                  <select
                    value={newSupplierData.supplierId}
                    onChange={(e) =>
                      setNewSupplierData({ ...newSupplierData, supplierId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a supplier...</option>
                    {availableSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} {supplier.email ? `(${supplier.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Price * (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newSupplierData.unitPrice}
                      onChange={(e) =>
                        setNewSupplierData({ ...newSupplierData, unitPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lead Time (days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newSupplierData.leadTimeDays}
                      onChange={(e) =>
                        setNewSupplierData({ ...newSupplierData, leadTimeDays: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min. Order Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSupplierData.minimumOrderQuantity}
                    onChange={(e) =>
                      setNewSupplierData({
                        ...newSupplierData,
                        minimumOrderQuantity: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSupplierData.isPrimary}
                      onChange={(e) =>
                        setNewSupplierData({ ...newSupplierData, isPrimary: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Set as primary supplier</span>
                  </label>
                </div>

                <button
                  onClick={handleAddSupplierToProduct}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300"
                >
                  {loading ? 'Adding...' : 'Add Supplier to Product'}
                </button>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Note</p>
                <p className="text-blue-700">
                  If you don't select any supplier, the purchase order will be sent to the primary
                  supplier automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-300"
            >
              {selectedSupplierId ? 'Create PO with Selected Supplier' : 'Use Primary Supplier'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
