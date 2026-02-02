'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RefreshCw } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface BOMEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bom: any;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface BOMLine {
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: string;
  uom: string;
  scrapPercentage: string;
  componentType: string;
  searchTerm?: string;
  showSuggestions?: boolean;
}

export default function BOMEditModal({ isOpen, onClose, onSuccess, bom }: BOMEditModalProps) {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form fields
  const [bomNumber, setBomNumber] = useState('');
  const [version, setVersion] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [scrapPercentage, setScrapPercentage] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [bomLines, setBomLines] = useState<BOMLine[]>([]);

  useEffect(() => {
    if (isOpen && bom) {
      // Load BOM data
      setBomNumber(bom.bomNumber || '');
      setVersion(bom.version || '');
      setEffectiveFrom(bom.effectiveFrom || '');
      setEffectiveTo(bom.effectiveTo || '');
      setScrapPercentage(bom.scrapPercentage?.toString() || '');
      setStatus(bom.status || 'active');
      setNotes(bom.notes || '');

      // Set selected product
      if (bom.productId) {
        setSelectedProduct({
          id: bom.productId,
          name: bom.productName || '',
          sku: bom.productSku || '',
        });
      }

      // Load BOM lines
      if (bom.components && Array.isArray(bom.components)) {
        setBomLines(bom.components.map((comp: any) => ({
          productId: comp.componentProductId || '',
          productName: comp.componentName || '',
          productSku: comp.componentSku || '',
          quantity: comp.quantity?.toString() || '1',
          uom: comp.uom || 'units',
          scrapPercentage: comp.scrapPercentage?.toString() || '0',
          componentType: comp.componentType || 'raw_material',
          searchTerm: comp.componentName || '',
          showSuggestions: false,
        })));
      } else if (bom.lines && Array.isArray(bom.lines)) {
        setBomLines(bom.lines.map((line: any) => ({
          productId: line.componentId || line.productId || '',
          productName: line.componentName || line.productName || '',
          productSku: line.componentSku || line.productSku || '',
          quantity: line.quantity?.toString() || '1',
          uom: line.uom || 'units',
          scrapPercentage: line.scrapPercentage?.toString() || '0',
          componentType: line.componentType || 'raw_material',
          searchTerm: line.componentName || line.productName || '',
          showSuggestions: false,
        })));
      }
    }
  }, [isOpen, bom]);

  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) return;
    
    const token = getAuthToken();
    try {
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
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) searchProducts(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addBOMLine = () => {
    setBomLines([
      ...bomLines,
      {
        productId: '',
        productName: '',
        productSku: '',
        quantity: '1',
        uom: 'units',
        scrapPercentage: '0',
        componentType: 'raw_material',
        searchTerm: '',
        showSuggestions: false,
      },
    ]);
  };

  const removeBOMLine = (index: number) => {
    setBomLines(bomLines.filter((_, i) => i !== index));
  };

  const updateBOMLine = (index: number, field: keyof BOMLine, value: string) => {
    const updated = [...bomLines];
    updated[index] = { ...updated[index], [field]: value };
    setBomLines(updated);
  };

  const selectComponentProduct = (index: number, product: Product) => {
    const updated = [...bomLines];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      searchTerm: product.name,
      showSuggestions: false,
    };
    setBomLines(updated);
  };

  const searchComponentProducts = async (index: number, query: string) => {
    if (!query || query.length < 2) {
      const updated = [...bomLines];
      updated[index].showSuggestions = false;
      setBomLines(updated);
      return;
    }
    
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/inventory/products?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        const updated = [...bomLines];
        updated[index].showSuggestions = true;
        setBomLines(updated);
      }
    } catch (error) {
      console.error('Error searching products:', error);
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

    setLoading(true);

    try {
      const response = await fetch(`/api/erp/manufacturing/bom/${bom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bomNumber,
          productId: selectedProduct.id,
          version,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          scrapPercentage: parseFloat(scrapPercentage) || 0,
          status,
          notes,
          components: bomLines.map((line) => ({
            componentProductId: line.productId,
            quantity: parseFloat(line.quantity) || 0,
            uom: line.uom,
            scrapPercentage: parseFloat(line.scrapPercentage) || 0,
            componentType: line.componentType,
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'BOM updated successfully!' });
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to update BOM: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error updating BOM:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update BOM. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit BOM</h3>
            <p className="text-sm text-slate-500 mt-1">Update bill of materials</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* BOM Number and Product */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                BOM Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={bomNumber}
                onChange={(e) => setBomNumber(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="BOM-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Product <span className="text-red-500">*</span>
              </label>
              {selectedProduct ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{selectedProduct.name}</div>
                    <div className="text-sm text-slate-600">SKU: {selectedProduct.sku}</div>
                  </div>
                  <span className="text-xs text-blue-600">(Locked)</span>
                </div>
              ) : (
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50"
                  value="No product selected"
                  disabled
                />
              )}
            </div>
          </div>

          {/* Version, Dates, Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Effective From</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Effective To</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Scrap % and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Scrap %</label>
              <input
                type="number"
                step="0.01"
                value={scrapPercentage}
                onChange={(e) => setScrapPercentage(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          {/* BOM Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-slate-700">
                Components <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addBOMLine}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
              >
                <Plus size={16} /> Add Component
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {bomLines.map((line, index) => (
                <div key={index} className="flex gap-2 items-start p-2 bg-slate-50 rounded-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={line.searchTerm || line.productName || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const updated = [...bomLines];
                        updated[index].searchTerm = value;
                        setBomLines(updated);
                        searchComponentProducts(index, value);
                      }}
                      onFocus={() => {
                        if (line.searchTerm && line.searchTerm.length >= 2) {
                          const updated = [...bomLines];
                          updated[index].showSuggestions = true;
                          setBomLines(updated);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          const updated = [...bomLines];
                          updated[index].showSuggestions = false;
                          setBomLines(updated);
                        }, 200);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Search component product..."
                      autoComplete="off"
                    />
                    {line.productId && (
                      <div className="text-xs text-slate-500 mt-1">{line.productSku}</div>
                    )}
                    {line.showSuggestions && products.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {products.map((product) => (
                          <div
                            key={product.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectComponentProduct(index, product);
                            }}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                          >
                            <div className="font-medium text-sm text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-600">SKU: {product.sku}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateBOMLine(index, 'quantity', e.target.value)}
                    className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                    placeholder="Qty"
                  />
                  <select
                    value={line.componentType}
                    onChange={(e) => updateBOMLine(index, 'componentType', e.target.value)}
                    className="w-32 px-2 py-1 border border-slate-200 rounded text-sm"
                  >
                    <option value="raw_material">Raw Material</option>
                    <option value="semi_finished">Semi-Finished</option>
                    <option value="consumable">Consumable</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeBOMLine(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {bomLines.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No components added. Click "Add Component" to start.
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProduct || bomLines.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update BOM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
