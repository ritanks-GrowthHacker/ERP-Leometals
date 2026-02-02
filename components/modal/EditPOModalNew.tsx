'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Trash2 } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice?: number;
  gstRate?: number;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface POItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  gstRate?: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  locationId?: string;
  expectedDeliveryDate?: string;
  notes?: string;
}

interface EditPOModalProps {
  isOpen: boolean;
  order: PurchaseOrder;
  onClose: () => void;
  onSuccess: () => void;
  apiPrefix?: string;
}

export default function EditPOModalNew({ isOpen, order, onClose, onSuccess, apiPrefix = '/api/erp/purchasing' }: EditPOModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);

  // Temporary item being added
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnitPrice, setTempUnitPrice] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      fetchSuppliers();
      fetchWarehouses();
      loadOrderData();
    }
  }, [isOpen, order]);

  // Auto-populate unit price when product is selected
  useEffect(() => {
    if (tempProduct && tempProduct.costPrice) {
      setTempUnitPrice(tempProduct.costPrice.toString());
    }
  }, [tempProduct]);

  // Debounced product search
  useEffect(() => {
    if (tempProduct) return;

    // If warehouse, location, and supplier are selected, fetch all products from that location
    if (warehouseId && locationId && supplierId && searchTerm.length === 0) {
      fetchAllProductsForLocation();
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
  }, [searchTerm, tempProduct, warehouseId, locationId, supplierId]);

  const loadOrderData = async () => {
    setSupplierId(order.supplierId);
    setWarehouseId(order.warehouseId);
    setLocationId(order.locationId || '');
    setExpectedDelivery(order.expectedDeliveryDate || '');
    setNotes(order.notes || '');

    // Fetch existing PO lines
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const loadedItems = (data.purchaseOrder.lines || []).map((line: any) => ({
          productId: line.product?.id || line.productId,
          productName: line.product?.name || line.productName,
          sku: line.product?.sku || line.sku,
          quantity: parseFloat(line.quantityOrdered || line.quantity || 0),
          unitPrice: parseFloat(line.unitPrice || 0),
          total: parseFloat(line.quantityOrdered || line.quantity || 0) * parseFloat(line.unitPrice || 0),
          gstRate: line.gstRate || line.taxRate || 18,
        }));
        setItems(loadedItems);

        // Fetch locations if warehouse is set
        if (order.warehouseId) {
          fetchLocations(order.warehouseId);
        }
      }
    } catch (error) {
      console.error('Error loading order:', error);
    }
  };

  const fetchAllProductsForLocation = async () => {
    const token = getAuthToken();
    if (!token || !warehouseId || !locationId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        warehouseId,
        locationId,
        limit: '100'
      });

      if (supplierId) {
        params.append('supplierId', supplierId);
      }

      const res = await fetch(`${apiPrefix}/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const mappedProducts = (data.products || []).map((p: any) => ({
          ...p,
          costPrice: p.cost_price || p.costPrice,
          gstRate: p.gst_rate || p.default_gst_rate || 18,
        }));
        setProducts(mappedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/warehouses`, {
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

  const fetchLocations = async (warehouseId: string) => {
    const token = getAuthToken();
    if (!token || !warehouseId) return;

    try {
      const res = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const searchProducts = async (query: string) => {
    const token = getAuthToken();
    if (!token) return;

    const params = new URLSearchParams({
      search: query,
      limit: '10'
    });

    if (warehouseId) {
      params.append('warehouseId', warehouseId);
    }

    if (locationId) {
      params.append('locationId', locationId);
    }

    if (supplierId) {
      params.append('supplierId', supplierId);
    }

    try {
      setLoading(true);
      const res = await fetch(`${apiPrefix}/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const mappedProducts = (data.products || []).map((p: any) => ({
          ...p,
          costPrice: p.cost_price || p.costPrice,
          gstRate: p.gst_rate || p.default_gst_rate || 18,
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

  const handleProductSelect = (product: Product) => {
    setTempProduct(product);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
  };

  const handleAddItem = () => {
    if (!tempProduct || !tempQuantity || !tempUnitPrice) {
      showAlert({ type: 'warning', message: 'Please select product, quantity, and unit price' });
      return;
    }

    const existingItemIndex = items.findIndex(item => item.productId === tempProduct.id);
    
    if (existingItemIndex !== -1) {
      const updatedItems = [...items];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + parseFloat(tempQuantity);
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        total: newQuantity * existingItem.unitPrice,
      };
      setItems(updatedItems);
      showAlert({ type: 'success', message: `Updated quantity for ${tempProduct.name}` });
    } else {
      const newItem: POItem = {
        productId: tempProduct.id,
        productName: tempProduct.name,
        sku: tempProduct.sku,
        quantity: parseFloat(tempQuantity),
        unitPrice: parseFloat(tempUnitPrice),
        total: parseFloat(tempQuantity) * parseFloat(tempUnitPrice),
        gstRate: tempProduct.gstRate || 18,
      };
      setItems([...items, newItem]);
    }

    setTempProduct(null);
    setTempQuantity('');
    setTempUnitPrice('');
    setSearchTerm('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierId) {
      showAlert({ type: 'error', message: 'Please select a supplier' });
      return;
    }

    if (!warehouseId) {
      showAlert({ type: 'error', message: 'Please select a warehouse' });
      return;
    }

    if (items.length === 0) {
      showAlert({ type: 'error', message: 'Please add at least one item' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiPrefix}/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId,
          warehouseId,
          locationId: locationId || null,
          expectedDeliveryDate: expectedDelivery || null,
          notes,
          lines: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate || 18,
            taxRate: item.gstRate || 18,
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success!', message: 'Purchase Order updated successfully' });
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Failed to update PO', message: error.error || 'Unknown error' });
      }
    } catch (error) {
      console.error('Failed to update PO:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update purchase order' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setItems([]);
      setTempProduct(null);
      setSearchTerm('');
      setTempQuantity('');
      setTempUnitPrice('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-lg max-w-5xl w-full mx-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 rounded-lg py-4 flex items-center justify-between border border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit Purchase Order</h3>
            <p className="text-sm text-slate-500 mt-1 italic">PO #{order.poNumber}</p>
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
        <form onSubmit={handleSubmit} className="p-1 space-y-6">
          <div className='max-h-[80vh] overflow-y-auto p-4'>
            {/* Supplier and Warehouse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    setLocationId('');
                    if (e.target.value) {
                      fetchLocations(e.target.value);
                    } else {
                      setLocations([]);
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location */}
            {warehouseId && locations.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Location
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Location (Optional)</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Expected Delivery & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {/* Add Items Section */}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-slate-900 italic">Add Items</h4>
              
              {/* Product Search */}
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
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
                      onFocus={() => {
                        if (products.length > 0) {
                          setShowSuggestions(true);
                        } else if (searchTerm.length >= 2) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setShowSuggestions(false);
                        }, 200);
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Search products..."
                      autoComplete="off"
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
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleProductSelect(product);
                            }}
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

              {/* Quantity and Price */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    value={tempUnitPrice}
                    onChange={(e) => setTempUnitPrice(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">SKU</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.productName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.sku}</td>
                        <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total */}
                <div className="bg-slate-50 px-4 py-3 flex justify-end">
                  <div className="text-right">
                    <div className="text-sm text-slate-600">Total Amount</div>
                    <div className="text-2xl font-bold text-slate-900">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-slate-50 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
