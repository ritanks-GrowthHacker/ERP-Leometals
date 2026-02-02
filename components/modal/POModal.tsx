'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
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

interface POModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiPrefix?: string;
  userRole?: string;
  userWarehouseId?: string;
  mode?: 'create' | 'edit';
  orderId?: string;
}

export default function POModal({ isOpen, onClose, onSuccess, apiPrefix = '/api/erp/purchasing', userRole, userWarehouseId, mode = 'create', orderId }: POModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [poNumber, setPoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);

  // Temporary item being added
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnitPrice, setTempUnitPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && orderId) {
        loadPOData(orderId);
      } else {
        generatePONumber();
      }
      fetchSuppliers();
      fetchWarehouses();
      if (mode === 'create') {
        setOrderDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [isOpen, mode, orderId]);

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
        // Don't auto-open dropdown - only show when user clicks input
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
        // Auto-select warehouse for warehouse manager
        if (userWarehouseId && data.warehouses?.length > 0) {
          setWarehouseId(userWarehouseId);
          fetchLocations(userWarehouseId);
        }
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

    // Build query params with warehouse, location, and supplier filters
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
        // Map cost_price to costPrice
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

  const generatePONumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setPoNumber(`PO-${timestamp}-${random}`);
    setGenerating(false);
  };

  const loadPOData = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${apiPrefix}/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const po = data.order;
        
        // Populate form fields with proper fallbacks
        setPoNumber(po.poNumber || po.po_number || '');
        setSupplierId(po.supplierId || po.supplier_id || po.supplier?.id || '');
        setWarehouseId(po.warehouseId || po.warehouse_id || po.warehouse?.id || '');
        setLocationId(po.locationId || po.location_id || '');
        
        // Format dates properly
        const poDate = po.poDate || po.po_date || po.orderDate || po.order_date;
        if (poDate) {
          const formattedDate = new Date(poDate).toISOString().split('T')[0];
          setOrderDate(formattedDate);
        }
        
        const expectedDate = po.expectedDeliveryDate || po.expected_delivery_date || po.expectedDelivery;
        if (expectedDate) {
          const formattedExpected = new Date(expectedDate).toISOString().split('T')[0];
          setExpectedDelivery(formattedExpected);
        }
        
        setPaymentTerms(po.paymentTerms || po.payment_terms || 'net30');
        setNotes(po.notes || '');

        // Load locations for selected warehouse
        const whId = po.warehouseId || po.warehouse_id || po.warehouse?.id;
        if (whId) {
          await fetchLocations(whId);
        }

        // Populate items with proper field mapping
        const poItems = (po.lines || []).map((line: any) => {
          const product = line.product || {};
          const qty = parseFloat(line.quantity || line.quantityOrdered || line.quantity_ordered || 0);
          const price = parseFloat(line.unitPrice || line.unit_price || 0);
          const calculatedTotal = qty * price;
          
          return {
            productId: line.productId || line.product_id || product.id || '',
            productName: line.productName || line.product_name || product.name || line.description || 'Unknown Product',
            sku: line.sku || product.sku || line.product_sku || '',
            quantity: qty,
            unitPrice: price,
            total: calculatedTotal,
            gstRate: parseFloat(line.gstRate || line.gst_rate || line.taxRate || line.tax_rate || 18),
          };
        });
        setItems(poItems);
      } else {
        showAlert({ type: 'error', message: 'Failed to load PO data' });
      }
    } catch (error) {
      console.error('Error loading PO:', error);
      showAlert({ type: 'error', message: 'Error loading PO data' });
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

    // Check if product already exists in items
    const existingItemIndex = items.findIndex(item => item.productId === tempProduct.id);
    
    if (existingItemIndex !== -1) {
      // Product exists, increment quantity
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
      // New product, add to items
      const newItem: POItem = {
        productId: tempProduct.id,
        productName: tempProduct.name,
        sku: tempProduct.sku,
        quantity: parseFloat(tempQuantity),
        unitPrice: parseFloat(tempUnitPrice),
        total: parseFloat(tempQuantity) * parseFloat(tempUnitPrice),
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
      const url = mode === 'edit' && orderId 
        ? `${apiPrefix}/purchase-orders/${orderId}` 
        : `${apiPrefix}/purchase-orders`;
      
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
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
        const successMessage = mode === 'edit' ? 'Purchase Order updated successfully' : 'Purchase Order created successfully';
        showAlert({ type: 'success', title: 'Success!', message: successMessage });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        const errorMessage = mode === 'edit' ? 'Failed to update PO' : 'Failed to create PO';
        showAlert({ type: 'error', title: errorMessage, message: error.error || 'Unknown error' });
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} PO:`, error);
      const errorMessage = mode === 'edit' ? 'Failed to update PO' : 'Failed to create PO';
      showAlert({ type: 'error', title: 'Error', message: `${errorMessage}. Please try again.` });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPoNumber('');
    setSupplierId('');
    setWarehouseId('');
    setOrderDate('');
    setExpectedDelivery('');
    setPaymentTerms('net30');
    setNotes('');
    setItems([]);
    setTempProduct(null);
    setTempQuantity('');
    setTempUnitPrice('');
    setSearchTerm('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
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
      <div className="bg-white rounded-lg max-w-5xl w-full mx-auto shadow-2xl ">
        {/* Header */}
        <div className="px-6 rounded-lg py-4 flex items-center justify-between border border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{mode === 'edit' ? 'Edit Purchase Order' : 'Create Purchase Order'}</h3>
            <p className="text-sm text-slate-500 mt-1 italic">Order products from suppliers</p>
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
          {/* PO Number with Generate Button */}
          <div className='max-h-[80vh] overflow-y-auto p-4'>
             <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
              PO Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="PO-2024-001"
              />
              <button
                type="button"
                onClick={generatePONumber}
                disabled={generating}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                Generate
              </button>
            </div>
          </div>

          {/* Supplier and Dates */}
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
                disabled={userRole === 'warehouse_manager'}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-600"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>

            {warehouseId && locations.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Delivery Location <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select Location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                Order Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

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
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                {tempProduct?.costPrice && (
                  <p className="text-xs text-slate-500 mt-1">Auto-populated</p>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add Item
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
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right text-lg">₹{totalAmount.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Additional notes or special instructions..."
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
              {submitting ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Update Purchase Order' : 'Create Purchase Order')}
            </button>
          </div>
          </div>
         
        </form>
      </div>
    </div>
  );
}
