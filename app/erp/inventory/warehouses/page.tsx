'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ChevronDown } from 'lucide-react';
import React from 'react';
import WarehouseModal from '@/components/modal/WarehouseModal';
import AddProductToWarehouseModal from '@/components/modal/AddProductToWarehouseModal';
import WarehouseLifecycleModal from '@/components/modal/WarehouseLifecycleModal';
import { useAlert } from '@/components/common/CustomAlert';
import { LoadingSpinner, ButtonLoader } from '@/components/common/LoadingSpinner';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  managerEmail?: string | null;
  isActive: boolean;
  locations?: any[];
  manager?: {
    name: string;
    address: string;
    mobileNumber: string;
    email?: string;
    gender: string;
  } | null;
  managerName?: string | null;
  managerAddress?: string | null;
  managerMobile?: string | null;
  managerGender?: string | null;
}

export default function WarehousesPage() {
  const { showAlert, showConfirm } = useAlert();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Add Product to Warehouse Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  
  // Lifecycle Modal State
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [lifecycleWarehouseId, setLifecycleWarehouseId] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductFormData, setAddProductFormData] = useState({
    productId: '',
    locationId: '',
    quantityOnHand: '',
    quantityReserved: '0',
  });
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: '',
    phone: '',
    email: '',
    managerName: '',
    managerEmail: '',
    managerAddress: '',
    managerMobile: '',
    managerGender: '',
    isActive: true,
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const mappedWarehouses = (data.warehouses || []).map((w: any) => ({
          ...w,
          managerName: w.manager?.name || null,
          managerEmail: w.manager?.email || w.managerEmail || null,
          managerAddress: w.manager?.address || null,
          managerMobile: w.manager?.mobileNumber || null,
          managerGender: w.manager?.gender || null,
        }));
        setWarehouses(mappedWarehouses);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setGeneratingCode(true);
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'warehouse' }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, code: data.code });
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to generate code' });
      }
    } catch (error) {
      console.error('Error generating code:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to generate code' });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    try {
      const url = '/api/erp/inventory/warehouses';
      const requestBody = editingId ? { ...formData, id: editingId } : formData;
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        await fetchWarehouses();
        resetForm();
        showAlert({ type: 'success', title: 'Success', message: editingId ? 'Warehouse updated successfully!' : 'Warehouse created successfully!' });
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to save warehouse' });
      }
    } catch (error) {
      console.error('Error saving warehouse:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save warehouse' });
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingId(warehouse.id);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      country: warehouse.country || '',
      phone: warehouse.phone || '',
      email: warehouse.email || '',
      managerName: warehouse.managerName || '',
      managerEmail: warehouse.managerEmail || '',
      managerAddress: warehouse.managerAddress || '',
      managerMobile: warehouse.managerMobile || '',
      managerGender: warehouse.managerGender || '',
      isActive: warehouse.isActive !== false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Delete Warehouse',
      message: 'Are you sure you want to delete this warehouse?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/erp/inventory/warehouses/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            await fetchWarehouses();
            showAlert({ type: 'success', title: 'Success', message: 'Warehouse deleted successfully!' });
          } else {
            const error = await response.json();
            showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to delete warehouse' });
          }
        } catch (error) {
          console.error('Error deleting warehouse:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to delete warehouse' });
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      email: '',
      managerName: '',
      managerEmail: '',
      managerAddress: '',
      managerMobile: '',
      managerGender: '',
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleAddProductToWarehouse = async (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    
    const token = getAuthToken();
    if (!token) return;

    try {
      // Fetch products
      const productsRes = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.products || []);
      }

      // Fetch warehouse locations
      const locationsRes = await fetch(`/api/erp/inventory/warehouses/${warehouse.id}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
      }

      setShowAddProductModal(true);
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load product/location data' });
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token || !selectedWarehouse) return;

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
          warehouseId: selectedWarehouse.id,
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
          locationId: '',
          quantityOnHand: '',
          quantityReserved: '0',
        });
        setSelectedWarehouse(null);
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

  const closeAddProductModal = () => {
    setShowAddProductModal(false);
    setSelectedWarehouse(null);
    setAddProductFormData({
      productId: '',
      locationId: '',
      quantityOnHand: '',
      quantityReserved: '0',
    });
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

  // Pagination calculation
  const totalPages = Math.ceil(warehouses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedWarehouses = warehouses.slice(startIndex, endIndex);

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading warehouses..." fullScreen />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 italic">Warehouses</h2>
          <p className="text-sm text-gray-500 mt-1">Manage storage facilities and locations</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Warehouse'}
        </button>
      </div>

      <WarehouseModal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        generatingCode={generatingCode}
        onGenerateCode={handleGenerateCode}
      />

      <AddProductToWarehouseModal
        isOpen={showAddProductModal}
        onClose={closeAddProductModal}
        onSubmit={handleAddProductSubmit}
        warehouseId={selectedWarehouse?.id || ''}
        warehouseName={selectedWarehouse?.name || ''}
        products={products}
        locations={locations}
        formData={addProductFormData}
        setFormData={setAddProductFormData}
        loading={addProductLoading}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Warehouses ({warehouses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          {warehouses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏭</div>
              <p className="text-gray-500 text-lg mb-2">No warehouses found</p>
              <p className="text-gray-400 text-sm">Create your first warehouse to get started!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="font-semibold text-gray-700">Warehouse Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Code</TableHead>
                  <TableHead className="font-semibold text-gray-700">Location</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                  <TableHead className="font-semibold text-gray-700">Email</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedWarehouses.map((warehouse) => (
                  <React.Fragment key={warehouse.id}>
                    <TableRow 
                      className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${
                        !warehouse.isActive ? 'bg-red-100/40' : ''
                      }`}
                      onClick={() => toggleRow(warehouse.id)}
                    >
                      <TableCell className="font-medium text-gray-900">{warehouse.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {warehouse.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {warehouse.city || warehouse.state || warehouse.country ? (
                          <>
                            {warehouse.city}
                            {warehouse.state && `, ${warehouse.state}`}
                            {warehouse.country && ` • ${warehouse.country}`}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            warehouse.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {warehouse.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {warehouse.phone || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {warehouse.email || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(warehouse.id);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 transition-colors"
                        >
                          <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${
                              expandedRows.has(warehouse.id) ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(warehouse.id) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50/30 border-t border-gray-100">
                          <div className="py-4 px-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-md font-semibold text-gray-700 mb-2">Full Address</h4>
                                <p className="text-sm text-gray-600">
                                  {warehouse.address || <span className="text-gray-400">No address provided</span>}
                                </p>
                                {(warehouse.city || warehouse.state || warehouse.country) && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {warehouse.city}
                                    {warehouse.state && `, ${warehouse.state}`}
                                    {warehouse.country && ` • ${warehouse.country}`}
                                  </p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-md font-semibold text-gray-700 mb-2">Storage Information</h4>
                                <p className="text-sm text-gray-600">
                                  {warehouse.locations && warehouse.locations.length > 0 ? (
                                    <>
                                      {warehouse.locations.length} Storage Location{warehouse.locations.length !== 1 ? 's' : ''}
                                    </>
                                  ) : (
                                    <span className="text-gray-400">No storage locations</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="border-t border-gray-200 pt-4 mt-4">
                              <h4 className="text-md font-semibold text-gray-700 mb-2">Manager Details</h4>
                              {warehouse.managerName || warehouse.managerMobile || warehouse.managerGender || warehouse.managerAddress ? (
                                <div className="flex gap-20">
                                  {warehouse.managerName && (
                                    <div>
                                      <p className="text-md text-gray-500">Name</p>
                                      <p className="text-sm text-gray-700 font-medium">{warehouse.managerName}</p>
                                    </div>
                                  )}
                                  {warehouse.managerMobile && (
                                    <div>
                                      <p className="text-md text-gray-500">Mobile Number</p>
                                      <p className="text-sm text-gray-700">{warehouse.managerMobile}</p>
                                    </div>
                                  )}
                                  {warehouse.managerGender && (
                                    <div>
                                      <p className="text-md text-gray-500">Gender</p>
                                      <p className="text-sm text-gray-700">{warehouse.managerGender}</p>
                                    </div>
                                  )}
                                  {warehouse.managerAddress && (
                                    <div className="md:col-span-2">
                                      <p className="text-md text-gray-500">Address</p>
                                      <p className="text-sm text-gray-700">{warehouse.managerAddress}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">No manager information available</p>
                              )}
                            </div>
                            <div className="flex gap-2 pt-2 ml-auto justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddProductToWarehouse(warehouse);
                                }}
                                className="px-4 py-2 w-[150px] cursor-pointer text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                              >
                                + Add Product
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(warehouse);
                                }}
                                className="px-4 py-2 w-[120px] cursor-pointer text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLifecycleWarehouseId(warehouse.id);
                                  setShowLifecycleModal(true);
                                }}
                                className="px-4 py-2 w-[150px] border border-purple-400 cursor-pointer text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                              >
                                View Lifecycle
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/erp/inventory/warehouses/${warehouse.id}`;
                                }}
                                className="px-4 py-2 w-[120px] border border-gray-400 cursor-pointer text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {warehouses.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, warehouses.length)} of {warehouses.length} items
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

      {/* Warehouse Lifecycle Modal */}
      <WarehouseLifecycleModal
        isOpen={showLifecycleModal}
        warehouseId={lifecycleWarehouseId}
        onClose={() => setShowLifecycleModal(false)}
      />
    </div>
  );
}