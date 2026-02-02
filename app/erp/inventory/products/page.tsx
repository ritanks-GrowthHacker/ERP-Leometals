'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ChevronDown, List, LayoutGrid } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAuthStore } from '@/lib/store/authStore';
import Barcode from 'react-barcode';
import ProductModal from '@/components/modal/ProductModal';
import ProductViewModal from '@/components/modal/ProductViewModal';
import ProductLifecycleModal from '@/components/modal/ProductLifecycleModal';
import { useAlert } from '@/components/common/CustomAlert';

interface Supplier {
  id: string;
  name: string;
  code?: string;
}

interface Category {
  id: string;
  name: string;
  code: string;
}

interface ProductSupplier {
  supplierId: string;
  supplierSku: string;
  supplierProductName: string;
  unitPrice: string;
  leadTimeDays: string;
  minimumOrderQuantity: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  productType: string;
  costPrice: string;
  salePrice: string;
  isActive: boolean;
  reorderPoint: string;
  reorderQuantity: string;
  description?: string;
  imageUrl?: string;
  availableQuantity?: number;
  unitOfMeasure?: string;
  unitWeight?: string;
  hsnSacCode?: string;
  taxCategory?: string;
  defaultGstRate?: string;
  category?: {
    name: string;
  };
  subCategory?: {
    name: string;
  };
  warehouseStock?: Array<{
    warehouseId: string;
    warehouseName: string;
    quantityOnHand: number;
    locations: Array<{
      id: string;
      name: string;
      code: string;
    }>;
  }>;
}

