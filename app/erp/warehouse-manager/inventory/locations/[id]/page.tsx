'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Package, Edit } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Location {
  id: string;
  name: string;
  code: string;
  location_type: string;
  address: string | null;
  capacity: number | null;
  manager_name: string | null;
  manager_email: string | null;
  manager_mobile: string | null;
  is_active: boolean;
  warehouse_id: string;
  warehouse_name: string;
}

interface StockLevel {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_on_hand: number;
  quantity_allocated: number;
  quantity_available: number;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export default function LocationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.id as string;
  const [location, setLocation] = useState<Location | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (locationId) {
      fetchLocationDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const fetchLocationDetails = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/warehouse-manager/inventory/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLocation(data.location);
        setStockLevels(data.stockLevels || []);
        
        // Fetch warehouse details
        if (data.location?.warehouse_id) {
          fetchWarehouse(data.location.warehouse_id, token);
        }
      } else if (response.status === 403) {
        router.push('/login');
      } else {
        router.push('/erp/warehouse-manager/inventory/warehouses');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouse = async (warehouseId: string, token: string) => {
    try {
      const response = await fetch(`/api/warehouse-manager/inventory/warehouses/${warehouseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouse(data.warehouse);
      }
    } catch (error) {
      console.error('Error fetching warehouse:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!location) return;
    
    const token = getAuthToken();
    if (!token) return;

    try {
      const newStatus = !location.is_active;
      const response = await fetch(`/api/warehouse-manager/inventory/locations/${location.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (response.ok) {
        setLocation({ ...location, is_active: newStatus });
        showAlert({ 
          type: 'success', 
          title: 'Success', 
          message: `Location ${newStatus ? 'activated' : 'deactivated'} successfully` 
        });

        // Check if we need to update warehouse status
        await checkWarehouseStatus(token, location.warehouse_id, newStatus);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to update location status' });
      }
    } catch (error) {
      console.error('Error toggling location status:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to toggle location status' });
    }
  };

  const checkWarehouseStatus = async (token: string, warehouseId: string, newLocationStatus: boolean) => {
    try {
      // Fetch all locations for this warehouse
      const response = await fetch(`/api/warehouse-manager/inventory/warehouses/${warehouseId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const locations = data.locations || [];
        
        const allInactive = locations.every((loc: any) => loc.id === location?.id ? !newLocationStatus : !loc.is_active);
        const anyActive = locations.some((loc: any) => loc.id === location?.id ? newLocationStatus : loc.is_active);

        if (allInactive && warehouse?.is_active) {
          // Deactivate warehouse
          await fetch(`/api/warehouse-manager/inventory/warehouses/${warehouseId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isActive: false }),
          });
          setWarehouse({ ...warehouse, is_active: false });
          showAlert({ 
            type: 'warning', 
            title: 'Warehouse Deactivated', 
            message: 'All locations are inactive. Warehouse has been deactivated.' 
          });
        } else if (anyActive && warehouse && !warehouse.is_active) {
          // Activate warehouse
          await fetch(`/api/warehouse-manager/inventory/warehouses/${warehouseId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isActive: true }),
          });
          setWarehouse({ ...warehouse, is_active: true });
          showAlert({ 
            type: 'success', 
            title: 'Warehouse Activated', 
            message: 'Warehouse activated because at least one location is active.' 
          });
        }
      }
    } catch (error) {
      console.error('Error checking warehouse status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Location not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/erp/warehouse-manager/inventory/warehouses')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStatus}
            className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              location.is_active
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            {location.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      {/* Location Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <MapPin className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-gray-900">{location.name}</h1>
              <p className="text-gray-600 font-mono text-sm mt-1">{location.code}</p>
              {warehouse && (
                <p className="text-sm text-gray-500 mt-1">
                  Warehouse: <span className="font-medium">{warehouse.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Type</p>
              <p className="font-medium capitalize">{location.location_type || 'General'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Capacity</p>
              <p className="font-medium">{location.capacity || 'Unlimited'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Manager</p>
              <p className="font-medium">{location.manager_name || 'Not Assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Contact Email</p>
              <p className="font-medium text-sm">{location.manager_email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Mobile</p>
              <p className="font-medium">{location.manager_mobile || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                location.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {location.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {location.address && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600 mb-1">Address</p>
                <p className="font-medium">{location.address}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Levels Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Stock Levels</h2>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
              {stockLevels.length} Products
            </span>
          </div>
        </div>
        <div className="p-6">
          {stockLevels.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No stock in this location</p>
              <p className="text-sm text-gray-400 mt-2">Stock will appear here when products are added to this location</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">On Hand</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Reserved</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLevels.map((stock) => (
                    <tr key={stock.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{stock.product_name}</td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-600">{stock.product_sku}</td>
                      <td className="py-3 px-4 text-right font-medium">{stock.quantity_on_hand}</td>
                      <td className="py-3 px-4 text-right text-orange-600 font-medium">{stock.quantity_allocated}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">
                        {stock.quantity_available}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
