'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { useAuthStore } from '@/lib/store/authStore';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import RestockModal from '@/components/modal/RestockModal';
import ProductModal from '@/components/modal/ProductModal';
import AddProductToWarehouseModal from '@/components/modal/AddProductToWarehouseModal';
import { useAlert } from '@/components/common/CustomAlert';

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
    isActive?: boolean;
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

// Simplified Levels View Component
function SimplifiedLevelsView({ stockLevels, onRefresh }: { stockLevels: StockLevel[], onRefresh: () => void }) {
  const { showAlert } = useAlert();
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({});
  const [selectedLocations, setSelectedLocations] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [allStockLevels, setAllStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch products with full warehouse and location data + ALL stock levels
  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      if (!token) return;
      
      try {
        setLoading(true);
        
        // Fetch products with warehouse/location structure
        const productsRes = await fetch('/api/erp/inventory/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const fetchedProducts = productsData.products || [];
          setProducts(fetchedProducts);
          
          // Now fetch stock data for each location from each product
          const allStockData: any[] = [];
          
          for (const product of fetchedProducts) {
            if (product.warehouseStock && product.warehouseStock.length > 0) {
              for (const whStock of product.warehouseStock) {
                if (whStock.locations && whStock.locations.length > 0) {
                  for (const loc of whStock.locations) {
                    // Fetch stock data for this specific location
                    const stockRes = await fetch(`/api/erp/inventory/warehouse-locations/${loc.id}/stock`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    
                    if (stockRes.ok) {
                      const stockData = await stockRes.json();
                      const stockItems = stockData.stockItems || [];
                      
                      // Add location and warehouse info to each stock item
                      stockItems.forEach((item: any) => {
                        allStockData.push({
                          ...item,
                          locationId: loc.id,
                          locationName: loc.name,
                          warehouseId: whStock.warehouseId,
                          warehouseName: whStock.warehouseName
                        });
                      });
                    }
                  }
                }
              }
            }
          }
          
          setAllStockLevels(allStockData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Group products by product ID with warehouse and location data
  const groupedData = products.reduce((acc, product) => {
    if (!product.warehouseStock || product.warehouseStock.length === 0) return acc;
    
    const productId = product.id;
    if (!acc[productId]) {
      acc[productId] = {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
        },
        warehouses: {}
      };
    }
    
    // Process each warehouse
    product.warehouseStock.forEach((whStock: any) => {
      const warehouseId = whStock.warehouseId;
      if (!acc[productId].warehouses[warehouseId]) {
        acc[productId].warehouses[warehouseId] = {
          warehouse: {
            id: whStock.warehouseId,
            name: whStock.warehouseName,
          },
          locations: []
        };
      }
      
      // Add all locations for this warehouse
      whStock.locations?.forEach((loc: any) => {
        // Find stock level data from the fetched location stock data
        const stockLevel = allStockLevels.find(sl => 
          sl.productId === productId && 
          sl.warehouseId === warehouseId &&
          sl.locationId === loc.id
        );
        
        acc[productId].warehouses[warehouseId].locations.push({
          id: loc.id,
          name: loc.name,
          code: loc.code,
          stockLevelId: stockLevel?.id || '',
          minQty: stockLevel?.quantityReserved || '0',
          onHandQty: stockLevel?.quantityOnHand || '0',
          availableQty: stockLevel?.quantityOnHand || '0'
        });
      });
    });
    
    return acc;
  }, {} as Record<string, any>);

  // Initialize selected warehouses and locations to first available
  useEffect(() => {
    const initialWarehouses: Record<string, string> = {};
    const initialLocations: Record<string, string> = {};
    
    Object.entries(groupedData).forEach(([productId, data]: [string, any]) => {
      const warehouseIds = Object.keys(data.warehouses);
      if (warehouseIds.length > 0) {
        const firstWarehouseId = warehouseIds[0];
        initialWarehouses[productId] = firstWarehouseId;
        
        const locations = data.warehouses[firstWarehouseId].locations;
        if (locations.length > 0) {
          initialLocations[`${productId}-${firstWarehouseId}`] = locations[0].id;
        }
      }
    });
    
    setSelectedWarehouses(initialWarehouses);
    setSelectedLocations(initialLocations);
  }, [products, allStockLevels]);

  const handleWarehouseChange = (productId: string, warehouseId: string) => {
    setSelectedWarehouses(prev => ({ ...prev, [productId]: warehouseId }));
    
    // Reset location to first location in new warehouse
    const locations = groupedData[productId].warehouses[warehouseId].locations;
    if (locations.length > 0) {
      setSelectedLocations(prev => ({ ...prev, [`${productId}-${warehouseId}`]: locations[0].id }));
    }
  };

  const handleLocationChange = (productId: string, warehouseId: string, locationId: string) => {
    setSelectedLocations(prev => ({ ...prev, [`${productId}-${warehouseId}`]: locationId }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-gray-500">Loading simplified view...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>SKU Code</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Min Qty</TableHead>
            <TableHead className="text-right">Available Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(groupedData).map(([productId, data]: [string, any]) => {
            const selectedWarehouseId = selectedWarehouses[productId] || Object.keys(data.warehouses)[0];
            const warehouseData = data.warehouses[selectedWarehouseId];
            
            if (!warehouseData) return null;
            
            const selectedLocationId = selectedLocations[`${productId}-${selectedWarehouseId}`] || warehouseData.locations[0]?.id;
            const selectedLocation = warehouseData.locations.find((loc: any) => loc.id === selectedLocationId) || warehouseData.locations[0];
            
            const warehouseIds = Object.keys(data.warehouses);
            const hasMultipleWarehouses = warehouseIds.length > 1;
            const hasMultipleLocations = warehouseData.locations.length > 1;
            
            return (
              <TableRow key={productId}>
                <TableCell className="font-medium">{data.product.name}</TableCell>
                <TableCell>{data.product.sku}</TableCell>
                <TableCell>
                  {hasMultipleWarehouses ? (
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => handleWarehouseChange(productId, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {warehouseIds.map((whId) => (
                        <option key={whId} value={whId}>
                          {data.warehouses[whId].warehouse.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{warehouseData.warehouse.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  {hasMultipleLocations ? (
                    <select
                      value={selectedLocationId}
                      onChange={(e) => handleLocationChange(productId, selectedWarehouseId, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {warehouseData.locations.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{selectedLocation?.name || 'N/A'}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{selectedLocation?.minQty || '0'}</TableCell>
                <TableCell className="text-right">
                  <span className={parseFloat(selectedLocation?.availableQty || '0') < parseFloat(selectedLocation?.minQty || '0') ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {selectedLocation?.availableQty || '0'}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {Object.keys(groupedData).length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No stock levels to display
        </div>
      )}
    </div>
  );
}

export default function StockLevelsPage() {
  const { showAlert } = useAlert();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productSuppliers, setProductSuppliers] = useState<any[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatingSKU, setGeneratingSKU] = useState(false);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [showSimplifiedLevels, setShowSimplifiedLevels] = useState(false);

  // Handle query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const warehouseId = params.get('warehouseId');
    const productId = params.get('productId');
    const highlight = params.get('highlight');
    const locationId = params.get('locationId');
    
    if (warehouseId) setSelectedWarehouse(warehouseId);
    if (highlight) setHighlightProductId(highlight);
    if (productId) setSearchTerm(productId);
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [productFormData, setProductFormData] = useState({
    name: '',
    sku: '',
    description: '',
    productCategoryId: '',
    productSubCategoryId: '',
    productType: '',
    trackingType: 'none',
    costPrice: '',
    salePrice: '',
    reorderPoint: '',
    reorderQuantity: '',
    imageUrl: '',
    isActive: true,
  });
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Add Product to Warehouse Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [addProductFormData, setAddProductFormData] = useState({
    productId: '',
    warehouseId: '',
    locationId: '',
    quantityOnHand: '',
    quantityReserved: '0',
  });

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
    fetchSuppliers();
    fetchCategories();
    fetchSubCategories();
    fetchStockLevels();
  }, [selectedWarehouse, lowStockOnly]);

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

  // Fetch locations when warehouse is selected in Add Product modal
  useEffect(() => {
    const fetchLocations = async () => {
      if (!addProductFormData.warehouseId) {
        setLocations([]);
        return;
      }

      const token = getAuthToken();
      if (!token) return;

      try {
        const response = await fetch(`/api/erp/inventory/warehouses/${addProductFormData.warehouseId}/locations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setLocations(data.locations || []);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        setLocations([]);
      }
    };

    fetchLocations();
  }, [addProductFormData.warehouseId]);

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/products', {
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

  const fetchCategories = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubCategories = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/sub-categories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSubCategories(data.subCategories || []);
      }
    } catch (error) {
      console.error('Error fetching sub categories:', error);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWarehouses((data.warehouses || []).filter((w: any) => w.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchStockLevels = async () => {
    const token = getAuthToken();
    if (!token) return;

    const user = useAuthStore.getState().user;
    const isWarehouseManager = user?.role === 'warehouse_manager';

    try {
      setLoading(true);
      
      if (isWarehouseManager) {
        // For warehouse managers, call their specific API
        const response = await fetch('/api/warehouse-manager/inventory/stock-levels', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const deduplicated = deduplicateStockLevels(data.stockLevels || []);
          setStockLevels(deduplicated);
        }
      } else {
        // For admins, use existing API with filters
        const params = new URLSearchParams();
        if (selectedWarehouse) params.append('warehouseId', selectedWarehouse);
        if (lowStockOnly) params.append('lowStock', 'true');

        const response = await fetch(`/api/erp/inventory/stock-levels?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const deduplicated = deduplicateStockLevels(data.stockLevels || []);
          setStockLevels(deduplicated);
        }
      }
    } catch (error) {
      console.error('Error fetching stock levels:', error);
    } finally {
      setLoading(false);
    }
  };

  // Deduplicate stock levels - keep virtual entries, dedupe real entries by product+warehouse
  const deduplicateStockLevels = (levels: any[]) => {
    const virtualEntries: any[] = [];
    const realEntries = new Map<string, any>();

    levels.forEach((level) => {
      // Keep all virtual entries (products not assigned to any warehouse)
      if (level.id.startsWith('virtual-') || !level.warehouse || !level.warehouseId) {
        virtualEntries.push(level);
        return;
      }

      // For real entries, deduplicate by product+warehouse
      const key = `${level.productId}-${level.warehouseId}`;
      const existing = realEntries.get(key);

      if (!existing) {
        // First entry for this product+warehouse combo
        realEntries.set(key, level);
      } else if (level.locationId && !existing.locationId) {
        // New entry has location, existing doesn't - replace with the one that has location
        realEntries.set(key, level);
      } else if (level.locationId && existing.locationId && level.locationId !== existing.locationId) {
        // Both have different locations - keep both as separate entries
        const uniqueKey = `${level.productId}-${level.warehouseId}-${level.locationId}`;
        realEntries.set(uniqueKey, level);
      }
      // If both have no location, or same location, keep the existing one (do nothing)
    });

    // Combine virtual entries and deduplicated real entries
    return [...virtualEntries, ...Array.from(realEntries.values())];
  };

  // const handleEditProduct = async (productId: string) => {
  //   const token = getAuthToken();
  //   if (!token) return;

  //   try {
  //     // Fetch product details
  //     const response = await fetch(`/api/erp/inventory/products/${productId}`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
      
  //     if (response.ok) {
  //       const data = await response.json();
  //       const product = data.product || data;
        
  //       if (!product || !product.id) {
  //         showAlert({ type: 'error', title: 'Error', message: 'Product data not found' });
  //         return;
  //       }
        
  //       setEditingProduct(product);
  //       setProductFormData({
  //         name: product.name,
  //         sku: product.sku,
  //         description: product.description || '',
  //         productCategoryId: product.productCategoryId || '',
  //         productSubCategoryId: product.productSubCategoryId || '',
  //         productType: product.productType,
  //         trackingType: 'none',
  //         costPrice: product.costPrice,
  //         salePrice: product.salePrice,
  //         reorderPoint: product.reorderPoint,
  //         reorderQuantity: product.reorderQuantity,
  //         imageUrl: product.imageUrl || '',
  //         isActive: product.isActive !== false,
  //       });
  //       setImagePreview(product.imageUrl || null);

  //       // Fetch product suppliers
  //       const suppliersResponse = await fetch(`/api/erp/inventory/products/${productId}/suppliers`, {
  //         headers: { Authorization: `Bearer ${token}` },
  //       });
  //       if (suppliersResponse.ok) {
  //         const suppliersData = await suppliersResponse.json();
  //         const suppliersList = (suppliersData.suppliers || []).map((ps: any) => ({
  //           supplierId: ps.supplierId,
  //           supplierSku: ps.supplierSku || '',
  //           supplierProductName: ps.supplierProductName || '',
  //           unitPrice: ps.unitPrice,
  //           leadTimeDays: ps.leadTimeDays.toString(),
  //           minimumOrderQuantity: ps.minimumOrderQuantity,
  //           isPrimary: ps.isPrimary,
  //           isActive: ps.isActive,
  //         }));
  //         setProductSuppliers(suppliersList);
  //       }

  //       setShowProductModal(true);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching product:', error);
  //   }
  // };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getAuthToken();
    if (!token) return;

    const payload = {
      ...productFormData,
      suppliers: productSuppliers,
    };

    try {
      const url = editingProduct 
        ? `/api/erp/inventory/products/${editingProduct.id}` 
        : '/api/erp/inventory/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        resetProductForm();
        fetchProducts();
        fetchStockLevels();
        showAlert({ 
          type: 'success', 
          title: 'Success', 
          message: editingProduct ? 'Product updated successfully!' : 'Product created successfully!' 
        });
      } else {
        const error = await response.json();
        showAlert({ 
          type: 'error', 
          title: 'Error', 
          message: error.error || `Failed to ${editingProduct ? 'update' : 'create'} product` 
        });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save product' });
    }
  };

  const resetProductForm = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setImagePreview(null);
    setProductSuppliers([]);
    setProductFormData({
      name: '',
      sku: '',
      description: '',
      productCategoryId: '',
      productSubCategoryId: '',
      productType: '',
      trackingType: 'none',
      costPrice: '',
      salePrice: '',
      reorderPoint: '',
      reorderQuantity: '',
      imageUrl: '',
      isActive: true,
    });
  };

  const handleGenerateSKU = async () => {
    if (!productFormData.name.trim()) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please enter product name first' });
      return;
    }

    if (!productFormData.productCategoryId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select a category first' });
      return;
    }

    if (!productFormData.productType) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select product type first' });
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      setGeneratingSKU(true);
      
      // Get category and sub category codes
      const category = categories.find(c => c.id === productFormData.productCategoryId);
      const subCategory = subCategories.find(sc => sc.id === productFormData.productSubCategoryId);
      
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          type: 'product',
          productName: productFormData.name,
          categoryCode: category?.code,
          subCategoryCode: subCategory?.code,
          productType: productFormData.productType
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProductFormData({ ...productFormData, sku: data.sku });
      }
    } catch (error) {
      console.error('Error generating SKU:', error);
    } finally {
      setGeneratingSKU(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showAlert({ type: 'error', title: 'Invalid File', message: 'Please upload an image file' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showAlert({ type: 'error', title: 'File Too Large', message: 'Image size should be less than 5MB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setProductFormData({ ...productFormData, imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setProductFormData({ ...productFormData, imageUrl: '' });
  };

  const handleAddSupplier = (supplier: any) => {
    setProductSuppliers([...productSuppliers, supplier]);
  };

  const handleRemoveSupplier = (index: number) => {
    setProductSuppliers(productSuppliers.filter((_, i) => i !== index));
  };

  const handleAddProductToWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    try {
      setAddProductLoading(true);
      const response = await fetch('/api/erp/inventory/stock-levels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: addProductFormData.productId,
          warehouseId: addProductFormData.warehouseId,
          locationId: addProductFormData.locationId || null,
          quantityOnHand: parseFloat(addProductFormData.quantityOnHand),
          quantityReserved: parseFloat(addProductFormData.quantityReserved) || 0,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Product added to warehouse successfully!' });
        setShowAddProductModal(false);
        setAddProductFormData({
          productId: '',
          warehouseId: '',
          locationId: '',
          quantityOnHand: '',
          quantityReserved: '0',
        });
        fetchStockLevels();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to add product to warehouse' });
      }
    } catch (error) {
      console.error('Error adding product to warehouse:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to add product to warehouse' });
    } finally {
      setAddProductLoading(false);
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

  const filteredStockLevels = stockLevels.filter((level) => {
    const matchesSearch = level.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      level.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      level.product?.id === searchTerm;
    
    const matchesWarehouse = !selectedWarehouse || level.warehouse?.id === selectedWarehouse;
    
    // Filter out inactive products
    const isActive = level.product?.isActive !== false;
    
    return matchesSearch && matchesWarehouse && isActive;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStockLevels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStockLevels = filteredStockLevels.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading stock levels...</div>
      </div>
    );
  }

  const handleExportPDF = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/stock-levels/export-pdf', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const html = await response.text();
        
        // Open HTML in new window for printing/saving as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          
          // Auto-trigger print dialog after a short delay
          setTimeout(() => {
            printWindow.print();
          }, 250);
        }
        
        showAlert({ 
          type: 'success', 
          title: 'Success', 
          message: 'Stock Levels report opened. Use Print > Save as PDF to download.' 
        });
      } else {
        showAlert({ 
          type: 'error', 
          title: 'Error', 
          message: 'Failed to generate stock levels report' 
        });
      }
    } catch (error) {
      console.error('Error exporting stock levels:', error);
      showAlert({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to export stock levels' 
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Stock Levels</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddProductModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Stocking
          </button>
          <button
            onClick={() => setShowSimplifiedLevels(!showSimplifiedLevels)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
          >
            {showSimplifiedLevels ? 'Vista' : 'Novice'}
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
          >
            📄 Universal (PDF)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Search Products
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="Product name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Warehouse</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
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

      {/* Simplified Levels View */}
      {showSimplifiedLevels ? (
        <SimplifiedLevelsView 
          stockLevels={filteredStockLevels}
          onRefresh={fetchStockLevels}
        />
      ) : (
        <>
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
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead className="min-w-[120px]">SKU</TableHead>
                <TableHead className="min-w-[150px]">Warehouse</TableHead>
                <TableHead className="min-w-[150px]">Location</TableHead>
                <TableHead className="text-right min-w-[120px]">Available Qty</TableHead>
                <TableHead className="text-right min-w-[120px]">Minimum Qty</TableHead>
                <TableHead className="text-right min-w-[120px]">Total Qty</TableHead>
                <TableHead className="min-w-[120px]">Status</TableHead>
                <TableHead className="min-w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStockLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    No stock levels found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStockLevels.map((level) => {
                  const status = getStockStatus(level);
                  const available = parseFloat(level.quantityOnHand);
                  const isVirtual = level.id.startsWith('virtual-');
                  const isHighlighted = highlightProductId === level.product.id;
                  
                  return (
                    <TableRow 
                      key={level.id} 
                      data-product-id={level.product.id}
                      className={`hover:bg-gray-50/50 transition-colors ${isHighlighted ? 'bg-yellow-100 border-2 border-yellow-400' : ''}`}
                    >
                     <TableCell className="font-medium">
  <div className="flex flex-col">
    <span>{level.product.name}</span>
    {isVirtual && (
      <span className="text-xs text-orange-600">(Not assigned)</span>
    )}
  </div>
</TableCell>
                      <TableCell>{level.product.sku}</TableCell>
                      <TableCell>{level.warehouse?.name || 'Not assigned'}</TableCell>
                      <TableCell>
                        {level.location ? (
                          <span className="text-sm text-gray-700">
                            {level.location.name} <span className="text-gray-500">({level.location.code})</span>
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No location</span>
                        )}
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
                        {!isVirtual ? (
                          <button
                            onClick={() => {
                              setSelectedProduct({
                                id: level.product.id,
                                name: level.product.name,
                                sku: level.product.sku,
                                warehouseId: level.warehouse.id,
                                warehouseName: level.warehouse.name,
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
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-orange-600 font-semibold">⚠️ Not Assigned</span>
                            <span className="text-xs text-gray-500">Click "Stocking" to restock</span>
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
        </>
      )}

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

      {/* Product Edit Modal */}
      <ProductModal
        isOpen={showProductModal}
        onClose={resetProductForm}
        onSubmit={handleProductSubmit}
        formData={productFormData}
        setFormData={setProductFormData}
        editingProduct={editingProduct}
        generatingSKU={generatingSKU}
        onGenerateSKU={handleGenerateSKU}
        imagePreview={imagePreview}
        onImageUpload={handleImageUpload}
        onRemoveImage={handleRemoveImage}
        suppliers={suppliers}
        productSuppliers={productSuppliers}
        onAddSupplier={handleAddSupplier}
        onRemoveSupplier={handleRemoveSupplier}
        categories={categories}
        subCategories={subCategories}
      />

      {/* Add Product to Warehouse Modal */}
      <AddProductToWarehouseModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setAddProductFormData({
            productId: '',
            warehouseId: '',
            locationId: '',
            quantityOnHand: '',
            quantityReserved: '0',
          });
        }}
        onSubmit={handleAddProductToWarehouseSubmit}
        warehouses={warehouses}
        products={products}
        locations={locations}
        formData={addProductFormData}
        setFormData={setAddProductFormData}
        loading={addProductLoading}
      />
    </div>
  );
}