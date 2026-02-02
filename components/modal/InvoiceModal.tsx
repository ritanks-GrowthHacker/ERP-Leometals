'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

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

interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editInvoice?: any;
}

export default function InvoiceModal({ isOpen, onClose, onSuccess, editInvoice }: InvoiceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Temporary item being added
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnitPrice, setTempUnitPrice] = useState('');
  const [tempTaxRate, setTempTaxRate] = useState('18');

  useEffect(() => {
    if (isOpen) {
      if (editInvoice) {
        // Pre-fill form for edit mode
        setIsEditMode(true);
        setInvoiceNumber(editInvoice.invoiceNumber || '');
        setCustomerId(editInvoice.customer?.id || editInvoice.customerId || '');
        setInvoiceDate(editInvoice.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setDueDate(editInvoice.dueDate?.split('T')[0] || '');
        setPaymentTerms(editInvoice.paymentTerms ? `net${editInvoice.paymentTerms}` : 'net30');
        setStatus(editInvoice.status || 'draft');
        setNotes(editInvoice.notes || '');
        
        // Convert line items to InvoiceItem format
        if (editInvoice.lines && editInvoice.lines.length > 0) {
          const convertedItems = editInvoice.lines.map((line: any) => ({
            productId: line.productId,
            productName: line.product?.name || line.description,
            sku: line.product?.sku || '',
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.unitPrice),
            taxRate: parseFloat(line.taxRate || 0),
            total: parseFloat(line.quantity) * parseFloat(line.unitPrice) * (1 + parseFloat(line.taxRate || 0) / 100)
          }));
          setItems(convertedItems);
        }
      } else {
        // Create mode - generate new invoice number
        setIsEditMode(false);
        generateInvoiceNumber();
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        setDueDate(dueDate.toISOString().split('T')[0]);
      }
      fetchCustomers();
    }
  }, [isOpen, editInvoice]);

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

  const generateInvoiceNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setInvoiceNumber(`INV-${timestamp}-${random}`);
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
      alert('Please select product, quantity, and unit price');
      return;
    }

    const quantity = parseFloat(tempQuantity);
    const unitPrice = parseFloat(tempUnitPrice);
    const taxRate = parseFloat(tempTaxRate) / 100;
    const subtotal = quantity * unitPrice;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    const newItem: InvoiceItem = {
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
      alert('Please select a customer');
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      alert('No authentication token found');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/sales/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceNumber,
          customerId,
          invoiceDate,
          dueDate,
          paymentTerms,
          status,
          notes,
          items,
        }),
      });

      if (response.ok) {
        alert('Invoice created successfully!');
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to create invoice: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setCustomerId('');
    setInvoiceDate('');
    setDueDate('');
    setPaymentTerms('net30');
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
  className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  onClick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div className="bg-white rounded-xl max-w-5xl w-full mx-auto shadow-2xl max-h-[92vh] flex flex-col">
    {/* Header */}
    <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
      <div>
        <h3 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Invoice' : 'Create Invoice'}</h3>
        <p className="text-sm text-slate-500 mt-1">{isEditMode ? 'Update invoice details' : 'Generate customer invoice'}</p>
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

    {/* Scrollable Form Content */}
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Invoice Number with Generate Button */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Invoice Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="INV-2024-001"
            />
            <button
              type="button"
              onClick={generateInvoiceNumber}
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
              Invoice Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Payment Terms and Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="immediate">Immediate</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="net45">Net 45</option>
              <option value="net60">Net 60</option>
            </select>
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
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
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
            placeholder="Payment instructions, terms and conditions, etc..."
          />
        </div>
      </div>
    </div>

    {/* Fixed Footer Buttons */}
    <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </div>
  </div>
</div>
  );
}
