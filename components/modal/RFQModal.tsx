'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface RFQItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  targetPrice?: number;
  specifications?: string;
}

interface RFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiPrefix?: string;
}

export default function RFQModal({ isOpen, onClose, onSuccess, apiPrefix = '/api/erp/purchasing' }: RFQModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [supplierPage, setSupplierPage] = useState(1);
  const suppliersPerPage = 5;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [rfqNumber, setRfqNumber] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RFQItem[]>([]);

  // Temporary item being added
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempTargetPrice, setTempTargetPrice] = useState('');
  const [tempSpecs, setTempSpecs] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateRFQNumber();
      fetchSuppliers();
      setIssueDate(new Date().toISOString().split('T')[0]);
      setSupplierPage(1);
    }
  }, [isOpen]);

  // Debounced product search
  useEffect(() => {
    if (tempProduct) return;

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
  }, [searchTerm, tempProduct]);

  const fetchSuppliers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/suppliers`, {
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

  const searchProducts = async (query: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${apiPrefix}/products?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Map cost_price to costPrice
        const mappedProducts = (data.products || []).map((p: any) => ({
          ...p,
          costPrice: p.cost_price || p.costPrice,
        }));
        setProducts(mappedProducts);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRFQNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setRfqNumber(`RFQ-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handleProductSelect = (product: Product) => {
    setTempProduct(product);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
  };

  const handleSupplierToggle = (supplierId: string) => {
    if (selectedSuppliers.includes(supplierId)) {
      setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplierId));
    } else {
      setSelectedSuppliers([...selectedSuppliers, supplierId]);
    }
  };

  const handleAddItem = () => {
    if (!tempProduct || !tempQuantity) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select product and quantity' });
      return;
    }

    const newItem: RFQItem = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      sku: tempProduct.sku,
      quantity: parseFloat(tempQuantity),
      targetPrice: tempTargetPrice ? parseFloat(tempTargetPrice) : undefined,
      specifications: tempSpecs,
    };

    setItems([...items, newItem]);
    setTempProduct(null);
    setTempQuantity('');
    setTempTargetPrice('');
    setTempSpecs('');
    setSearchTerm('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSuppliers.length === 0) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select at least one supplier' });
      return;
    }

    if (items.length === 0) {
      showAlert({ type: 'error', title: 'Error', message: 'Please add at least one item' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiPrefix}/rfqs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rfqNumber,
          supplierIds: selectedSuppliers,
          issueDate,
          responseDeadline,
          deliveryDate,
          notes,
          items,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'RFQ created successfully!' });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to create RFQ: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error creating RFQ:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create RFQ. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRfqNumber('');
    setSelectedSuppliers([]);
    setIssueDate('');
    setResponseDeadline('');
    setDeliveryDate('');
    setNotes('');
    setItems([]);
    setTempProduct(null);
    setTempQuantity('');
    setTempSpecs('');
    setSearchTerm('');
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
  <div className="bg-white rounded-xl max-w-5xl w-full mx-auto shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Create Request for Quotation</h3>
        <p className="text-sm text-slate-500 mt-1">Send RFQ to multiple suppliers</p>
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

    {/* Form - Scrollable Area */}
    <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* RFQ Number with Generate Button */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            RFQ Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={rfqNumber}
              onChange={(e) => setRfqNumber(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="RFQ-2024-001"
            />
            <button
              type="button"
              onClick={generateRFQNumber}
              disabled={generating}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
              Generate
            </button>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Issue Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Response Deadline <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Expected Delivery
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Supplier Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Select Suppliers <span className="text-red-500">*</span> ({selectedSuppliers.length} selected)
          </label>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 max-h-64 overflow-y-auto space-y-2">
              {suppliers
                .slice((supplierPage - 1) * suppliersPerPage, supplierPage * suppliersPerPage)
                .map((supplier) => (
                  <label key={supplier.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(supplier.id)}
                      onChange={() => handleSupplierToggle(supplier.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-900">{supplier.name}</div>
                      <div className="text-xs text-slate-600">{supplier.code}</div>
                    </div>
                  </label>
                ))}
            </div>
            {suppliers.length > suppliersPerPage && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSupplierPage(Math.max(1, supplierPage - 1))}
                  disabled={supplierPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {supplierPage} of {Math.ceil(suppliers.length / suppliersPerPage)}
                </span>
                <button
                  type="button"
                  onClick={() => setSupplierPage(Math.min(Math.ceil(suppliers.length / suppliersPerPage), supplierPage + 1))}
                  disabled={supplierPage >= Math.ceil(suppliers.length / suppliersPerPage)}
                  className="px-3 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add Items Section */}
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 space-y-4">
          <h4 className="font-semibold text-slate-900">Add Items</h4>
          
          {/* Product Search */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Product
            </label>
            
            {tempProduct ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{tempProduct.name}</div>
                  <div className="text-sm text-slate-600">SKU: {tempProduct.sku}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTempProduct(null)}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded"
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
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Search products..."
                />
                
                {loading && (
                  <div className="absolute right-3 top-11 text-slate-400">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-blue-500"></div>
                  </div>
                )}

                {showSuggestions && products.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900 text-sm">{product.name}</div>
                        <div className="text-xs text-slate-600">SKU: {product.sku}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quantity, Target Price and Specifications */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0.01"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Target Price (₹)
              </label>
              <input
                type="number"
                value={tempTargetPrice}
                onChange={(e) => setTempTargetPrice(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Specifications
              </label>
              <input
                type="text"
                value={tempSpecs}
                onChange={(e) => setTempSpecs(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Quality requirements..."
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Target Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Specifications</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-slate-900">{item.productName}</div>
                      <div className="text-xs text-slate-600">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm">{item.targetPrice ? `₹${item.targetPrice.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.specifications || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
            placeholder="Additional requirements, terms, or instructions..."
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
            disabled={submitting || items.length === 0 || selectedSuppliers.length === 0}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create RFQ'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
  );
}
