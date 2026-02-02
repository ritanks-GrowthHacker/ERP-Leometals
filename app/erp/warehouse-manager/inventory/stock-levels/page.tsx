'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import RestockModal from '@/components/modal/RestockModal';
import AddProductToWarehouseModal from '@/components/modal/AddProductToWarehouseModal';
import { useAlert } from '@/components/common/CustomAlert';
import { Plus } from 'lucide-react';

interface StockLevel {
  id: string;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  lastCountedAt: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    reorderPoint: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  location: {
    name: string;
    code: string;
  } | null;
}

export default function WarehouseManagerStockLevelsPage() {
  const { showAlert } = useAlert();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Add Product to Location Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [addProductFormData, setAddProductFormData] = useState({
    productId: '',
    locationId: '',
    quantityOnHand: '',
    quantityReserved: '0',
  });
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);

  // Handle query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('productId');
    const highlight = params.get('highlight');
    const locationId = params.get('locationId');
    
    if (highlight) setHighlightProductId(highlight);
    if (productId) setSearchTerm(productId);
  }, []);

  useEffect(() => {
    fetchStockLevels();
    fetchProducts();
    fetchLocations();
  }, [lowStockOnly]);

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/warehouse-manager/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts((data.products || []).filter((p: any) => p.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchLocations = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/warehouse-manager/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchStockLevels = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (lowStockOnly) params.append('lowStock', 'true');

      const response = await fetch(`/api/warehouse-manager/inventory/stock-levels?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // API returns flat structure with underscore fields
        const stockLevels = (data.stockLevels || []).map((item: any) => ({
          id: item.id,
          quantityOnHand: item.quantity_on_hand || '0',
          quantityReserved: item.quantity_reserved || '0',
          quantityAvailable: item.quantity_available || '0',
          lastCountedAt: item.last_counted_at,
          product: {
            id: item.product_id,
            name: item.product_name,
            sku: item.sku,
            reorderPoint: item.reorder_point || '0',
          },
          warehouse: {
            id: item.warehouse_id,
            name: item.warehouse_name,
            code: item.warehouse_code || '',
          },
          location: item.location_id ? {
            name: item.location_name,
            code: item.location_code || '',
          } : null,
        }));
        setStockLevels(stockLevels);
      }
    } catch (error) {
      console.error('Error fetching stock levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (level: StockLevel) => {
    const available = parseFloat(level.quantityOnHand);
    const reorderPoint = parseFloat(level.product.reorderPoint || '0');

    if (available <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800 border-red-300' };
    } else if (available <= reorderPoint) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    } else {
      return { label: 'In Stock', color: 'bg-green-100 text-green-800 border-green-300' };
    }
  };

  const filteredStockLevels = stockLevels.filter((level) =>
    level.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    level.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    level.product?.id === searchTerm
  );

  const totalPages = Math.ceil(filteredStockLevels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStockLevels = filteredStockLevels.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Scroll to highlighted product after data loads
  useEffect(() => {
    if (highlightProductId && stockLevels.length > 0) {
      setTimeout(() => {
        const element = document.querySelector(`[data-product-id="${highlightProductId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightProductId, stockLevels]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Loading stock levels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Levels</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor inventory levels in your warehouse</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddProductModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Assign Product to Location
          </button>
          <button
            onClick={() => (window.location.href = '/erp/warehouse-manager/inventory/adjustments')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
          >
            ✏️ Stock Adjustment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Search Products
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Product name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Show Low Stock Only</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-6">
          <div className="text-2xl font-bold">{filteredStockLevels.length}</div>
          <p className="text-sm text-gray-600">Total Items</p>
        </div>

        <div className="bg-green-50 rounded-xl border border-green-300 overflow-hidden p-6">
          <div className="text-2xl font-bold text-green-700">
            {
              filteredStockLevels.filter((l) => {
                const avail = parseFloat(l.quantityOnHand);
                return avail > parseFloat(l.product.reorderPoint || '0');
              }).length
            }
          </div>
          <p className="text-sm text-green-600">In Stock</p>
        </div>

        <div className="bg-yellow-50 rounded-xl border border-yellow-300 overflow-hidden p-6">
          <div className="text-2xl font-bold text-yellow-700">
            {
              filteredStockLevels.filter((l) => {
                const avail = parseFloat(l.quantityOnHand);
                const reorder = parseFloat(l.product.reorderPoint || '0');
                return avail > 0 && avail <= reorder;
              }).length
            }
          </div>
          <p className="text-sm text-yellow-600">Low Stock</p>
        </div>

        <div className="bg-red-50 rounded-xl border border-red-300 overflow-hidden p-6">
          <div className="text-2xl font-bold text-red-700">
            {
              filteredStockLevels.filter((l) => {
                const avail = parseFloat(l.quantityOnHand);
                return avail <= 0;
              }).length
            }
          </div>
          <p className="text-sm text-red-600">Out of Stock</p>
        </div>
      </div>

      {/* Stock Levels Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStockLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No stock levels found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStockLevels.map((level) => {
                  const status = getStockStatus(level);
                  const available = parseFloat(level.quantityOnHand);
                  const hasLocation = level.location && level.location.name;
                  const isHighlighted = highlightProductId === level.product.id;
                  
                  return (
                    <TableRow 
                      key={level.id} 
                      data-product-id={level.product.id}
                      className={`hover:bg-gray-50/50 transition-colors ${isHighlighted ? 'bg-yellow-100 border-2 border-yellow-400' : ''}`}
                    >
                      <TableCell className="font-medium">{level.product.name}</TableCell>
                      <TableCell>{level.product.sku}</TableCell>
                      <TableCell>
                        {hasLocation ? level.location?.name : <span className="text-orange-600 font-medium">No Location</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {available.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{parseFloat(level.quantityReserved).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{parseFloat(level.quantityOnHand).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded border ${status.color}`}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasLocation ? (
                          <button
                            onClick={() => {
                              setSelectedProduct({
                                id: level.product.id,
                                name: level.product.name,
                                sku: level.product.sku,
                                warehouseId: level.warehouse.id,
                                warehouseName: level.warehouse.name,
                                locationId: level.location?.code || null,
                                availableQuantity: available,
                                reorderPoint: parseFloat(level.product.reorderPoint || '0'),
                              });
                              setShowRestockModal(true);
                            }}
                            className="px-3 py-1 text-sm font-medium text-green-600 hover:bg-green-50 rounded transition"
                          >
                            Restock
                          </button>
                        ) : (
                          <div className="text-xs text-orange-600">
                            ⚠️ Assign location first
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredStockLevels.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredStockLevels.length)} of {filteredStockLevels.length} items
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restock Modal */}
      {selectedProduct && (
        <RestockModal
          isOpen={showRestockModal}
          onClose={() => {
            setShowRestockModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSuccess={() => {
            fetchStockLevels();
          }}
        />
      )}

      {/* Add Product to Location Modal */}
      <AddProductToWarehouseModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setAddProductFormData({
            productId: '',
            locationId: '',
            quantityOnHand: '',
            quantityReserved: '0',
          });
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const token = getAuthToken();
          if (!token) return;

          try {
            setAddProductLoading(true);
            const response = await fetch('/api/warehouse-manager/inventory/stock-levels', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(addProductFormData),
            });

            if (response.ok) {
              showAlert({ type: 'success', title: 'Success', message: 'Product assigned to location successfully!' });
              setShowAddProductModal(false);
              setAddProductFormData({
                productId: '',
                locationId: '',
                quantityOnHand: '',
                quantityReserved: '0',
              });
              fetchStockLevels();
            } else {
              const error = await response.json();
              showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to assign product' });
            }
          } catch (error) {
            console.error('Error assigning product:', error);
            showAlert({ type: 'error', title: 'Error', message: 'Failed to assign product to location' });
          } finally {
            setAddProductLoading(false);
          }
        }}
        products={products}
        locations={locations}
        formData={addProductFormData}
        setFormData={setAddProductFormData}
        loading={addProductLoading}
      />
    </div>
  );
}
