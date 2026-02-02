'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ChevronDown, Plus } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Location {
  id: string;
  name: string;
  code: string;
  locationType: string;
  isActive: boolean;
  managerName?: string;
  managerEmail?: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  locations?: Location[];
}

export default function WarehouseManagerWarehousesPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocationForm, setShowAddLocationForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    locationType: 'shelf',
    managerName: '',
    managerEmail: '',
    managerAddress: '',
    managerMobile: '',
    managerGender: '',
  });
  const [expandedWarehouse, setExpandedWarehouse] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    fetchWarehouseAndLocations();
  }, []);
  const generateLocationCode = async () => {
    if (!formData.name) {
      showAlert({ type: 'error', title: 'Error', message: 'Please enter location name first' });
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    setGeneratingCode(true);
    try {
      const response = await fetch('/api/warehouse-manager/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'location',
          locationName: formData.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, code: data.code });
      }
    } catch (error) {
      console.error('Error generating code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };
  const fetchWarehouseAndLocations = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('/api/warehouse-manager/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.warehouse) {
          setWarehouse(data.warehouse);
          const mappedLocations = (data.locations || []).map((loc: any) => ({
            ...loc,
            locationType: loc.location_type || loc.locationType,
            isActive: loc.is_active !== undefined ? loc.is_active : loc.isActive,
            managerName: loc.manager_name || loc.managerName,
            managerEmail: loc.manager_email || loc.managerEmail
          }));
          setLocations(mappedLocations);
        }
      }
    } catch (error) {
      console.error('Error fetching warehouse:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token || !warehouse) return;

    try {
      const response = await fetch(`/api/warehouse-manager/inventory/warehouses/${warehouse.id}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Location added successfully!' });
        setShowAddLocationForm(false);
        setFormData({
          name: '',
          code: '',
          locationType: 'shelf',
          managerName: '',
          managerEmail: '',
          managerAddress: '',
          managerMobile: '',
          managerGender: '',
        });
        fetchWarehouseAndLocations();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to add location' });
      }
    } catch (error) {
      console.error('Error adding location:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to add location' });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Loading warehouse...</p>
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">No warehouse assigned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Warehouse & Locations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage locations within your warehouse</p>
        </div>
        <button
          onClick={() => setShowAddLocationForm(!showAddLocationForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {showAddLocationForm ? 'Cancel' : 'Add Location'}
        </button>
      </div>

      {/* Add Location Form */}
      {showAddLocationForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Location</h3>
          <form onSubmit={handleAddLocation} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Location Name*</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location Code*</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    placeholder="Enter code or generate"
                  />
                  <button
                    type="button"
                    onClick={generateLocationCode}
                    disabled={generatingCode}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 whitespace-nowrap"
                  >
                    {generatingCode ? 'Generating...' : 'Auto Generate'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location Type*</label>
                <select
                  required
                  value={formData.locationType}
                  onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="shelf">Shelf</option>
                  <option value="bin">Bin</option>
                  <option value="zone">Zone</option>
                  <option value="room">Room</option>
                </select>
              </div>
            </div>

            <h4 className="text-md font-semibold mt-6 mb-3">Location Manager (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Manager Name</label>
                <input
                  type="text"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Manager Email</label>
                <input
                  type="email"
                  value={formData.managerEmail}
                  onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Manager Mobile</label>
                <input
                  type="tel"
                  value={formData.managerMobile}
                  onChange={(e) => setFormData({ ...formData, managerMobile: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Manager Gender</label>
                <select
                  value={formData.managerGender}
                  onChange={(e) => setFormData({ ...formData, managerGender: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Location
              </button>
              <button
                type="button"
                onClick={() => setShowAddLocationForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Warehouse Card with Locations */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Warehouse Header */}
        <div 
          className="p-6 border-b border-gray-200 bg-blue-50 cursor-pointer flex justify-between items-center hover:bg-blue-100 transition-colors"
          onClick={() => setExpandedWarehouse(!expandedWarehouse)}
        >
          <div>
            <h2 className="text-xl font-bold text-gray-900">{warehouse.name}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {warehouse.code} • {warehouse.address}, {warehouse.city}, {warehouse.state}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {locations.length} location{locations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <ChevronDown 
            className={`w-6 h-6 text-gray-600 transition-transform ${expandedWarehouse ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Locations Table */}
        {expandedWarehouse && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Locations</h3>
            {locations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No locations found. Add a location to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead>Location Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow 
                      key={location.id} 
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/erp/warehouse-manager/inventory/locations/${location.id}`)}
                    >
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {location.code}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">{location.locationType}</TableCell>
                      <TableCell>
                        {location.managerName || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${location.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {location.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
