'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface Product {
  id: string;
  name: string;
  sku: string;
  cost_price: string;
  reorder_point: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
}

interface ReorderRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingRule?: any | null;
}

export default function ReorderRuleModal({ isOpen, onClose, onSuccess, editingRule }: ReorderRuleModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [maxQuantity, setMaxQuantity] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [priority, setPriority] = useState('normal');

  useEffect(() => {
    if (isOpen) {
      fetchWarehouses();
      fetchSuppliers();
      
      // Populate form if editing
      if (editingRule) {
        setSelectedProduct({
          id: editingRule.product_id,
          name: editingRule.product_name,
          sku: editingRule.product_sku,
          cost_price: '',
          reorder_point: editingRule.reorder_point
        });
        setWarehouseId(editingRule.warehouse_id || '');
        setReorderPoint(editingRule.reorder_point);
        setReorderQuantity(editingRule.reorder_quantity);
        setMaxQuantity(editingRule.max_quantity || '');
        setLeadTimeDays(editingRule.lead_time_days ? String(editingRule.lead_time_days) : '7');
        setPriority(editingRule.priority || 'normal');
      }
    }
  }, [isOpen, editingRule]);

  // Debounced product search
  useEffect(() => {
    if (selectedProduct) {
      // Don't search if a product is already selected
      return;
    }

    if (searchTerm.length < 2) {
      setProducts([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchProducts(searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, selectedProduct]);

  const searchProducts = async (query: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/erp/inventory/products?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchSuppliers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/erp/purchasing/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
    
    // Pre-fill with product defaults if available
    if (product.reorder_point && parseFloat(product.reorder_point) > 0) {
      setReorderPoint(product.reorder_point);
    }
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
    setReorderPoint('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    if (!reorderPoint || !reorderQuantity) {
      alert('Reorder Point and Quantity are required');
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      setSubmitting(true);
      const method = editingRule ? 'PUT' : 'POST';
      const res = await fetch('/api/erp/inventory/procurement/reorder-rules', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(editingRule && { id: editingRule.id }),
          productId: selectedProduct.id,
          warehouseId: warehouseId || null,
          supplierId: supplierId || null,
          reorderPoint: parseFloat(reorderPoint),
          reorderQuantity: parseFloat(reorderQuantity),
          maxQuantity: maxQuantity ? parseFloat(maxQuantity) : null,
          leadTimeDays: parseInt(leadTimeDays),
          priority,
          isActive: true,
        }),
      });

      if (res.ok) {
        onSuccess();
        handleClose();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || `Failed to ${editingRule ? 'update' : 'create'} reorder rule`}`);
      }
    } catch (error) {
      console.error(`Error ${editingRule ? 'updating' : 'creating'} reorder rule:`, error);
      alert(`Error ${editingRule ? 'updating' : 'creating'} reorder rule. Check console for details.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedProduct(null);
    setProducts([]);
    setShowSuggestions(false);
    setWarehouseId('');
    setSupplierId('');
    setReorderPoint('');
    setReorderQuantity('');
    setMaxQuantity('');
    setLeadTimeDays('7');
    setPriority('normal');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
         onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900 leading-none">{editingRule ? 'Edit' : 'Create'} Reorder Rule</h3>
            <p className="text-sm text-slate-500 mt-1">Set automatic reorder points for inventory management</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Search or Selected Product */}
            {!selectedProduct ? (
              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Search Product <span className="text-red-500">*</span>
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                  placeholder="Search by name or SKU..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  required
                />
                
                {/* Product Suggestions Dropdown */}
                {showSuggestions && products.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        {product.cost_price && (
                          <div className="text-xs text-gray-400">Cost: ${parseFloat(product.cost_price).toFixed(2)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {showSuggestions && products.length === 0 && !loading && searchTerm.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    No products found
                  </div>
                )}

                {loading && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    Searching...
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Selected Product <span className="text-red-500">*</span>
                </label>
                <div className="w-full px-4 py-3 border border-green-300 bg-green-50 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{selectedProduct.name}</div>
                    <div className="text-sm text-slate-500">SKU: {selectedProduct.sku}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProduct}
                    className="p-1 hover:bg-red-100 rounded text-red-600 hover:text-red-700 transition-colors"
                    title="Clear selection"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Warehouse */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                Warehouse <span className="text-slate-400 text-xs normal-case">(Optional)</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Preferred Supplier */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                Preferred Supplier <span className="text-slate-400 text-xs normal-case">(Optional)</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="">Default/Primary Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.email ? `(${supplier.email})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Supplier to use for auto-generated purchase orders</p>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Reorder Point */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Min value (Default reorder point) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Minimum stock level</p>
              </div>

              {/* Reorder Quantity */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Max value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reorderQuantity}
                  onChange={(e) => setReorderQuantity(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Quantity to order</p>
              </div>

              {/* Max Quantity */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Max Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum stock level</p>
              </div>

              {/* Lead Time */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  placeholder="7"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">Supplier delivery time</p>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedProduct}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                {submitting ? (editingRule ? 'Updating...' : 'Creating...') : (editingRule ? 'Update Reorder Rule' : 'Create Reorder Rule')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}