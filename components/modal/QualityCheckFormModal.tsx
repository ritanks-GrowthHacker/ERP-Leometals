'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface QualityCheckFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QualityCheckFormModal({ isOpen, onClose, onSuccess }: QualityCheckFormModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [qcNumber, setQcNumber] = useState('');
  const [inspectionType, setInspectionType] = useState('incoming');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantityInspected, setQuantityInspected] = useState('');
  const [quantityAccepted, setQuantityAccepted] = useState('');
  const [quantityRejected, setQuantityRejected] = useState('');
  const [defectsFound, setDefectsFound] = useState('');
  const [status, setStatus] = useState('pending');
  const [inspectionDate, setInspectionDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateQCNumber();
      generateBatchNumber();
      setInspectionDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Auto-calculate rejected quantity
  useEffect(() => {
    const inspected = parseInt(quantityInspected) || 0;
    const accepted = parseInt(quantityAccepted) || 0;
    const rejected = Math.max(0, inspected - accepted);
    setQuantityRejected(rejected.toString());
  }, [quantityInspected, quantityAccepted]);

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

  const generateQCNumber = async () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setQcNumber(`QC-${timestamp}-${random}`);
    setGenerating(false);
  };

  const generateBatchNumber = async () => {
    setGeneratingBatch(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setBatchNumber(`BATCH-${timestamp}-${random}`);
    setGeneratingBatch(false);
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

    if (!qcNumber) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'QC Number is required' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Authentication Error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/manufacturing/quality', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          qcNumber,
          productId: selectedProduct.id,
          inspectionType,
          batchNumber,
          quantityInspected: parseInt(quantityInspected) || 0,
          quantityAccepted: parseInt(quantityAccepted) || 0,
          quantityRejected: parseInt(quantityRejected) || 0,
          defectsFound,
          status,
          inspectionDate,
          notes,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Quality Check created successfully!' });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to create Quality Check: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error creating Quality Check:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create Quality Check. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setQcNumber('');
    setInspectionType('incoming');
    setBatchNumber('');
    setQuantityInspected('');
    setQuantityAccepted('');
    setQuantityRejected('');
    setDefectsFound('');
    setStatus('pending');
    setInspectionDate('');
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
      <div className="bg-white rounded-xl max-w-3xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Create Quality Check</h3>
            <p className="text-sm text-slate-500 mt-1">Add a new quality inspection record</p>
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
          {/* QC Number with Generate Button */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              QC Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={qcNumber}
                onChange={(e) => setQcNumber(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="QC-2024-001"
              />
              <button
                type="button"
                onClick={generateQCNumber}
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

          {/* Inspection Type and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Inspection Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="incoming">Incoming</option>
                <option value="in-process">In-Process</option>
                <option value="final">Final</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Inspection Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Batch Number and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Batch Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="BATCH-2024-001"
                />
                <button
                  type="button"
                  onClick={generateBatchNumber}
                  disabled={generatingBatch}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={generatingBatch ? 'animate-spin' : ''} />
                </button>
              </div>
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
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="conditional">Conditional</option>
              </select>
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Quantity Inspected
              </label>
              <input
                type="number"
                value={quantityInspected}
                onChange={(e) => setQuantityInspected(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Quantity Accepted
              </label>
              <input
                type="number"
                value={quantityAccepted}
                onChange={(e) => setQuantityAccepted(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Quantity Rejected (Auto)
              </label>
              <input
                type="number"
                value={quantityRejected}
                readOnly
                className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                placeholder="0"
              />
            </div>
          </div>

          {/* Defects Found */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Defects Found
            </label>
            <textarea
              value={defectsFound}
              onChange={(e) => setDefectsFound(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Describe any defects or issues found..."
            />
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
              placeholder="Additional notes or observations..."
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
              {submitting ? 'Creating...' : 'Create Quality Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
