'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { Plus, Trash2, Edit, Copy, Eye } from 'lucide-react';
import BOMFormModal from '@/components/modal/BOMFormModal';
import BOMViewModal from '@/components/modal/BOMViewModal';
import BOMEditModal from '@/components/modal/BOMEditModal';
import { useAlert } from '@/components/common/CustomAlert';
import React from 'react';

interface BOM {
  id: string;
  bomNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  version: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  scrapPercentage: string;
  notes: string;
  createdAt: string;
}

export default function BOMPage() {
  const { showAlert, showConfirm } = useAlert();
  const [boms, setBOMs] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [bomDetails, setBomDetails] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<any>(null);

  useEffect(() => {
    fetchBOMs();
  }, []);

  const fetchBOMs = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const response = await fetch('/api/erp/manufacturing/bom', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBOMs(data.boms || []);
      }
    } catch (error) {
      console.error('Error fetching BOMs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (bomId: string) => {
    if (expandedRow === bomId) {
      setExpandedRow(null);
      setBomDetails(null);
    } else {
      setExpandedRow(bomId);
      await fetchBOMDetails(bomId);
    }
  };

  const fetchBOMDetails = async (bomId: string) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/manufacturing/bom/${bomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBomDetails(data);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
    }
  };

  const handleView = async (bom: BOM) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/manufacturing/bom/${bom.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedBOM(data);
        setShowViewModal(true);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load BOM details' });
    }
  };

  const handleEdit = async (bom: BOM) => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/manufacturing/bom/${bom.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedBOM(data);
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load BOM details' });
    }
  };

  const handleDelete = async (bomId: string) => {
    showConfirm({
      title: 'Delete BOM',
      message: 'Are you sure you want to delete this BOM? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const token = getAuthToken();
        try {
          const response = await fetch(`/api/erp/manufacturing/bom/${bomId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            showAlert({ type: 'success', title: 'Success', message: 'BOM deleted successfully' });
            fetchBOMs();
          } else {
            showAlert({ type: 'error', title: 'Error', message: 'Failed to delete BOM' });
          }
        } catch (error) {
          console.error('Error deleting BOM:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to delete BOM' });
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
          <div className="text-gray-600">Loading BOMs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill of Materials (BOM)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage product manufacturing recipes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Create BOM
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total BOMs</div>
          <div className="text-3xl font-bold text-gray-900">{boms.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Active BOMs</div>
          <div className="text-3xl font-bold text-green-600">
            {boms.filter(b => b.status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Multi-Level</div>
          <div className="text-3xl font-bold text-blue-600">
            {boms.filter(b => bomDetails?.lines?.some((l: any) => l.component?.hasBom)).length}
          </div>
        </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
  <div className="text-sm font-medium text-gray-600 mb-2">Avg Scrap %</div>
  <div className="text-3xl font-bold text-yellow-600">
    {boms.length > 0 ? (boms.reduce((sum, b) => sum + (Number(b.scrapPercentage) || 0), 0) / boms.length).toFixed(1) : 0}%
  </div>
</div>
      </div>

      {/* BOM Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">BOM #</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Version</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Effective From</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Scrap %</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {boms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No BOMs found. Create your first BOM to get started.
                  </td>
                </tr>
              ) : (
                boms.map((bom) => (
                 <React.Fragment key={bom.id}>
                    <tr key={bom.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(bom.id)}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{expandedRow === bom.id ? '▼' : '▶'}</span>
                          {bom.bomNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{bom.productName}</div>
                        <div className="text-sm text-gray-500">{bom.productSku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">v{bom.version}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(bom.effectiveFrom).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                        {bom.scrapPercentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          bom.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {bom.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleView(bom)}
                            className="text-blue-600 hover:text-blue-800 font-medium" 
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleEdit(bom)}
                            className="text-green-600 hover:text-green-800 font-medium" 
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(bom.id)}
                            className="text-red-600 hover:text-red-800 font-medium" 
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === bom.id && bomDetails && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-gray-500">Effective To</div>
                                <div className="text-sm font-medium">{bomDetails.effectiveTo ? new Date(bomDetails.effectiveTo).toLocaleDateString('en-IN') : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Notes</div>
                                <div className="text-sm font-medium">{bomDetails.notes || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Components</div>
                                <div className="text-sm font-medium">{bomDetails.components?.length || 0}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Created</div>
                                <div className="text-sm font-medium">{new Date(bomDetails.createdAt).toLocaleString('en-IN')}</div>
                              </div>
                            </div>
                            {bomDetails.components && bomDetails.components.length > 0 ? (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold">Component</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Quantity</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">UOM</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold">Scrap %</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold">Type</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {bomDetails.components.map((comp: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-sm">
                                        <div className="font-medium">{comp.componentName || 'N/A'}</div>
                                        <div className="text-xs text-gray-500">{comp.componentSku}</div>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right">{parseFloat(comp.quantity).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-right">{comp.uom || 'Units'}</td>
                                      <td className="px-4 py-2 text-sm text-right">{comp.scrapPercentage || 0}%</td>
                                      <td className="px-4 py-2 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          comp.componentType === 'raw_material' ? 'bg-blue-100 text-blue-800' :
                                          comp.componentType === 'semi_finished' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {comp.componentType?.replace('_', ' ').toUpperCase()}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                No components added yet. Click Edit to add components.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOM Creation Modal */}
      <BOMFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchBOMs}
      />

      {/* BOM View Modal */}
      <BOMViewModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedBOM(null);
        }}
        bom={selectedBOM}
      />

      {/* BOM Edit Modal */}
      <BOMEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedBOM(null);
        }}
        onSuccess={async () => {
          const bomIdToRefresh = selectedBOM?.id;
          await fetchBOMs();
          if (expandedRow && bomIdToRefresh) {
            await fetchBOMDetails(bomIdToRefresh);
          }
          setShowEditModal(false);
          setSelectedBOM(null);
        }}
        bom={selectedBOM}
      />
    </div>
  );
}
