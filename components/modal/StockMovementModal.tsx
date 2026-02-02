'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, X } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
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

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiPrefix?: string;
}

export default function StockMovementModal({ isOpen, onClose, onSuccess, apiPrefix = '/api/erp/inventory' }: StockMovementModalProps) {
  const { showAlert } = useAlert();
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [sourceLocations, setSourceLocations] = useState<any[]>([]);
  const [destinationLocations, setDestinationLocations] = useState<any[]>([]);
  const [availableQuantity, setAvailableQuantity] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    sourceLocationId: '',
    destinationLocationId: '',
    movementType: 'internal_transfer',
    quantity: '',
    unitCost: '',
    notes: '',
    movementDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isOpen) {
      generateReferenceNumber();
      fetchWarehouses();
      resetForm();
    }
  }, [isOpen]);

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

  // Auto-populate unit cost when product is selected
  useEffect(() => {
    if (selectedProduct?.costPrice) {
      setFormData(prev => ({ ...prev, unitCost: selectedProduct.costPrice }));
    }
    // Filter locations if warehouse manager
    if (selectedProduct && locations.length > 0 && warehouses.length === 1) {
      fetchLocationsForProduct(selectedProduct.id, warehouses[0].id);
    }
  }, [selectedProduct]);

  const generateReferenceNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setReferenceNumber(`MOV-${timestamp}-${random}`);
    setGenerating(false);
  };

  const searchProducts = async (term: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${apiPrefix}/products?search=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Map snake_case to camelCase for cost_price
        const mappedProducts = (data.products || []).map((p: any) => ({
          ...p,
          costPrice: p.cost_price || p.costPrice,
        }));
        setProducts(mappedProducts);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${apiPrefix}/warehouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both admin (warehouses array) and warehouse manager (single warehouse + locations)
        if (data.warehouse) {
          // Warehouse manager response - use locations as warehouses
          setWarehouses([data.warehouse]);
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
        
        setLocations(Array.from(locationsMap.values()));
      }
    } catch (error) {
      console.error('Error fetching locations for product:', error);
    }
  };

  // Fetch warehouses and locations where product exists
  const fetchProductLocations = async (productId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/stock-levels?productId=${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        
        // Group locations by warehouse
        const warehouseLocMap = new Map();
        let totalAvailable = 0;
        
        data.stockLevels.forEach((sl: any) => {
          const whId = sl.warehouse_id || sl.warehouseId;
          const whName = sl.warehouse_name || sl.warehouseName;
          const locId = sl.location_id || sl.locationId;
          const locName = sl.location_name || sl.locationName;
          const locCode = sl.location_code || sl.locationCode;
          const onHand = parseFloat(sl.quantity_on_hand || sl.quantityOnHand || '0');
          const available = onHand;
          
          totalAvailable += available;
          
          if (whId && locId) {
            if (!warehouseLocMap.has(whId)) {
              warehouseLocMap.set(whId, {
                id: whId,
                name: whName,
                locations: []
              });
            }
            
            warehouseLocMap.get(whId).locations.push({
              id: locId,
              name: locName,
              code: locCode,
              warehouseId: whId,
              warehouseName: whName,
              availableQuantity: available,
              displayName: `${whName} - ${locName}`,
            });
          }
        });
        
        // Set source locations (all locations where product exists)
        const allLocs: any[] = [];
        warehouseLocMap.forEach(wh => {
          allLocs.push(...wh.locations);
        });
        setSourceLocations(allLocs);
        setAvailableQuantity(totalAvailable.toFixed(2));
        
        // Also set warehouses for destination (all warehouses)
        fetchWarehouses();
      }
    } catch (error) {
      console.error('Error fetching product locations:', error);
    }
  };

  // Fetch destination locations when destination warehouse is selected
  const fetchDestinationLocations = async (warehouseId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiPrefix}/warehouses/${warehouseId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const warehouse = warehouses.find(w => w.id === warehouseId);
        const locs = (data.locations || []).map((loc: any) => ({
          ...loc,
          displayName: `${warehouse?.name || 'Warehouse'} - ${loc.name}`,
          warehouseId: warehouseId,
        }));
        setDestinationLocations(locs);
      }
    } catch (error) {
      console.error('Error fetching destination locations:', error);
    }
  };

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.name} (${product.sku})`);
    setShowSuggestions(false);
    setProducts([]);
    
    // Use warehouse stock data directly from the product object
    setAvailableQuantity((product.availableQuantity || 0).toString());
    
    // Build source locations from warehouseStock array
    const locs = product.warehouseStock?.flatMap(wh => 
      (wh.locations || []).map(loc => ({
        id: loc.id,
        name: loc.name,
        code: loc.code,
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        availableQuantity: wh.quantityOnHand,
        displayName: `${wh.warehouseName} - ${loc.name} (Qty: ${wh.quantityOnHand})`
      }))
    ) || [];
    
    setSourceLocations(locs);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setProducts([]);
    setShowSuggestions(false);
    setSourceLocations([]);
    setDestinationLocations([]);
    setAvailableQuantity('');
    setFormData(prev => ({ ...prev, unitCost: '', sourceWarehouseId: '', sourceLocationId: '', destinationWarehouseId: '', destinationLocationId: '', quantity: '' }));
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const resetForm = () => {
    setFormData({
      sourceWarehouseId: '',
      destinationWarehouseId: '',
      sourceLocationId: '',
      destinationLocationId: '',
      movementType: 'internal_transfer',
      quantity: '',
      unitCost: '',
      notes: '',
      movementDate: new Date().toISOString().split('T')[0],
    });
    setSelectedProduct(null);
    setSearchTerm('');
    setProducts([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select a product' });
      return;
    }

    if (!formData.sourceLocationId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select source warehouse-location' });
      return;
    }

    if (!formData.destinationWarehouseId || !formData.destinationLocationId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select destination warehouse and location' });
      return;
    }

    if (formData.sourceLocationId === formData.destinationLocationId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Source and destination locations must be different' });
      return;
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please enter a valid quantity' });
      return;
    }

    setSubmitting(true);
    const token = getAuthToken();

    try {
      const selectedSourceLocation = sourceLocations.find(loc => loc.id === formData.sourceLocationId);
      
      const payload: any = {
        movementType: formData.movementType,
        scheduledDate: formData.movementDate,
        notes: formData.notes || null,
        referenceNumber,
        sourceWarehouseId: selectedSourceLocation?.warehouseId || null,
        sourceLocationId: formData.sourceLocationId,
        destinationWarehouseId: formData.destinationWarehouseId || null,
        destinationLocationId: formData.destinationLocationId,
        lines: [
          {
            productId: selectedProduct.id,
            productVariantId: null,
            quantityOrdered: parseFloat(formData.quantity),
            unitCost: parseFloat(formData.unitCost || '0'),
            uomId: null,
            notes: null,
          },
        ],
      };

      const response = await fetch(`${apiPrefix}/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Stock movement created successfully!' });
        resetForm();
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Error: ${data.error || 'Failed to create stock movement'}` });
      }
    } catch (error) {
      console.error('Error creating stock movement:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create stock movement' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalValue = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.unitCost) || 0);

  return (
   <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="bg-slate-50/50 backdrop-blur-sm px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Create Stock Movement</h2>
        <p className="text-sm text-slate-500 mt-0.5">Transfer inventory between warehouses</p>
      </div>
      <button
        onClick={onClose}
        disabled={submitting}
        className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Form - Scrollable Area */}
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Reference Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Movement Reference <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={referenceNumber}
              readOnly
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
            />
            <button
              type="button"
              onClick={generateReferenceNumber}
              disabled={generating}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Generate
            </button>
          </div>
        </div>

        {/* Product Search */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Product <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => products.length > 0 && setShowSuggestions(true)}
              placeholder="Search products by name or SKU..."
              disabled={submitting || !!selectedProduct}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
            {selectedProduct && (
              <button
                type="button"
                onClick={handleClearProduct}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showSuggestions && products.length > 0 && !selectedProduct && (
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

        {/* Available Quantity Display */}
        {selectedProduct && availableQuantity !== '' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">Available Quantity:</span>
              <span className="text-lg font-semibold text-green-600">
                {availableQuantity} units
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Source Warehouse-Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              From Warehouse - Location <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.sourceLocationId}
              onChange={(e) => setFormData({ ...formData, sourceLocationId: e.target.value })}
              required
              disabled={submitting || !selectedProduct}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select source warehouse - location</option>
              {sourceLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.displayName} (Qty: {loc.availableQuantity})
                </option>
              ))}
            </select>
            {!selectedProduct && (
              <p className="text-xs text-slate-500 mt-1">Select a product first</p>
            )}
          </div>

          {/* Destination Warehouse */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              To Warehouse <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.destinationWarehouseId}
              onChange={(e) => {
                setFormData({ ...formData, destinationWarehouseId: e.target.value, destinationLocationId: '' });
                if (e.target.value) {
                  fetchDestinationLocations(e.target.value);
                } else {
                  setDestinationLocations([]);
                }
              }}
              required
              disabled={submitting || !selectedProduct}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select destination warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Destination Location - Only show if destination warehouse selected */}
        {formData.destinationWarehouseId && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              To Location <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.destinationLocationId}
              onChange={(e) => setFormData({ ...formData, destinationLocationId: e.target.value })}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select destination location</option>
              {destinationLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Movement Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Movement Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.movementType}
              onChange={(e) => setFormData({ ...formData, movementType: e.target.value })}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            >
              <option value="internal_transfer">Internal Transfer</option>
              <option value="receipt">Receipt</option>
              <option value="delivery">Delivery</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="scrap">Scrap</option>
            </select>
          </div>

          {/* Movement Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Movement Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.movementDate}
              onChange={(e) => setFormData({ ...formData, movementDate: e.target.value })}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
              min="0.01"
              disabled={submitting}
              placeholder="Enter quantity"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            />
          </div>

          {/* Unit Cost - Auto-populated */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unit Cost
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.unitCost}
              onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
              min="0"
              disabled={submitting}
              placeholder="Auto-populated"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 bg-blue-50"
            />
            <p className="text-xs text-slate-500 mt-1">Auto-populated from product cost price</p>
          </div>
        </div>

        {/* Total Value Display */}
        {totalValue > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">Total Movement Value:</span>
              <span className="text-lg font-semibold text-blue-600">
                ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

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
            placeholder="Add any notes or comments..."
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
            disabled={submitting || !selectedProduct}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? 'Creating...' : 'Create Movement'}
          </button>
        </div>
      </div>
    </form>
  </div>
</div>
  );
}
