'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { Maximize2, Minimize2 } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string | null;
  email: string | null;
}

interface Location {
  id: string;
  name: string;
  code: string;
  locationType: string | null;
  capacity: string | null;
  isActive: boolean;
  parentLocation: {
    name: string;
    code: string;
  } | null;
}

interface StockLevel {
  id: string;
  quantityOnHand: string;
  quantityReserved: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  location: {
    name: string;
    code: string;
  } | null;
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = params.id as string;
  const { showAlert } = useAlert();

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [isStockFullscreen, setIsStockFullscreen] = useState(false);
  const [isLocationsFullscreen, setIsLocationsFullscreen] = useState(false);
  
  // Pagination and search for locations
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [locationCurrentPage, setLocationCurrentPage] = useState(1);
  const locationItemsPerPage = 10;
  
  // Pagination and search for stock levels
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockCurrentPage, setStockCurrentPage] = useState(1);
  const stockItemsPerPage = 10;
  
  const [locationForm, setLocationForm] = useState({
    name: '',
    code: '',
    locationType: 'zone' as 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin',
    parentLocationId: '',
    capacity: '',
    address: '',
    managerName: '',
    managerEmail: '',
    managerMobile: '',
    managerGender: '',
  });

  const generateLocationCode = async () => {
    if (!locationForm.name) {
      alert('Please enter location name first');
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    setGeneratingCode(true);
    try {
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'location',
          locationName: locationForm.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocationForm({ ...locationForm, code: data.code });
      }
    } catch (error) {
      console.error('Error generating code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('productId');
    const highlight = params.get('highlight');
    
    if (highlight) setHighlightProductId(highlight);
    if (productId) setStockSearchTerm(productId);
  }, []);

  useEffect(() => {
    if (warehouseId) {
      fetchWarehouse();
      fetchLocations();
      fetchStockLevels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  // Scroll to highlighted product after stock levels load
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

  const fetchWarehouse = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/warehouses/${warehouseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWarehouse(data.warehouse);
      }
    } catch (error) {
      console.error('Error fetching warehouse:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/locations`, {
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
      const response = await fetch(`/api/erp/inventory/stock-levels?warehouseId=${warehouseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStockLevels(data.stockLevels || []);
      }
    } catch (error) {
      console.error('Error fetching stock levels:', error);
    }
  };

  const handleCreateLocation = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: locationForm.name,
          code: locationForm.code,
          locationType: locationForm.locationType,
          parentLocationId: locationForm.parentLocationId || null,
          capacity: locationForm.capacity ? parseFloat(locationForm.capacity) : null,
          address: locationForm.address || null,
          managerName: locationForm.managerName || null,
          managerEmail: locationForm.managerEmail || null,
          managerMobile: locationForm.managerMobile || null,
          managerGender: locationForm.managerGender || null,
        }),
      });

      if (response.ok) {
        setShowLocationForm(false);
        setLocationForm({
          name: '',
          code: '',
          locationType: 'zone',
          parentLocationId: '',
          capacity: '',
          address: '',
          managerName: '',
          managerEmail: '',
          managerMobile: '',
          managerGender: '',
        });
        fetchLocations();
      }
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  const getLocationPath = (location: Location): string => {
    if (!location.parentLocation) return location.name;
    return `${location.parentLocation.name} > ${location.name}`;
  };
  
  // Filter and paginate locations
  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(locationSearchTerm.toLowerCase()) ||
    location.code.toLowerCase().includes(locationSearchTerm.toLowerCase()) ||
    (location.locationType && location.locationType.toLowerCase().includes(locationSearchTerm.toLowerCase()))
  );
  
  const totalLocationPages = Math.ceil(filteredLocations.length / locationItemsPerPage);
  const paginatedLocations = filteredLocations.slice(
    (locationCurrentPage - 1) * locationItemsPerPage,
    locationCurrentPage * locationItemsPerPage
  );
  
  // Filter and paginate stock levels
  const filteredStockLevels = stockLevels.filter(level =>
    level.product.name.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
    level.product.sku.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
    level.product.id === stockSearchTerm ||
    (level.location?.name && level.location.name.toLowerCase().includes(stockSearchTerm.toLowerCase()))
  );
  
  const totalStockPages = Math.ceil(filteredStockLevels.length / stockItemsPerPage);
  const paginatedStockLevels = filteredStockLevels.slice(
    (stockCurrentPage - 1) * stockItemsPerPage,
    stockCurrentPage * stockItemsPerPage
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading warehouse details...</div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="p-6">
        <div className="text-center text-red-500">Warehouse not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 italic">
            {warehouse.name} ({warehouse.code})
          </h1>
        </div>
        <span
          className={`px-3 py-1 rounded ${
            warehouse.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {warehouse.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Warehouse Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Warehouse Information</h3>
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-medium capitalize">{warehouse.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-medium">
                {warehouse.addressLine1}
                {warehouse.addressLine2 && `, ${warehouse.addressLine2}`}
                <br />
                {warehouse.city}, {warehouse.state} {warehouse.postalCode}
                <br />
                {warehouse.country}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium">{warehouse.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{warehouse.email || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div>
            <div className="text-2xl font-bold">{locations.length}</div>
            <p className="text-sm text-gray-600">Total Locations</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div>
            <div className="text-2xl font-bold">{stockLevels.length}</div>
            <p className="text-sm text-gray-600">Products Stored</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div>
            <div className="text-2xl font-bold">
              {stockLevels
                .reduce((sum, sl) => sum + parseFloat(sl.quantityOnHand), 0)
                .toFixed(2)}
            </div>
            <p className="text-sm text-gray-600">Total Units</p>
          </div>
        </div>
      </div>
}
      {/* Locations */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Warehouse Locations ({locations.length})
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search locations..."
              value={locationSearchTerm}
              onChange={(e) => {
                setLocationSearchTerm(e.target.value);
                setLocationCurrentPage(1); // Reset to first page on search
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={() => setShowLocationForm(!showLocationForm)}>
              {showLocationForm ? 'Cancel' : 'Add Location'}
            </Button>
          </div>
        </div>
        <div>
          {showLocationForm && (
            <div className="mb-6 p-4 border rounded bg-gray-50">
              <h3 className="font-semibold mb-4">Create New Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name*</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Code*</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border rounded bg-gray-50"
                      value={locationForm.code}
                      readOnly
                      placeholder="Click Generate to create unique code"
                    />
                    <button
                      type="button"
                      onClick={generateLocationCode}
                      disabled={generatingCode || !locationForm.name}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {generatingCode ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter name first, then click Generate for unique code</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type*</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.locationType}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        locationType: e.target.value as any,
                      })
                    }
                  >
                    <option value="zone">Zone</option>
                    <option value="aisle">Aisle</option>
                    <option value="rack">Rack</option>
                    <option value="shelf">Shelf</option>
                    <option value="bin">Bin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Parent Location</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.parentLocationId}
                    onChange={(e) =>
                      setLocationForm({ ...locationForm, parentLocationId: e.target.value })
                    }
                  >
                    <option value="">None (Top Level)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {getLocationPath(loc)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Capacity</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.capacity}
                    onChange={(e) => setLocationForm({ ...locationForm, capacity: e.target.value })}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded"
                    rows={2}
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    placeholder="Enter physical address of this location"
                  />
                </div>
              </div>

              <h4 className="font-semibold mt-6 mb-4 text-gray-700">Location Manager Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Manager Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.managerName}
                    onChange={(e) => setLocationForm({ ...locationForm, managerName: e.target.value })}
                    placeholder="Enter manager name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Manager Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.managerEmail}
                    onChange={(e) => setLocationForm({ ...locationForm, managerEmail: e.target.value })}
                    placeholder="manager@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Manager Mobile</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.managerMobile}
                    onChange={(e) => setLocationForm({ ...locationForm, managerMobile: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Manager Gender</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={locationForm.managerGender}
                    onChange={(e) => setLocationForm({ ...locationForm, managerGender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <Button onClick={handleCreateLocation}>Create Location</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Code</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                  {/* <th className="px-4 py-2 text-left text-sm font-semibold">Warehouse Type</th> */}
                  <th className="px-4 py-2 text-left text-sm font-semibold">Location Type</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Path</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Capacity</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedLocations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">{location.code}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => router.push(`/erp/inventory/warehouse-locations/${location.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {location.name}
                      </button>
                    </td>
                    {/* <td className="px-4 py-2 capitalize">{warehouse?.type || '-'}</td> */}
                    <td className="px-4 py-2 capitalize">{location.locationType || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {getLocationPath(location)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {location.capacity ? parseFloat(location.capacity).toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={async () => {
                          const token = getAuthToken();
                          if (!token) return;
                          
                          try {
                            const newStatus = !location.isActive;
                            const response = await fetch(`/api/erp/inventory/warehouse-locations/${location.id}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ isActive: newStatus }),
                            });
                            
                            if (response.ok) {
                              // Refetch locations first
                              await fetchLocations();
                              
                              // After updating, check location statuses
                              const locationsRes = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/locations`, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              
                              if (locationsRes.ok) {
                                const locData = await locationsRes.json();
                                const allInactive = locData.locations.every((loc: Location) => !loc.isActive);
                                const anyActive = locData.locations.some((loc: Location) => loc.isActive);
                                
                                // If all locations are inactive, deactivate warehouse
                                if (allInactive && warehouse?.isActive) {
                                  await fetch(`/api/erp/inventory/warehouses/${warehouseId}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ ...warehouse, isActive: false }),
                                  });
                                  fetchWarehouse();
                                  showAlert({ type: 'warning', title: 'Warehouse Deactivated', message: 'All warehouse locations are inactive. Warehouse has been deactivated.' });
                                }
                                // If any location is active, activate warehouse
                                else if (anyActive && !warehouse?.isActive) {
                                  await fetch(`/api/erp/inventory/warehouses/${warehouseId}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ ...warehouse, isActive: true }),
                                  });
                                  fetchWarehouse();
                                  showAlert({ type: 'success', title: 'Warehouse Activated', message: 'Warehouse has been activated because at least one location is active.' });
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Error toggling location status:', error);
                            showAlert({ type: 'error', title: 'Error', message: 'Failed to toggle location status' });
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                          location.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {location.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLocations.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                {locationSearchTerm ? 'No locations found matching your search' : 'No locations defined. Click "Add Location" to create one.'}
              </div>
            )}
          </div>
          
          {/* Locations Pagination */}
          {filteredLocations.length > locationItemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((locationCurrentPage - 1) * locationItemsPerPage) + 1} to {Math.min(locationCurrentPage * locationItemsPerPage, filteredLocations.length)} of {filteredLocations.length} locations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLocationCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={locationCurrentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  Page {locationCurrentPage} of {totalLocationPages}
                </span>
                <button
                  onClick={() => setLocationCurrentPage(prev => Math.min(totalLocationPages, prev + 1))}
                  disabled={locationCurrentPage === totalLocationPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock in Warehouse */}
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${isStockFullscreen ? 'fixed inset-4 z-50 shadow-2xl overflow-auto' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Stock in this Warehouse ({stockLevels.length} products)
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search products..."
              value={stockSearchTerm}
              onChange={(e) => {
                setStockSearchTerm(e.target.value);
                setStockCurrentPage(1); // Reset to first page on search
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setIsStockFullscreen(!isStockFullscreen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isStockFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isStockFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Product</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">SKU</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Location</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">On Hand</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Reserved</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedStockLevels.map((level) => {
                  const available = parseFloat(level.quantityOnHand);
                  const isHighlighted = highlightProductId === level.product.id;
                  
                  return (
                    <tr 
                      key={level.id} 
                      data-product-id={level.product.id}
                      className={`hover:bg-gray-50 transition-colors ${isHighlighted ? 'bg-yellow-100 border-2 border-yellow-400' : ''}`}
                    >
                      <td className="px-4 py-2">{level.product.name}</td>
                      <td className="px-4 py-2 font-mono text-sm">{level.product.sku}</td>
                      <td className="px-4 py-2">{level.location?.name || '-'}</td>
                      <td className="px-4 py-2 text-right">{parseFloat(level.quantityOnHand).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{parseFloat(level.quantityReserved).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{available.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredStockLevels.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                {stockSearchTerm ? 'No products found matching your search' : 'No stock in this warehouse'}
              </div>
            )}
          </div>
          
          {/* Stock Pagination */}
          {filteredStockLevels.length > stockItemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((stockCurrentPage - 1) * stockItemsPerPage) + 1} to {Math.min(stockCurrentPage * stockItemsPerPage, filteredStockLevels.length)} of {filteredStockLevels.length} products
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStockCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={stockCurrentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  Page {stockCurrentPage} of {totalStockPages}
                </span>
                <button
                  onClick={() => setStockCurrentPage(prev => Math.min(totalStockPages, prev + 1))}
                  disabled={stockCurrentPage === totalStockPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
