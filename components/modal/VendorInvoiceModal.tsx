'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, X, Plus, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  total: number;
}

interface VendorInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VendorInvoiceModal({ isOpen, onClose, onSuccess }: VendorInvoiceModalProps) {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('1');
  const [tempUnitPrice, setTempUnitPrice] = useState('');
  const [tempTaxRate, setTempTaxRate] = useState('18');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      generateInvoiceNumber();
      fetchSuppliers();
      resetForm();
      // Auto-set due date to 30 days from invoice date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      setFormData(prev => ({ ...prev, dueDate: dueDate.toISOString().split('T')[0] }));
    }
  }, [isOpen]);

  useEffect(() => {
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
  }, [searchTerm]);

  // Auto-populate unit price when product is selected
  useEffect(() => {
    if (tempProduct?.costPrice) {
      setTempUnitPrice(tempProduct.costPrice);
    }
  }, [tempProduct]);

  const generateInvoiceNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setInvoiceNumber(`VINV-${timestamp}-${random}`);
    setGenerating(false);
  };

  const searchProducts = async (term: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/products?search=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const fetchSuppliers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setTempProduct(product);
    setSearchTerm(product.name);
    setShowSuggestions(false);
  };

  const handleAddItem = () => {
    if (!tempProduct || !tempQuantity || !tempUnitPrice) {
      alert('Please select a product and enter quantity and unit price');
      return;
    }

    const quantity = parseFloat(tempQuantity);
    const unitPrice = parseFloat(tempUnitPrice);
    const taxRate = parseFloat(tempTaxRate);
    const subtotal = quantity * unitPrice;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const newItem: InvoiceItem = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      quantity: tempQuantity,
      unitPrice: tempUnitPrice,
      taxRate: tempTaxRate,
      total,
    };

    setItems([...items, newItem]);
    setTempProduct(null);
    setSearchTerm('');
    setTempQuantity('1');
    setTempUnitPrice('');
    setTempTaxRate('18');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      return sum + (qty * price);
    }, 0);

    const totalTax = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const tax = parseFloat(item.taxRate);
      return sum + ((qty * price) * (tax / 100));
    }, 0);

    return { subtotal, totalTax, grandTotal: subtotal + totalTax };
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      notes: '',
    });
    setItems([]);
    setTempProduct(null);
    setSearchTerm('');
    setTempQuantity('1');
    setTempUnitPrice('');
    setTempTaxRate('18');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      alert('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSubmitting(true);
    const token = getAuthToken();

    try {
      const response = await fetch('/api/erp/purchasing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceNumber,
          ...formData,
          items: items.map(item => ({
            productId: item.productId,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            taxRate: parseFloat(item.taxRate),
          })),
        }),
      });

      if (response.ok) {
        alert('Vendor invoice created successfully!');
        resetForm();
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to create vendor invoice'}`);
      }
    } catch (error) {
      console.error('Error creating vendor invoice:', error);
      alert('Failed to create vendor invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-50/50 backdrop-blur-sm px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Record Vendor Invoice</h2>
            <p className="text-sm text-slate-500 mt-0.5">Create invoice from supplier</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Invoice Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Invoice Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={invoiceNumber}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
              />
              <button
                type="button"
                onClick={generateInvoiceNumber}
                disabled={generating}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                Generate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 bg-blue-50"
              />
              <p className="text-xs text-slate-500 mt-1">Auto-set to 30 days from invoice date</p>
            </div>
          </div>

          {/* Add Items Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Items</h3>
            
            <div className="grid grid-cols-12 gap-3 mb-4">
              {/* Product Search */}
              <div className="col-span-4 relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">Product</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => products.length > 0 && setShowSuggestions(true)}
                  placeholder="Search products..."
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
                />
                {showSuggestions && products.length > 0 && !tempProduct && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-500">SKU: {product.sku}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempQuantity}
                  onChange={(e) => setTempQuantity(e.target.value)}
                  min="0.01"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              {/* Unit Price - Auto-populated */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempUnitPrice}
                  onChange={(e) => setTempUnitPrice(e.target.value)}
                  min="0"
                  disabled={submitting}
                  placeholder="Auto-populated"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 bg-blue-50"
                />
              </div>

              {/* Tax Rate */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempTaxRate}
                  onChange={(e) => setTempTaxRate(e.target.value)}
                  min="0"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              {/* Add Button */}
              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={submitting || !tempProduct}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Product</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Qty</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Unit Price</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Tax %</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Total</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{item.productName}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">₹{parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{item.taxRate}%</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">Subtotal:</span>
                    <span className="font-medium text-slate-900">₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">Total Tax:</span>
                    <span className="font-medium text-slate-900">₹{totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg border-t border-blue-300 pt-2">
                    <span className="font-semibold text-slate-900">Grand Total:</span>
                    <span className="font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting}
              rows={3}
              placeholder="Add any notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? 'Creating...' : 'Create Vendor Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
