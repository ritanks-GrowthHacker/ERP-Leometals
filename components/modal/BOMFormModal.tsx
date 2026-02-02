'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { RefreshCw } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface BOMFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BOMFormModal({ isOpen, onClose, onSuccess }: BOMFormModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [bomNumber, setBomNumber] = useState('');
  const [version, setVersion] = useState('1.0');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [scrapPercentage, setScrapPercentage] = useState('0');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (isOpen) {
      generateBOMNumber();
    }
  }, [isOpen]);

  // Debounced product search
  useEffect(() => {
    if (selectedProduct) return;

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

  const generateBOMNumber = async () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setBomNumber(`BOM-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select a product' });
      return;
    }

    if (!bomNumber) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'BOM Number is required' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/manufacturing/bom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bomNumber,
          productId: selectedProduct.id,
          version,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          scrapPercentage: parseFloat(scrapPercentage) || 0,
          notes,
          status,
          components: [], // Will be added later
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'BOM created successfully!' });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to create BOM: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error creating BOM:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create BOM. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setBomNumber('');
    setVersion('1.0');
    setEffectiveFrom('');
    setEffectiveTo('');
    setScrapPercentage('0');
    setNotes('');
    setStatus('active');
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
      <div className="bg-white rounded-xl max-w-2xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Create Bill of Materials</h3>
            <p className="text-sm text-slate-500 mt-1">Add a new BOM for manufacturing</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* BOM Number with Generate Button */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              BOM Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={bomNumber}
                onChange={(e) => setBomNumber(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="BOM-2024-001"
              />
              <button
                type="button"
                onClick={generateBOMNumber}
                disabled={generating}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                Generate
              </button>
            </div>
          </div>

          {/* Product Search */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Product <span className="text-red-500">*</span>
            </label>
            
            {selectedProduct ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{selectedProduct.name}</div>
                  <div className="text-sm text-slate-600">SKU: {selectedProduct.sku}</div>
                </div>
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="px-3 py-1 text-sm bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Type to search products..."
                />
                
                {loading && (
                  <div className="absolute right-3 top-11 text-slate-400">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-blue-500"></div>
                  </div>
                )}

                {showSuggestions && products.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-600">SKU: {product.sku}</div>
                      </button>
                    ))}
                  </div>
                )}

                {showSuggestions && searchTerm.length >= 2 && products.length === 0 && !loading && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500">
                    No products found
                  </div>
                )}
              </>
            )}
          </div>

          {/* Version and Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Effective From
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Effective To
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Scrap Percentage and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Scrap Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={scrapPercentage}
                onChange={(e) => setScrapPercentage(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="0"
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
              placeholder="Additional notes or instructions..."
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
              disabled={submitting || !selectedProduct}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create BOM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
