'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, Plus, Trash2, Save } from 'lucide-react';
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

interface QuotationLine {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  description?: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms: number;
  notes: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
  };
  lines: Array<{
    id: string;
    productId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    discount: string;
    product?: {
      name: string;
      sku: string;
    };
  }>;
}

interface EditSalesQuotationModalProps {
  isOpen: boolean;
  quotationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSalesQuotationModal({
  isOpen,
  quotationId,
  onClose,
  onSuccess,
}: EditSalesQuotationModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const { showAlert } = useAlert();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuotationLine[]>([]);

  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnitPrice, setTempUnitPrice] = useState('');
  const [tempTaxRate, setTempTaxRate] = useState('18');
  const [tempDiscount, setTempDiscount] = useState('0');

  useEffect(() => {
    if (isOpen && quotationId) {
      fetchQuotation();
      fetchCustomers();
    }
  }, [isOpen, quotationId]);

  useEffect(() => {
    if (tempProduct && tempProduct.sellingPrice) {
      setTempUnitPrice(tempProduct.sellingPrice.toString());
    }
  }, [tempProduct]);

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

  const fetchQuotation = async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/sales/quotations/${quotationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setQuotation(data);
        setCustomerId(data.customerId);
        setQuotationDate(data.quotationDate);
        setValidUntil(data.validUntil);
        setPaymentTerms(data.paymentTerms.toString());
        setNotes(data.notes || '');
        
        const formattedItems: QuotationLine[] = data.lines.map((line: any) => ({
          id: line.id,
          productId: line.productId,
          productName: line.product?.name || line.description,
          sku: line.product?.sku || '',
          quantity: parseFloat(line.quantity),
          unitPrice: parseFloat(line.unitPrice),
          taxRate: parseFloat(line.taxRate),
          discount: parseFloat(line.discount),
          description: line.description,
        }));
        setItems(formattedItems);
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load quotation',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch('/api/erp/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const searchProducts = async (term: string) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/products/search?q=${encodeURIComponent(term)}`, {
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

  const selectProduct = (product: Product) => {
    setTempProduct(product);
    setSearchTerm(product.name);
    setShowSuggestions(false);
  };

  const addItem = () => {
    if (!tempProduct || !tempQuantity || !tempUnitPrice) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please select a product and enter quantity and price',
      });
      return;
    }

    const newItem: QuotationLine = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      sku: tempProduct.sku,
      quantity: parseFloat(tempQuantity),
      unitPrice: parseFloat(tempUnitPrice),
      taxRate: parseFloat(tempTaxRate),
      discount: parseFloat(tempDiscount),
    };

    setItems([...items, newItem]);
    resetItemForm();
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const resetItemForm = () => {
    setTempProduct(null);
    setSearchTerm('');
    setTempQuantity('');
    setTempUnitPrice('');
    setTempTaxRate('18');
    setTempDiscount('0');
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach((item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const discount = lineSubtotal * (item.discount / 100);
      const afterDiscount = lineSubtotal - discount;
      subtotal += afterDiscount;
      taxAmount += afterDiscount * (item.taxRate / 100);
    });

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  };

  const handleSubmit = async () => {
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

    if (!quotationDate || !validUntil) {
      showAlert({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please fill in all required dates',
      });
      return;
    }

    setSubmitting(true);
    const token = getAuthToken();

    try {
      const response = await fetch(`/api/erp/sales/quotations/${quotationId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          quotationDate,
          validUntil,
          paymentTerms: parseInt(paymentTerms),
          notes,
          items: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discount: item.discount,
          })),
        }),
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Success',
          message: 'Quotation updated successfully!',
        });
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        showAlert({
          type: 'error',
          title: 'Error',
          message: data.error || 'Failed to update quotation',
        });
      }
    } catch (error) {
      console.error('Error updating quotation:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to update quotation',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Save className="w-6 h-6" />
            Edit Quotation {quotation?.quotationNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 rounded-lg p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={quotation?.status !== 'draft'}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quotation Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valid Until <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Additional notes or terms..."
                />
              </div>

              {/* Add Item Section */}
              {quotation?.status === 'draft' && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Add Item</h3>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2 relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setTempProduct(null);
                        }}
                        placeholder="Search products..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {showSuggestions && products.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {products.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => selectProduct(product)}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(e.target.value)}
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={tempUnitPrice}
                      onChange={(e) => setTempUnitPrice(e.target.value)}
                      placeholder="Price"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={tempTaxRate}
                      onChange={(e) => setTempTaxRate(e.target.value)}
                      placeholder="Tax %"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={addItem}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">Items ({items.length})</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Qty</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Price</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tax %</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Discount %</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                        {quotation?.status === 'draft' && (
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={quotation?.status === 'draft' ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                            No items added yet
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => {
                          const lineSubtotal = item.quantity * item.unitPrice;
                          const discount = lineSubtotal * (item.discount / 100);
                          const afterDiscount = lineSubtotal - discount;
                          const tax = afterDiscount * (item.taxRate / 100);
                          const lineTotal = afterDiscount + tax;

                          return (
                            <tr key={index}>
                              <td className="px-6 py-4 text-sm">
                                <div className="font-medium text-gray-900">{item.productName}</div>
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{item.quantity}</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">₹{item.unitPrice.toFixed(2)}</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{item.taxRate}%</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{item.discount}%</td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                              {quotation?.status === 'draft' && (
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => removeItem(index)}
                                    className="text-red-600 hover:text-red-800 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex justify-end">
                  <div className="w-80 space-y-3">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Tax Amount:</span>
                      <span className="font-semibold">₹{totals.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-bold text-gray-900">
                      <span>Total Amount:</span>
                      <span className="text-green-600">₹{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Update Quotation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