export default function ProductsPage() {
  const { showAlert } = useAlert();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [lifecycleProductId, setLifecycleProductId] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [generatingSKU, setGeneratingSKU] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'expanded'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showLocationsModal, setShowLocationsModal] = useState<{ warehouseId: string; warehouseName: string; locations: any[]; productId: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    productCategoryId: '',
    productSubCategoryId: '',
    productType: 'storable',
    trackingType: 'none',
    costPrice: '',
    salePrice: '',
    reorderPoint: '',
    reorderQuantity: '',
    imageUrl: '',
    isActive: true,
    unitOfMeasure: '',
    unitWeight: '',
    hsnSacCode: '',
    taxCategory: '',
    defaultGstRate: '',
    defaultPurchaseTaxId: '',
    defaultSalesTaxId: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchCategories();
    fetchSubCategories();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) {
        resetForm();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showForm]);

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) {
      console.error('No token available');
      return;
    }

    const user = useAuthStore.getState().user;
    const isWarehouseManager = user?.role === 'warehouse_manager';
    const apiEndpoint = isWarehouseManager 
      ? '/api/warehouse-manager/inventory/products'
      : '/api/erp/inventory/products';

    try {
      setLoading(true);
      const response = await fetch(apiEndpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        console.error('Failed to fetch products:', response.status);
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
      console.error('Error fetching sub-categories:', error);
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
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleGenerateSKU = async () => {
    if (!formData.name.trim()) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please enter product name first' });
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      setGeneratingSKU(true);
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'product', productName: formData.name }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, sku: data.code });
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to generate SKU' });
      }
    } catch (error) {
      console.error('Error generating SKU:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to generate SKU' });
    } finally {
      setGeneratingSKU(false);
    }
  };

  const handleAddSupplier = (supplier: ProductSupplier) => {
    setProductSuppliers([...productSuppliers, supplier]);
  };

  const handleRemoveSupplier = (index: number) => {
    setProductSuppliers(productSuppliers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Authentication Error', message: 'Not authenticated' });
      return;
    }

    try {
      const payload = {
        ...formData,
        suppliers: productSuppliers,
      };

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
        resetForm();
        fetchProducts();
        showAlert({ type: 'success', title: 'Success', message: editingProduct ? 'Product updated successfully!' : 'Product created successfully!' });
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || `Failed to ${editingProduct ? 'update' : 'create'} product` });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save product' });
    }
  };

  const handleEdit = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      productCategoryId: (product as any).productCategoryId || '',
      productSubCategoryId: (product as any).productSubCategoryId || '',
      productType: product.productType,
      trackingType: 'none',
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      reorderPoint: product.reorderPoint,
      reorderQuantity: product.reorderQuantity,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive !== false,
      unitOfMeasure: (product as any).unitOfMeasure || '',
      unitWeight: (product as any).unitWeight || '',
      hsnSacCode: (product as any).hsnSacCode || '',
      taxCategory: (product as any).taxCategory || '',
      defaultGstRate: (product as any).defaultGstRate || '',
      defaultPurchaseTaxId: (product as any).defaultPurchaseTaxId || '',
      defaultSalesTaxId: (product as any).defaultSalesTaxId || '',
    });
    setImagePreview(product.imageUrl || null);
    
    // Fetch product suppliers
    const token = getAuthToken();
    if (token) {
      try {
        const response = await fetch(`/api/erp/inventory/products/${product.id}/suppliers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const suppliersList = (data.suppliers || []).map((ps: any) => ({
            supplierId: ps.supplierId,
            supplierSku: ps.supplierSku || '',
            supplierProductName: ps.supplierProductName || '',
            unitPrice: ps.unitPrice,
            leadTimeDays: ps.leadTimeDays.toString(),
            minimumOrderQuantity: ps.minimumOrderQuantity,
            isPrimary: ps.isPrimary,
            isActive: ps.isActive,
          }));
          setProductSuppliers(suppliersList);
        }
      } catch (error) {
        console.error('Error fetching product suppliers:', error);
      }
    }
    
    setShowForm(true);
  };

  const handleView = (product: Product) => {
    setViewingProduct(product);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setImagePreview(null);
    setProductSuppliers([]);
    setFormData({
      name: '',
      sku: '',
      description: '',
      productCategoryId: '',
      productSubCategoryId: '',
      productType: 'storable',
      trackingType: 'none',
      costPrice: '',
      salePrice: '',
      reorderPoint: '',
      reorderQuantity: '',
      imageUrl: '',
      isActive: true,
      unitOfMeasure: '',
      unitWeight: '',
      hsnSacCode: '',
      taxCategory: '',
      defaultGstRate: '',
      defaultPurchaseTaxId: '',
      defaultSalesTaxId: '',
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showAlert({ type: 'error', title: 'Invalid File', message: 'Please select an image file' });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showAlert({ type: 'error', title: 'File Too Large', message: 'Image size should be less than 5MB' });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData({ ...formData, imageUrl: base64String });
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, imageUrl: '' });
    setImagePreview(null);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStockStatus = (product: Product) => {
    const availableQty = typeof product.availableQuantity === 'number' 
      ? product.availableQuantity 
      : parseInt(String(product.availableQuantity || '0'));
    const reorderPoint = typeof product.reorderPoint === 'number'
      ? product.reorderPoint
      : parseInt(String(product.reorderPoint || '0'));
    
    if (availableQty <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (reorderPoint > 0 && availableQty <= reorderPoint) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || (product as any).productCategoryId === filterCategory;
    const matchesType = !filterType || product.productType === filterType;
    const matchesWarehouse = !filterWarehouse || true; // Warehouse filter would need stock level data
    
    return matchesSearch && matchesCategory && matchesType && matchesWarehouse;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterType, filterWarehouse]);

  const stats = {
    total: products.length,
    active: products.filter(p => p.isActive).length,
    lowStock: products.filter(p => {
      const reorderPoint = parseFloat(p.reorderPoint || '0');
      const availableQty = typeof p.availableQuantity === 'number' ? p.availableQuantity : parseFloat(String(p.availableQuantity || '0'));
      return reorderPoint > 0 && availableQty <= reorderPoint && availableQty > 0;
    }).length + products.filter(p => {
      const availableQty = typeof p.availableQuantity === 'number' ? p.availableQuantity : parseFloat(String(p.availableQuantity || '0'));
      return availableQty <= 0;
    }).length,
    totalValue: products.reduce((sum, p) => {
      const costPrice = parseFloat(p.costPrice) || 0;
      const availableQty = typeof p.availableQuantity === 'number' ? p.availableQuantity : parseFloat(String(p.availableQuantity || '0'));
      return sum + (costPrice * availableQty);
    }, 0),
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Loading products...</p>
        </div>
      </div>
    );
  }

  const user = useAuthStore.getState().user;
  const isWarehouseManager = user?.role === 'warehouse_manager';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 italic">Product Catalog</h2>
          <p className="text-sm text-gray-500 mt-1 ">Manage and organize your product inventory</p>
        </div>
        {!isWarehouseManager && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Product'}
          </button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Products</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-green-600 mt-1">+12% from last month</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Active Products</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Low Stock Items</div>
          <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
          <div className="text-xs text-orange-600 mt-1">Requires attention</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Inventory Value</div>
          <div className="text-2xl font-bold text-gray-900">₹{(stats.totalValue || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="storable">Storable Product</option>
              <option value="consumable">Consumable</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterCategory('');
                setFilterType('');
                setFilterWarehouse('');
                setSearchTerm('');
              }}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <ProductModal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
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

      {/* Products List - Expandable Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Product Inventory</h3>
              <p className="text-sm text-gray-500">{filteredProducts.length} products found</p>
            </div>
<div className='space-y-1'>
  <input
    type="text"
    placeholder="Search by name or SKU..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
  />
  
  {/* View Mode Toggle */}
  <div className="flex items-center gap-2 justify-end">
    <button
      onClick={() => setViewMode('table')}
      className={`inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        viewMode === 'table'
          ? 'text-blue-600'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <List size={16} />
    </button>
    <button
      onClick={() => setViewMode('expanded')}
      className={`inline-flex items-center cursor-pointer gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        viewMode === 'expanded'
          ? 'text-blue-600'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <LayoutGrid size={16} />
    </button>
  </div>
</div>
          </div>
          
         
        
        </div>
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-500 text-lg mb-2">
                {products.length === 0 ? 'No products found' : 'No results found'}
              </p>
              <p className="text-gray-400 text-sm">
                {products.length === 0
                  ? 'Create your first product to get started!'
                  : 'Try adjusting your search criteria.'}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="font-semibold text-gray-700">Product Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">SKU</TableHead>
                  <TableHead className="font-semibold text-gray-700">Category</TableHead>
                  <TableHead className="font-semibold text-gray-700">Unit Price</TableHead>
                  <TableHead className="font-semibold text-gray-700">Available Qty</TableHead>
                  <TableHead className="font-semibold text-gray-700">Stock Status</TableHead>
                  <TableHead className="font-semibold text-gray-700">Barcode</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  const margin = ((parseFloat(product.salePrice) - parseFloat(product.costPrice)) / parseFloat(product.costPrice) * 100).toFixed(1);

                  return (
                    <React.Fragment key={product.id}>
                      <TableRow
                        className={`hover:bg-blue-100 cursor-pointer transition-colors ${
                          !product.isActive ? 'bg-red-100/40' : ''
                        }`}
                        onClick={() => toggleRow(product.id)}
                      >
                        <TableCell className="font-medium text-gray-900">{product.name}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {product.sku}
                          </span>
                        </TableCell>
                       <TableCell className="text-gray-600">
  <div className="flex flex-col">
    <span><span className='text-black'>{product.category?.name} </span><span className="text-gray-400"></span></span>
    {product.subCategory?.name && (
      <span className="text-xs text-gray-500">{product.subCategory.name}</span>
    )}
  </div>
</TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          ₹{parseFloat(product.salePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-lg text-blue-600">
                            {product.availableQuantity !== undefined ? product.availableQuantity : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {product.sku && (
                            <div className="relative group inline-block">
                              <span className="font-mono text-xs cursor-pointer hover:text-blue-600 transition-colors">
                                {product.sku}
                              </span>
                              {/* Tooltip with Barcode */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                                <div className="bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3">
                                  <Barcode
                                    value={product.sku}
                                    width={2}
                                    height={50}
                                    fontSize={11}
                                    margin={5}
                                    displayValue={true}
                                  />
                                </div>
                                {/* Arrow */}
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-300"></div>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(product.id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                          >
                            <ChevronDown
                              className={`w-5 h-5 text-gray-600 transition-transform ${expandedRows.has(product.id) ? 'rotate-180' : ''
                                }`}
                            />
                          </button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(product.id) && (
                        <TableRow key={`${product.id}-expanded`}>
                          <TableCell colSpan={7} className="bg-gray-50/30 border-t border-gray-100">
                            
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
  {/* Left Column: Product Details */}
  <div>
    <div className="flex gap-4">
      {/* Product Image */}
      <div className="shrink-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
          />
        ) : (
          <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      {/* Product Details */}
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Product Details</h4>
        {product.description ? (
          <p className="text-xs text-gray-600">{product.description}</p>
        ) : (
          <p className="text-xs text-gray-400">No description available</p>
        )}
      </div>
    </div>
    <div className="flex mt-3 gap-[50%]">
      <div className="text-sm ">
        <p className="font-medium">Type</p>
        <p className="capitalize text-xs text-gray-600">{product.productType}</p>
      </div>
      <div className="text-sm text-gray-600">
        <p className="font-medium">Status</p>
        <p className={product.isActive ? 'text-green-600 text-xs' : 'text-gray-500 text-xs'}>
          {product.isActive ? 'Active' : 'Inactive'}
        </p>
      </div>
    </div>

    {/* Tax & Measurement Info */}
    {(product.hsnSacCode || product.taxCategory || product.defaultGstRate || product.unitOfMeasure) && (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Tax & Measurement</h4>
        <div className="grid grid-cols-2 gap-2">
          {product.hsnSacCode && (
            <div className="text-xs">
              <span className="text-gray-500">HSN/SAC:</span>
              <span className="ml-1 font-medium text-gray-900">{product.hsnSacCode}</span>
            </div>
          )}
          {product.taxCategory && (
            <div className="text-xs">
              <span className="text-gray-500">Tax Category:</span>
              <span className="ml-1 font-medium text-gray-900 capitalize">{product.taxCategory.replace('_', ' ')}</span>
            </div>
          )}
          {product.defaultGstRate && (
            <div className="text-xs">
              <span className="text-gray-500">GST Rate:</span>
              <span className="ml-1 font-medium text-gray-900">{product.defaultGstRate}%</span>
            </div>
          )}
          {product.unitOfMeasure && (
            <div className="text-xs">
              <span className="text-gray-500">Unit:</span>
              <span className="ml-1 font-medium text-gray-900">{product.unitOfMeasure.replace('_', ' ')}</span>
            </div>
          )}
          {product.unitWeight && (
            <div className="text-xs">
              <span className="text-gray-500">Weight:</span>
              <span className="ml-1 font-medium text-gray-900">{product.unitWeight}g</span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>

  {/* Right Column: Pricing & Inventory */}
  <div>
    <h4 className="text-sm font-semibold text-gray-700 mb-2">Pricing & Inventory</h4>
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-semibold">Cost Price:</span>
        <span className="font-semibold text-gray-900">
          ₹{parseFloat(product.costPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-semibold">Selling Price:</span>
        <span className="font-semibold text-green-600">
          ₹{parseFloat(product.salePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-semibold">Profit Margin:</span>
        <span className={`font-semibold ${parseFloat(margin) > 20 ? 'text-green-600' : 'text-gray-600'}`}>
          {margin}%
        </span>
      </div>
      <div className="pt-2 border-t border-gray-200">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 font-semibold">Reorder Level:</span>
          <span className="font-medium text-gray-900">{product.reorderPoint || 'Not set'}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-600 font-semibold">Max value:</span>
          <span className="font-medium text-gray-900">{product.reorderQuantity || 'Not set'}</span>
        </div>
      </div>
    </div>
  </div>

  {/* Middle Row: Warehouse Locations */}
  <div className="col-span-full mt-4 p-3 bg-blue-50/30 rounded-lg border border-blue-100">
    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Warehouse Locations</h4>
    {product.warehouseStock && product.warehouseStock.length > 0 ? (
      <div className="space-y-1.5">
        {product.warehouseStock.map((ws: any, idx: number) => {
          const locations = ws.locations || [];
          const primaryLocation = locations[0];
          const additionalCount = locations.length - 1;
          
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">{ws.warehouseName}</span>
              <span className="text-gray-400">-</span>
              {primaryLocation ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      window.location.href = `/erp/inventory/warehouse-locations/${primaryLocation.id}?productId=${product.id}&highlight=${product.id}`;
                    }}
                    className="text-gray-600 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                  >
                    {primaryLocation.name}
                  </button>
                  {additionalCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowLocationsModal({
                          warehouseId: ws.warehouseId,
                          warehouseName: ws.warehouseName,
                          locations: locations,
                          productId: product.id
                        });
                      }}
                      className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium cursor-pointer transition-colors"
                      title={locations.slice(1).map((l: any) => l.name).join(', ')}
                    >
                      +{additionalCount}
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-gray-400 italic">No location assigned</span>
              )}
              <span className="ml-auto text-gray-500">
                Stock: <span className="font-semibold text-gray-700">{ws.quantityOnHand}</span>
              </span>
            </div>
          );
        })}
      </div>
    ) : (
      <p className="text-xs text-gray-500 italic">Not assigned to any warehouse</p>
    )}
  </div>

  {/* Bottom Row: Barcode (Left) and Buttons (Right) Aligned Horizontally */}
  {/* We use col-span-full to make this row take the entire width of the grid */}
  <div className="col-span-full flex items-end justify-between mt-6 pt-4 border-gray-100">
    
    {/* Barcode on the Left */}
    {product.sku && (
      <div className="border w-[30%] border-gray-200 rounded-lg p-2 bg-gray-50">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Product Barcode</h4>
        <div className="flex bg-white p-1 rounded">
          <Barcode
            value={product.sku}
            width={1}
            height={30}
            fontSize={12}
            margin={0}
            displayValue={true}
          />
        </div>
      </div>
    )}

    {/* Buttons on the Right */}
    <div className="flex gap-3">
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleEdit(product);
        }}
        className="px-4 py-2 w-[120px] text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
      >
        Edit
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleView(product);
        }}
        className="px-4 py-2 w-[120px] border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
      >
        View Details
      </button>
    </div>
  </div>
</div>

                             

                             
                            
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            // Expanded View
            <div className="grid grid-cols-1 gap-4 p-6">
              {paginatedProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                const margin = ((parseFloat(product.salePrice) - parseFloat(product.costPrice)) / parseFloat(product.costPrice) * 100).toFixed(1);

                return (
                  <div key={product.id} className={`border rounded-lg p-6 ${!product.isActive ? 'bg-red-50/40 border-red-200' : 'border-gray-200'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column: Product Details */}
                      <div>
                        <div className="flex gap-4 mb-4">
                          {/* Product Image */}
                          <div className="shrink-0">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                              />
                            ) : (
                              <div className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
                                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          {/* Product Info */}
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{product.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{product.sku}</span>
                            </p>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                                {stockStatus.label}
                              </span>
                              <span className={`text-xs font-medium ${product.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                {product.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                          {product.description ? (
                            <p className="text-sm text-gray-600">{product.description}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">No description available</p>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">Category</p>
                            <p className="text-sm font-medium text-gray-900">{product.category?.name || '-'}</p>
                            <p className="text-sm font-medium text-gray-900">{product.subCategory?.name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Product Type</p>
                            <p className="text-sm font-medium text-gray-900 capitalize">{product.productType}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Available Quantity</p>
                            <p className="text-sm font-bold text-blue-600">
                              {product.availableQuantity !== undefined ? product.availableQuantity : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Reorder Point</p>
                            <p className="text-sm font-medium text-gray-900">{product.reorderPoint || 'Not set'}</p>
                          </div>
                        </div>

                        {/* Tax & Measurement Info */}
                        {(product.hsnSacCode || product.taxCategory || product.defaultGstRate || product.unitOfMeasure) && (
                          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <h4 className="text-sm font-semibold text-amber-900 mb-2">Tax & Measurement</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {product.hsnSacCode && (
                                <div className="text-xs">
                                  <span className="text-gray-600">HSN/SAC Code:</span>
                                  <p className="font-medium text-gray-900">{product.hsnSacCode}</p>
                                </div>
                              )}
                              {product.taxCategory && (
                                <div className="text-xs">
                                  <span className="text-gray-600">Tax Category:</span>
                                  <p className="font-medium text-gray-900 capitalize">{product.taxCategory.replace('_', ' ')}</p>
                                </div>
                              )}
                              {product.defaultGstRate && (
                                <div className="text-xs">
                                  <span className="text-gray-600">Default GST:</span>
                                  <p className="font-medium text-gray-900">{product.defaultGstRate}%</p>
                                </div>
                              )}
                              {product.unitOfMeasure && (
                                <div className="text-xs">
                                  <span className="text-gray-600">Unit of Measure:</span>
                                  <p className="font-medium text-gray-900">{product.unitOfMeasure.replace('_', ' ')}</p>
                                </div>
                              )}
                              {product.unitWeight && (
                                <div className="text-xs">
                                  <span className="text-gray-600">Unit Weight:</span>
                                  <p className="font-medium text-gray-900">{product.unitWeight}g</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Pricing & Warehouse Info */}
                      <div>
                        {/* Pricing */}
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Pricing Information</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Cost Price:</span>
                              <span className="text-sm font-semibold text-gray-900">
                                ₹{parseFloat(product.costPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Selling Price:</span>
                              <span className="text-sm font-semibold text-green-600">
                                ₹{parseFloat(product.salePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                              <span className="text-sm text-gray-600">Profit Margin:</span>
                              <span className={`text-sm font-semibold ${parseFloat(margin) > 20 ? 'text-green-600' : 'text-gray-600'}`}>
                                {margin}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Warehouse Locations */}
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-900 mb-3">Warehouse Locations</h4>
                          {product.warehouseStock && product.warehouseStock.length > 0 ? (
                            <div className="space-y-2">
                              {product.warehouseStock.map((ws: any, idx: number) => {
                                const locations = ws.locations || [];
                                const primaryLocation = locations[0];
                                const additionalCount = locations.length - 1;
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                                    <div>
                                      <p className="font-semibold text-gray-700">{ws.warehouseName}</p>
                                      {primaryLocation && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              window.location.href = `/erp/inventory/warehouse-locations/${primaryLocation.id}?productId=${product.id}&highlight=${product.id}`;
                                            }}
                                            className="text-xs text-gray-600 hover:text-blue-600 hover:underline"
                                          >
                                            {primaryLocation.name}
                                          </button>
                                          {additionalCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                setShowLocationsModal({
                                                  warehouseId: ws.warehouseId,
                                                  warehouseName: ws.warehouseName,
                                                  locations: locations,
                                                  productId: product.id
                                                });
                                              }}
                                              className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium"
                                            >
                                              +{additionalCount}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700">Stock: {ws.quantityOnHand}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Not assigned to any warehouse</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barcode and Actions */}
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      {product.sku && (
                        <div className="border border-gray-200 rounded-lg p-3 bg-white">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Barcode</h4>
                          <Barcode
                            value={product.sku}
                            width={1.5}
                            height={40}
                            fontSize={12}
                            margin={0}
                            displayValue={true}
                          />
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleView(product)}
                          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
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

      {/* View Product Modal */}
      <ProductViewModal
        isOpen={showViewModal}
        product={viewingProduct}
        onClose={() => setShowViewModal(false)}
        onEdit={handleEdit}
        onViewLifecycle={(productId) => {
          setLifecycleProductId(productId);
          setShowLifecycleModal(true);
        }}
      />

      {/* Product Lifecycle Modal */}
      <ProductLifecycleModal
        isOpen={showLifecycleModal}
        productId={lifecycleProductId}
        onClose={() => setShowLifecycleModal(false)}
      />

      {/* Locations Modal */}
      {showLocationsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLocationsModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{showLocationsModal.warehouseName} - Locations</h3>
              <p className="text-sm text-gray-500 mt-1">Click a location to view stock details</p>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {showLocationsModal.locations.map((location: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      window.location.href = `/erp/inventory/warehouse-locations/${location.id}?productId=${showLocationsModal.productId}&highlight=${showLocationsModal.productId}`;
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 group-hover:text-blue-600">{location.name}</p>
                        {location.code && <p className="text-xs text-gray-500">{location.code}</p>}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowLocationsModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
