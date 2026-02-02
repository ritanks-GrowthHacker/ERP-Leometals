'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity?: number;
  availableQuantity?: number;
  warehouseStock?: {
    warehouseId: string;
    warehouseName: string;
    quantityOnHand: number;
    locations?: {
      id: string;
      name: string;
      code: string;
    }[];
  }[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiPrefix?: string;
}

export default function AdjustmentModal({ isOpen, onClose, onSuccess, apiPrefix = '/api/erp/inventory' }: AdjustmentModalProps) {
  const { showAlert } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [referenceNumber, setReferenceNumber] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [systemQuantity, setSystemQuantity] = useState('0');
  const [actualQuantity, setActualQuantity] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('cycle_count');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateReferenceNumber();
      fetchWarehouses();
    }
  }, [isOpen]);

  // Debounced product search
  useEffect(() => {
    // Don't search if a product is already selected
    if (selectedProduct) {
      setShowSuggestions(false);
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
  }, [searchTerm, selectedProduct]);

  // Fetch locations when warehouse is selected
  useEffect(() => {
    if (selectedProduct && warehouseId) {
      // Fetch locations where this product is available
      fetchLocationsForProduct(selectedProduct.id, warehouseId);
    }
  }, [warehouseId]);

  // Fetch quantity when location is selected
  useEffect(() => {
    if (selectedProduct && warehouseId && locationId) {
      fetchSystemQuantity(selectedProduct.id, warehouseId, locationId);
    }
  }, [locationId]);

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/warehouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Handle both admin (warehouses array) and warehouse manager (single warehouse + locations)
        if (data.warehouse) {
          // Warehouse manager response
          setWarehouses([data.warehouse]);
          setWarehouseId(data.warehouse.id); // Auto-select for warehouse manager
          // Initially set all locations, will filter when product selected
          setLocations(data.locations || []);
        } else {
          // Admin response
          setWarehouses(data.warehouses || []);
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  // Fetch warehouses where product exists
  const fetchProductWarehouses = async (productId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/stock-levels?productId=${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Extract unique warehouses where this product exists
        const warehousesMap = new Map();
        data.stockLevels.forEach((sl: any) => {
          const whId = sl.warehouse_id || sl.warehouseId;
          const whName = sl.warehouse_name || sl.warehouseName;
          if (whId && !warehousesMap.has(whId)) {
            warehousesMap.set(whId, {
              id: whId,
              name: whName,
            });
          }
        });
        
        const productWarehouses = Array.from(warehousesMap.values());
        
        // Update the warehouses dropdown to only show warehouses with this product
        setWarehouses(productWarehouses);
        
        // If only one warehouse, auto-select it
        if (productWarehouses.length === 1) {
          setWarehouseId(productWarehouses[0].id);
          // This will trigger the useEffect to fetch locations
          await fetchLocationsForProduct(productId, productWarehouses[0].id);
        } else if (productWarehouses.length > 1) {
          // If user already selected a warehouse, keep it if product exists there
          if (warehouseId && productWarehouses.find(w => w.id === warehouseId)) {
            // Keep current selection and fetch locations
            await fetchLocationsForProduct(productId, warehouseId);
          } else {
            // Clear selection
            setWarehouseId('');
            setLocationId('');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching product warehouses:', error);
    }
  };

  // Fetch locations filtered by product availability
  const fetchLocationsForProduct = async (productId: string, warehouseId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const params = new URLSearchParams({
        productId: productId,
        warehouseId: warehouseId,
      });
      const res = await fetch(`${apiPrefix}/stock-levels?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Extract unique locations where this product exists
        const locationsMap = new Map();
        data.stockLevels.forEach((sl: any) => {
          const locId = sl.location_id || sl.locationId;
          if (locId && !locationsMap.has(locId)) {
            locationsMap.set(locId, {
              id: locId,
              name: sl.location_name || sl.locationName,
              code: sl.location_code || sl.locationCode,
            });
          }
        });
        
        const productLocations = Array.from(locationsMap.values());
        setLocations(productLocations);
        
        // If only one location, auto-select it
        if (productLocations.length === 1) {
          setLocationId(productLocations[0].id);
          // This will trigger the useEffect to fetch quantity
        }
      }
    } catch (error) {
      console.error('Error fetching locations for product:', error);
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
        // Map snake_case to camelCase
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

  const fetchSystemQuantity = async (productId: string, warehouseId: string, locationId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const params = new URLSearchParams({
        productId: productId,
        warehouseId: warehouseId,
        locationId: locationId,
      });
      const res = await fetch(`${apiPrefix}/stock-levels?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Stock level data:', data);
        const stockLevel = data.stockLevels?.[0];
        // Use quantity_on_hand as system quantity (available quantity)
        const qty = stockLevel?.quantity_on_hand || stockLevel?.quantityOnHand || '0';
        console.log('Setting system quantity to:', qty);
        setSystemQuantity(String(qty));
      } else {
        console.error('Failed to fetch stock level:', res.status, res.statusText);
        setSystemQuantity('0');
      }
    } catch (error) {
      console.error('Error fetching system quantity:', error);
      setSystemQuantity('0');
    }
  };

  const generateReferenceNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setReferenceNumber(`ADJ-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.name} (${product.sku})`);
    setShowSuggestions(false);
    setProducts([]);
    
    console.log('Selected product:', product);
    console.log('Warehouse stock:', product.warehouseStock);
    
    // Use warehouse stock data directly from the product object
    if (product.warehouseStock && product.warehouseStock.length > 0) {
      const firstWarehouse = product.warehouseStock[0];
      console.log('First warehouse:', firstWarehouse);
      console.log('Quantity on hand:', firstWarehouse.quantityOnHand);
      
      // Build warehouse options
      const warehouseOptions = product.warehouseStock.map(wh => ({
        id: wh.warehouseId,
        name: wh.warehouseName,
        code: wh.warehouseName
      }));
      setWarehouses(warehouseOptions);
      
      // Auto-select first warehouse
      setWarehouseId(firstWarehouse.warehouseId);
      
      // Auto-select first location if available
      if (firstWarehouse.locations && firstWarehouse.locations.length > 0) {
        const firstLocation = firstWarehouse.locations[0];
        
        // Build location options
        const locationOptions = firstWarehouse.locations.map(loc => ({
          ...loc,
          displayName: `${firstWarehouse.warehouseName} - ${loc.name}`
        }));
        setLocations(locationOptions);
        
        // Auto-select first location
        setLocationId(firstLocation.id);
        
        // Set system quantity from the warehouse quantity
        const qty = firstWarehouse.quantityOnHand.toString();
        console.log('Setting system quantity to:', qty);
        setSystemQuantity(qty);
      } else {
        console.log('No locations found in first warehouse');
        setSystemQuantity('0');
      }
    } else {
      console.log('No warehouse stock data found');
      setSystemQuantity('0');
    }
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setShowSuggestions(false);
    setProducts([]);
    setSystemQuantity('0');
    setActualQuantity('');
    setWarehouseId('');
    setLocationId('');
    setLocations([]);
    // Reload all warehouses
    fetchWarehouses();
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

    if (!warehouseId || !locationId) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select warehouse and location' });
      return;
    }

    if (!actualQuantity) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please enter actual quantity' });
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Authentication Error', message: 'No authentication token found' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiPrefix}/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId,
          adjustmentType,
          referenceNumber,
          notes: notes || null,
          lines: [
            {
              productId: selectedProduct.id,
              productVariantId: null,
              systemQuantity: parseFloat(systemQuantity),
              countedQuantity: parseFloat(actualQuantity),
              reason: reason || null,
              warehouseLocationId: null,
            },
          ],
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Adjustment created successfully!' });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to create adjustment: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error creating adjustment:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create adjustment. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setReferenceNumber('');
    setWarehouseId('');
    setLocationId('');
    setSystemQuantity('0');
    setActualQuantity('');
    setAdjustmentType('cycle_count');
    setReason('');
    setNotes('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  const difference = parseFloat(actualQuantity || '0') - parseFloat(systemQuantity || '0');

  return (
 <div 
  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  onClick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div className="bg-white rounded-xl max-w-3xl w-full mx-auto shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Create Inventory Adjustment</h3>
        <p className="text-sm text-slate-500 mt-1">Record stock discrepancies and adjustments</p>
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
        {/* Reference Number with Generate Button */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Reference Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="ADJ-2024-001"
            />
            <button
              type="button"
              onClick={generateReferenceNumber}
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

        {/* Warehouse */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Warehouse <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={apiPrefix.includes('warehouse-manager')}
          >
            <option value="">Select Warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={!warehouseId}
          >
            <option value="">Select Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </div>

        {/* Adjustment Type */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Adjustment Type
          </label>
          <select
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="cycle_count">Cycle Count</option>
            <option value="write_off">Write Off</option>
            <option value="damage">Damage</option>
            <option value="found">Found</option>
            <option value="correction">Correction</option>
          </select>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              System Quantity
            </label>
            <input
              type="number"
              value={systemQuantity}
              readOnly
              className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Actual Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Difference
            </label>
            <input
              type="text"
              value={difference.toFixed(2)}
              readOnly
              className={`w-full px-4 py-3 border border-slate-200 rounded-lg font-semibold ${
                difference > 0 ? 'bg-green-50 text-green-700' : difference < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'
              }`}
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            placeholder="Explain the reason for this adjustment..."
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
            disabled={submitting || !selectedProduct || !warehouseId || !locationId}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Adjustment'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
  );
}
