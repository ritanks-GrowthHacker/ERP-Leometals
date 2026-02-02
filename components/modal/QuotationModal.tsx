'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice?: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface QuotationItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuotationModal({ isOpen, onClose, onSuccess }: QuotationModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showAlert } = useAlert();

  // Form fields
  const [quotationNumber, setQuotationNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);

  // Temporary item being added
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnitPrice, setTempUnitPrice] = useState('');
  const [tempTaxRate, setTempTaxRate] = useState('18');

  useEffect(() => {
    if (isOpen) {
      generateQuotationNumber();
      fetchCustomers();
      setQuotationDate(new Date().toISOString().split('T')[0]);
      // Auto-set valid until to 30 days from now
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 30);
      setValidUntil(validDate.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Auto-populate unit price when product is selected
  useEffect(() => {
    if (tempProduct && tempProduct.sellingPrice) {
      setTempUnitPrice(tempProduct.sellingPrice.toString());
    }
  }, [tempProduct]);

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

  const fetchCustomers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/erp/sales/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

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

  const generateQuotationNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setQuotationNumber(`QUO-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handleProductSelect = (product: Product) => {
    setTempProduct(product);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
  };

  const handleAddItem = () => {
    if (!tempProduct || !tempQuantity || !tempUnitPrice) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select product, quantity, and unit price',
      });
      return;
    }

    const quantity = parseFloat(tempQuantity);
    const unitPrice = parseFloat(tempUnitPrice);
    const taxRate = parseFloat(tempTaxRate) / 100;
    const subtotal = quantity * unitPrice;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    const newItem: QuotationItem = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      sku: tempProduct.sku,
      quantity,
      unitPrice,
      taxRate: parseFloat(tempTaxRate),
      total,
    };

    setItems([...items, newItem]);
    setTempProduct(null);
    setTempQuantity('');
    setTempUnitPrice('');
    setTempTaxRate('18');
    setSearchTerm('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select a customer',
      });
      return;
    }

    if (items.length === 0) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please add at least one item',
      });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({
        type: 'error',
        title: 'Authentication Error',
        message: 'No authentication token found',
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/sales/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quotationNumber,
          customerId,
          quotationDate,
          validUntil,
          status,
          notes,
          items,
        }),
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Success',
          message: 'Quotation created successfully!',
        });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Error',
          message: `Failed to create quotation: ${error.error || 'Unknown error'}`,
        });
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to create quotation. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setQuotationNumber('');
    setCustomerId('');
    setQuotationDate('');
    setValidUntil('');
    setStatus('draft');
    setNotes('');
    setItems([]);
    setTempProduct(null);
    setTempQuantity('');
    setTempUnitPrice('');
    setTempTaxRate('18');
    setSearchTerm('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    return sum + itemSubtotal;
  }, 0);

  const totalTax = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemTax = itemSubtotal * (item.taxRate / 100);
    return sum + itemTax;
  }, 0);

  const totalAmount = subtotal + totalTax;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-xl max-w-5xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Create Quotation</h3>
            <p className="text-sm text-slate-500 mt-1">Generate customer quotation</p>
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
          {/* Quotation Number with Generate Button */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Quotation Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="QUO-2024-001"
                readOnly
              />
              <button
                type="button"
                onClick={generateQuotationNumber}
                disabled={generating}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                Generate
              </button>
            </div>
          </div>

          {/* Customer and Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Quotation Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Valid Until <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
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

            {/* Quantity, Price, and Tax */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Quantity
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
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  value={tempUnitPrice}
                  onChange={(e) => setTempUnitPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                {tempProduct?.sellingPrice && (
                  <p className="text-xs text-slate-500 mt-1">Auto-populated</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tax (%)
                </label>
                <input
                  type="number"
                  value={tempTaxRate}
                  onChange={(e) => setTempTaxRate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="18"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Tax%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Total</th>
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
                      <td className="px-4 py-3 text-right text-sm">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm">{item.taxRate}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm">₹{item.total.toFixed(2)}</td>
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
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-2 text-right font-semibold text-sm">Subtotal:</td>
                    <td className="px-4 py-2 text-right text-sm">₹{subtotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-2 text-right font-semibold text-sm">Total Tax:</td>
                    <td className="px-4 py-2 text-right text-sm">₹{totalTax.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={4} className="px-4 py-3 text-right text-base">Grand Total:</td>
                    <td className="px-4 py-3 text-right text-lg text-blue-700">₹{totalAmount.toFixed(2)}</td>
                    <td></td>
                  </tr>
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
              placeholder="Terms and conditions, delivery details, etc..."
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
              disabled={submitting || items.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
