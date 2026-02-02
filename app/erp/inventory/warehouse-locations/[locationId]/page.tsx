'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { ArrowLeft, MapPin, User, Mail, Phone, Package, Grid3x3, Image as ImageIcon, Edit2, Save, X, Pencil, Check, Maximize2, Minimize2 } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface LocationDetails {
  id: string;
  name: string;
  code: string;
  locationType: string;
  warehouseId: string;
  warehouseName: string;
  address: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerMobile: string | null;
  managerGender: string | null;
  capacity: string | null;
  currentUtilization: string | null;
  isActive: boolean;
}

interface StockItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  productDescription: string | null;
  productCostPrice: string | null;
  productSalePrice: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  binPosition: string | null;
  rackNumber: string | null;
}

export default function WarehouseLocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.locationId as string;
  const { showAlert } = useAlert();
  
  const [location, setLocation] = useState<LocationDetails | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [editingMinQty, setEditingMinQty] = useState<{ stockLevelId: string; value: string } | null>(null);
  const [savingMinQty, setSavingMinQty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    managerName: '',
    managerEmail: '',
    managerMobile: '',
    managerGender: '',
  });
  
  // Search and pagination for stock items
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Restock POs state
  const [restockPOs, setRestockPOs] = useState<any[]>([]);
  const [restockPOsPage, setRestockPOsPage] = useState(1);
  const restockPOsPerPage = 5;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('productId');
    const highlight = params.get('highlight');
    
    if (highlight) setHighlightProductId(highlight);
    if (productId) setSearchTerm(productId);
  }, []);

  useEffect(() => {
    if (locationId) {
      fetchLocationDetails();
      fetchStockItems();
      fetchRestockPOs();
    }
  }, [locationId]);

  useEffect(() => {
    if (highlightProductId && stockItems.length > 0) {
      setTimeout(() => {
        const element = document.querySelector(`[data-product-id="${highlightProductId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightProductId, stockItems]);

  const fetchLocationDetails = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/inventory/warehouse-locations/${locationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocation(data.location);
        // Initialize edit form with current values
        setEditForm({
          name: data.location.name || '',
          address: data.location.address || '',
          managerName: data.location.managerName || '',
          managerEmail: data.location.managerEmail || '',
          managerMobile: data.location.managerMobile || '',
          managerGender: data.location.managerGender || '',
        });
      } else {
        setError('Failed to fetch location details');
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockItems = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/inventory/warehouse-locations/${locationId}/stock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStockItems(data.stockItems || []);
      }
    } catch (err) {
      console.error('Error fetching stock items:', err);
    }
  };

  const fetchRestockPOs = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/inventory/warehouse-locations/${locationId}/restock-pos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRestockPOs(data.restockPOs || []);
      }
    } catch (err) {
      console.error('Error fetching restock POs:', err);
    }
  };

  const handleSaveEdit = async () => {
    const token = getAuthToken();
    setSaving(true);
    try {
      const response = await fetch(`/api/erp/inventory/warehouse-locations/${locationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      
      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Location details updated successfully' });
        setIsEditing(false);
        fetchLocationDetails();
      } else {
        const errorData = await response.json();
        showAlert({ type: 'error', title: 'Error', message: errorData.error || 'Failed to update location' });
      }
    } catch (err) {
      console.error('Error updating location:', err);
      showAlert({ type: 'error', title: 'Error', message: 'An error occurred while updating' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to current location values
    if (location) {
      setEditForm({
        name: location.name || '',
        address: location.address || '',
        managerName: location.managerName || '',
        managerEmail: location.managerEmail || '',
        managerMobile: location.managerMobile || '',
        managerGender: location.managerGender || '',
      });
    }
  };

  const toggleLocationStatus = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/inventory/warehouse-locations/${locationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !location?.isActive }),
      });
      
      if (response.ok) {
        fetchLocationDetails();
      }
    } catch (err) {
      console.error('Error toggling location status:', err);
    }
  };

  const startEditingMinQty = (stockLevelId: string, currentValue: string) => {
    setEditingMinQty({ stockLevelId, value: currentValue || '0' });
  };

  const cancelEditingMinQty = () => {
    setEditingMinQty(null);
  };

  const saveMinQty = async (stockLevelId: string) => {
    if (!editingMinQty) return;
    
    const newValue = parseFloat(editingMinQty.value);
    if (isNaN(newValue) || newValue < 0) {
      showAlert({
        message: 'Please enter a valid quantity (0 or greater)',
        type: 'error'
      });
      return;
    }

    setSavingMinQty(true);
    const token = getAuthToken();
    
    try {
      console.log('Updating stock level:', stockLevelId, 'with quantity:', newValue);
      const response = await fetch(`/api/erp/inventory/stock-levels/${stockLevelId}/reserved`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantityReserved: newValue }),
      });

      const data = await response.json();
      console.log('API response:', data);

      if (response.ok) {
        showAlert({
          message: 'Min quantity updated successfully',
          type: 'success'
        });
        setEditingMinQty(null);
        // Wait a bit before refetching to ensure DB commit
        await new Promise(resolve => setTimeout(resolve, 300));
        // Refetch to ensure data persists
        await fetchStockItems();
      } else {
        showAlert({
          message: data.error || data.message || 'Failed to update min quantity',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Error updating min quantity:', err);
      showAlert({
        message: 'Failed to update min quantity',
        type: 'error'
      });
    } finally {
      setSavingMinQty(false);
    }
  };

  // Filter and paginate stock items
  const filteredStockItems = stockItems.filter(item =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productId === searchTerm ||
    (item.binPosition && item.binPosition.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const totalPages = Math.ceil(filteredStockItems.length / itemsPerPage);
  const paginatedStockItems = filteredStockItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading location details...</div>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error || 'Location not found'}</div>
      </div>
    );
  }

  const utilizationPercentage = parseFloat(location.currentUtilization || '0');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Warehouse</span>
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{location.name}</h1>
            <p className="text-gray-500 mt-1">
              Code: {location.code} • Warehouse: {location.warehouseName}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 capitalize">
                {location.locationType || 'General'}
              </span>
              <button
                onClick={toggleLocationStatus}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  location.isActive
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                }`}
              >
                {location.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Utilization</div>
              <div className="text-2xl font-bold text-blue-700">{utilizationPercentage.toFixed(1)}%</div>
            </div>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 size={18} />
                <span>Edit Details</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editable Location Name */}
      {isEditing && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Edit2 size={20} className="text-yellow-600" />
            Edit Location Name
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter location name"
            />
          </div>
        </div>
      )}

      {/* Address Card - Editable */}
      {(location.address || isEditing) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-green-600" />
            Location Address
          </h2>
          {isEditing ? (
            <textarea
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter location address"
            />
          ) : (
            <p className="text-gray-700">{location.address || 'No address set'}</p>
          )}
        </div>
      )}

      {/* Location Manager Card - Editable */}
      {(location.managerName || isEditing) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            Location Manager
          </h2>
          
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager Name</label>
                <input
                  type="text"
                  value={editForm.managerName}
                  onChange={(e) => setEditForm({ ...editForm, managerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter manager name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager Email</label>
                <input
                  type="email"
                  value={editForm.managerEmail}
                  onChange={(e) => setEditForm({ ...editForm, managerEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="manager@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager Mobile</label>
                <input
                  type="tel"
                  value={editForm.managerMobile}
                  onChange={(e) => setEditForm({ ...editForm, managerMobile: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager Gender</label>
                <select
                  value={editForm.managerGender}
                  onChange={(e) => setEditForm({ ...editForm, managerGender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Name</div>
                <div className="font-medium text-gray-900">{location.managerName || '-'}</div>
              </div>
              
              {location.managerEmail && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail size={14} /> Email
                  </div>
                  <div className="font-medium text-gray-900">{location.managerEmail}</div>
                </div>
              )}
              
              {location.managerMobile && (
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={14} /> Mobile
                  </div>
                  <div className="font-medium text-gray-900">{location.managerMobile}</div>
                </div>
              )}
              
              {location.managerGender && (
                <div>
                  <div className="text-sm text-gray-500">Gender</div>
                  <div className="font-medium text-gray-900">{location.managerGender}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Capacity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-1">Total Capacity</div>
          <div className="text-2xl font-bold text-gray-900">
            {location.capacity ? parseFloat(location.capacity).toLocaleString() : 'N/A'}
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-1">Current Usage</div>
          <div className="text-2xl font-bold text-blue-600">
            {location.currentUtilization ? parseFloat(location.currentUtilization).toLocaleString() : '0'}
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-1">Items Stored</div>
          <div className="text-2xl font-bold text-green-600">{stockItems.length}</div>
        </div>
      </div>

      {/* Stock Items */}
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl overflow-auto' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            {location.locationType === 'bin' && 'Bin Storage View'}
            {location.locationType === 'aisle' && 'Aisle Layout View'}
            {location.locationType === 'rack' && 'Rack Storage View'}
            {location.locationType === 'shelf' && 'Shelf Organization View'}
            {!location.locationType && 'Stored Items'}
            <span className="text-sm text-gray-500 font-normal">({stockItems.length} items)</span>
          </h2>
          
          <div className="flex items-center gap-2">
            {stockItems.length > 0 && (
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {filteredStockItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'No items found matching your search' : 'No items currently stored in this location'}
          </div>
        ) : (
          <>
            {/* Bin View - Grid of Visual Cards */}
            {location.locationType === 'bin' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {paginatedStockItems.map((item) => {
    const isHighlighted = highlightProductId === item.productId;
    return (
      <div 
        key={item.id} 
        data-product-id={item.productId}
        className={`border rounded-lg p-4 hover:shadow-md transition-all ${isHighlighted ? 'border-yellow-400 border-2 bg-yellow-50 shadow-lg' : 'border-gray-200'}`}
      >
        <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
          {item.productImage ? (
            <img 
              src={item.productImage} 
              alt={item.productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon size={48} className="text-gray-400" />
          )}
        </div>
        
        <div className="space-y-2">
          <div className="font-semibold text-gray-900 truncate" title={item.productName}>
            {item.productName}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">SKU:</span>
            <span className="font-mono font-medium text-gray-900">{item.productSku}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Quantity:</span>
            <span className="font-bold text-green-600">{parseFloat(item.quantityOnHand).toLocaleString()}</span>
          </div>
          
          {item.binPosition && (
            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <Grid3x3 size={12} />
              <span>Bin: {item.binPosition}</span>
            </div>
          )}
          
          {item.rackNumber && (
            <div className="text-xs text-gray-600">
              Rack: {item.rackNumber}
            </div>
          )}
        </div>
      </div>
    );
  })}
</div>
            )}

            {/* Aisle View - Linear Layout with Position Numbers */}
            {location.locationType === 'aisle' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <MapPin size={16} />
                  <span>Items arranged linearly along aisle path</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {stockItems.map((item, idx) => {
                    const isHighlighted = highlightProductId === item.productId;
                    return (
                    <div 
                      key={item.id}
                      data-product-id={item.productId}
                      className={`flex items-center gap-4 p-4 border rounded-lg transition-colors group ${isHighlighted ? 'border-yellow-400 border-2 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs text-blue-600 font-medium">Pos</div>
                          <div className="text-lg font-bold text-blue-800">{idx + 1}</div>
                        </div>
                      </div>
                      
                      {item.productImage ? (
                        <img 
                          src={item.productImage} 
                          alt={item.productName}
                          className="w-16 h-16 rounded object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                          <Package size={24} className="text-gray-400" />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.productName}</div>
                        <div className="text-sm text-gray-500">SKU: {item.productSku}</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Stock</div>
                        <div className="text-xl font-bold text-green-600">
                          {parseFloat(item.quantityOnHand).toLocaleString()}
                        </div>
                      </div>
                      
                      {item.binPosition && (
                        <div className="flex flex-col items-start gap-1">
  <div className="px-3 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
    Bin {item.binPosition}
  </div>
  <div className="text-xs text-gray-600 flex items-center gap-1">
    Min:
    {editingMinQty && editingMinQty.stockLevelId === item.id ? (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={editingMinQty.value}
          onChange={(e) => setEditingMinQty({ ...editingMinQty, value: e.target.value })}
          className="w-16 px-1 py-0.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          min="0"
          step="1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveMinQty(item.id);
            if (e.key === 'Escape') cancelEditingMinQty();
          }}
        />
        <button
          onClick={() => saveMinQty(item.id)}
          disabled={savingMinQty}
          className="p-0.5 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
          title="Save"
        >
          <Check size={12} />
        </button>
        <button
          onClick={cancelEditingMinQty}
          disabled={savingMinQty}
          className="p-0.5 hover:bg-red-100 rounded text-red-600"
          title="Cancel"
        >
          <X size={12} />
        </button>
      </div>
    ) : (
      <>
        <span className="font-semibold text-yellow-700">{parseFloat(item.quantityReserved || '0').toLocaleString()}</span>
        <button
          onClick={() => startEditingMinQty(item.id, item.quantityReserved || '0')}
          className="p-0.5 hover:bg-blue-100 rounded text-blue-600"
          title="Edit Min Quantity"
        >
          <Pencil size={10} />
        </button>
      </>
    )}
  </div>
</div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {/* Rack View - 10 Columns, 3 Items Per Column */}
            {location.locationType === 'rack' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Grid3x3 size={16} />
                  <span>Items organized in rack positions (10 columns × 3 items = 30 items per rack)</span>
                </div>
                
                {/* Group by rack number */}
                {(() => {
                  const groupedByRack: { [key: string]: StockItem[] } = {};
                  paginatedStockItems.forEach(item => {
                    const rackKey = item.rackNumber || 'Unassigned';
                    if (!groupedByRack[rackKey]) groupedByRack[rackKey] = [];
                    groupedByRack[rackKey].push(item);
                  });

                  return Object.entries(groupedByRack).map(([rackNum, items]) => (
                    <div key={rackNum} className="border-2 border-indigo-300 rounded-lg p-4 bg-gradient-to-r from-indigo-50 to-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-indigo-600 text-white rounded font-semibold">
                            Rack {rackNum}
                          </div>
                          <div className="text-sm text-gray-500">
                            {items.length}/30 slots filled
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          10 columns × 3 items each
                        </div>
                      </div>
                      
                      {/* 10 Column Grid - Each column can hold 3 items */}
                      <div className="grid grid-cols-10 gap-2">
                        {Array.from({ length: 10 }).map((_, colIdx) => (
                          <div key={colIdx} className="border-2 border-gray-300 rounded-lg p-2 bg-white">
                            <div className="text-xs font-semibold text-center mb-2 text-gray-600">
                              Col {colIdx + 1}
                            </div>
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, rowIdx) => {
                                const itemIndex = colIdx * 3 + rowIdx;
                                const item = items[itemIndex];
                                return (
                                  <div key={rowIdx} className="border border-gray-200 rounded p-1 min-h-[60px] flex items-center justify-center relative group">
                                    {item ? (
                                      <>
                                        <div className="text-center">
                                          {item.productImage ? (
                                            <img 
                                              src={item.productImage} 
                                              alt={item.productName}
                                              className="w-10 h-10 mx-auto rounded object-cover mb-1"
                                            />
                                          ) : (
                                            <Package size={16} className="mx-auto text-gray-400 mb-1" />
                                          )}
                                          <div className="text-[8px] font-medium truncate" title={item.productName}>
                                            {item.productName.substring(0, 10)}
                                          </div>
                                          <div className="text-[7px] text-gray-500">{item.productSku}</div>
                                          <div className="text-[8px] font-bold text-green-600">
                                            {parseFloat(item.quantityOnHand).toFixed(0)}
                                          </div>
                                        </div>
                                        
                                        {/* Tooltip with product details and min qty */}
                                        <div className="hidden group-hover:block absolute z-50 left-full ml-2 top-0 w-64 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3">
                                          <div className="flex gap-3">
                                            {item.productImage ? (
                                              <img 
                                                src={item.productImage} 
                                                alt={item.productName}
                                                className="w-20 h-20 rounded object-cover flex-shrink-0"
                                              />
                                            ) : (
                                              <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                                <Package size={32} className="text-gray-400" />
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="font-bold text-gray-900 text-sm mb-1">{item.productName}</div>
                                              <div className="text-xs text-gray-600 space-y-1">
                                                <div><span className="font-medium">SKU:</span> {item.productSku}</div>
                                                {item.productDescription && (
                                                  <div className="text-[10px] text-gray-500 line-clamp-2">{item.productDescription}</div>
                                                )}
                                                <div className="pt-1 border-t border-gray-200 space-y-0.5">
                                                  <div><span className="font-medium">Stock:</span> <span className="text-green-600 font-bold">{parseFloat(item.quantityOnHand).toLocaleString()}</span></div>
                                                  <div><span className="font-medium">Min Qty (Reserved):</span> <span className="text-yellow-700 font-bold">{parseFloat(item.quantityReserved || '0').toLocaleString()}</span></div>
                                                  {item.productCostPrice && (
                                                    <div><span className="font-medium">Cost:</span> ₹{parseFloat(item.productCostPrice).toLocaleString()}</div>
                                                  )}
                                                  {item.productSalePrice && (
                                                    <div><span className="font-medium">Sale:</span> ₹{parseFloat(item.productSalePrice).toLocaleString()}</div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          {/* Arrow pointing to the rack item */}
                                          <div className="absolute right-full top-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-gray-300"></div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-[10px] text-gray-400 text-center">Empty</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Shelf View - Stacked Layout */}
            {location.locationType === 'shelf' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Package size={16} />
                  <span>Items stacked on shelves</span>
                </div>
                
                {paginatedStockItems.map((item, idx) => {
                  const isHighlighted = highlightProductId === item.productId;
                  return (
                  <div 
                    key={item.id}
                    data-product-id={item.productId}
                    className={`relative border-2 rounded-lg p-4 hover:border-blue-400 transition-all group ${isHighlighted ? 'border-yellow-400 bg-yellow-100' : 'border-gray-300'}`}
                    style={{ 
                      background: isHighlighted ? undefined : `linear-gradient(to bottom, ${idx % 2 === 0 ? '#f9fafb' : '#ffffff'} 0%, ${idx % 2 === 0 ? '#f3f4f6' : '#f9fafb'} 100%)`
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-700">{idx + 1}</div>
                        </div>
                      </div>
                      
                      {item.productImage ? (
                        <img 
                          src={item.productImage} 
                          alt={item.productName}
                          className="w-20 h-20 rounded-lg object-cover shadow-sm"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shadow-sm border-2 border-gray-200">
                          <Package size={32} className="text-gray-400" />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">{item.productName}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600">SKU: <span className="font-mono font-medium">{item.productSku}</span></span>
                          <span className="text-sm text-gray-600 flex items-center gap-2">
                            Min Qty: 
                            {editingMinQty && editingMinQty.stockLevelId === item.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editingMinQty.value}
                                  onChange={(e) => setEditingMinQty({ ...editingMinQty, value: e.target.value })}
                                  className="w-20 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                  min="0"
                                  step="1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveMinQty(item.id);
                                    if (e.key === 'Escape') cancelEditingMinQty();
                                  }}
                                />
                                <button
                                  onClick={() => saveMinQty(item.id)}
                                  disabled={savingMinQty}
                                  className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={cancelEditingMinQty}
                                  disabled={savingMinQty}
                                  className="p-1 hover:bg-red-100 rounded text-red-600"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-yellow-700">{parseFloat(item.quantityReserved || '0').toLocaleString()}</span>
                                <button
                                  onClick={() => startEditingMinQty(item.id, item.quantityReserved || '0')}
                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                  title="Edit Min Quantity"
                                >
                                  <Pencil size={12} />
                                </button>
                              </>
                            )}
                          </span>
                          {item.binPosition && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              Bin {item.binPosition}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-xs text-gray-500 uppercase">In Stock</div>
                        <div className="text-2xl font-bold text-green-600">
                          {parseFloat(item.quantityOnHand).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Default Table View for Zone and other types */}
            {(!location.locationType || (location.locationType !== 'bin' && location.locationType !== 'aisle' && location.locationType !== 'rack' && location.locationType !== 'shelf')) && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">SKU</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Min Qty (Reserved)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedStockItems.map((item) => {
                      const isHighlighted = highlightProductId === item.productId;
                      return (
                      <tr 
                        key={item.id} 
                        data-product-id={item.productId}
                        className={`transition-all group ${isHighlighted ? 'bg-yellow-100 border-2 border-yellow-400' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.productImage ? (
                              <img 
                                src={item.productImage} 
                                alt={item.productName}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                <Package size={20} className="text-gray-400" />
                              </div>
                            )}
                            <div className="font-medium text-gray-900">{item.productName}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-600">{item.productSku}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {parseFloat(item.quantityOnHand).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingMinQty && editingMinQty.stockLevelId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editingMinQty.value}
                                onChange={(e) => setEditingMinQty({ ...editingMinQty, value: e.target.value })}
                                className="w-20 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                step="1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveMinQty(item.id);
                                  if (e.key === 'Escape') cancelEditingMinQty();
                                }}
                              />
                              <button
                                onClick={() => saveMinQty(item.id)}
                                disabled={savingMinQty}
                                className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
                                title="Save"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={cancelEditingMinQty}
                                disabled={savingMinQty}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-medium">
                                {parseFloat(item.quantityReserved || '0').toLocaleString()}
                              </span>
                              <button
                                onClick={() => startEditingMinQty(item.id, item.quantityReserved || '0')}
                                className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                title="Edit Min Quantity"
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.binPosition && `Bin: ${item.binPosition}`}
                          {item.rackNumber && (item.binPosition ? `, Rack: ${item.rackNumber}` : `Rack: ${item.rackNumber}`)}
                          {!item.binPosition && !item.rackNumber && '-'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        
        {/* Pagination */}
        {filteredStockItems.length > itemsPerPage && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredStockItems.length)} of {filteredStockItems.length} items
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

      {/* Restock Purchase Orders Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package size={20} />
          Restock Purchase Orders for this Location
        </h2>
        
        {restockPOs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No restock purchase orders found for this location
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PO Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity Coming In
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {restockPOs.slice((restockPOsPage - 1) * restockPOsPerPage, restockPOsPage * restockPOsPerPage).map((po: any) => (
                    <tr key={po.po_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-blue-600">{po.po_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{po.supplier_name || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          po.po_status === 'approved' || po.po_status === 'received' ? 'bg-green-100 text-green-800' :
                          po.po_status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          po.po_status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {po.po_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-green-600">
                          {parseFloat(po.total_quantity || 0).toLocaleString()} units
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination for Restock POs */}
            {restockPOs.length > restockPOsPerPage && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((restockPOsPage - 1) * restockPOsPerPage) + 1} to {Math.min(restockPOsPage * restockPOsPerPage, restockPOs.length)} of {restockPOs.length} orders
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRestockPOsPage(prev => Math.max(1, prev - 1))}
                    disabled={restockPOsPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-700">
                    Page {restockPOsPage} of {Math.ceil(restockPOs.length / restockPOsPerPage)}
                  </span>
                  <button
                    onClick={() => setRestockPOsPage(prev => Math.min(Math.ceil(restockPOs.length / restockPOsPerPage), prev + 1))}
                    disabled={restockPOsPage === Math.ceil(restockPOs.length / restockPOsPerPage)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
