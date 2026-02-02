"use client";
import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import QualityCheckFormModal from '@/components/modal/QualityCheckFormModal';

interface QualityCheck {
  id: string;
  qcNumber: string;
  inspectionType: 'incoming' | 'in_process' | 'finished_goods';
  productId: string;
  product: {
    name: string;
    sku: string;
  };
  batchNumber: string;
  quantityChecked: number;
  quantityPassed: number;
  quantityFailed: number;
  quantityRework: number;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'partial';
  inspectorId: string | null;
  checkDate: string;
  sourceReference: string;
  notes: string;
  createdAt: string;
}

interface QCDetails {
  qualityCheck: QualityCheck;
  checkpoints: Array<{
    id: string;
    parameter: string;
    specification: string;
    actualValue: string;
    result: 'pass' | 'fail';
    notes: string;
  }>;
  defects: Array<{
    id: string;
    defectType: string;
    severity: 'critical' | 'major' | 'minor';
    quantity: number;
    action: 'reject' | 'rework' | 'accept_deviation';
    description: string;
  }>;
}

export default function QualityControlPage() {
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [qcDetails, setQcDetails] = useState<QCDetails | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchQualityChecks();
  }, []);

  const fetchQualityChecks = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const res = await fetch('/api/erp/manufacturing/quality', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch quality checks');
      const data = await res.json();
      setQualityChecks(data.qualityChecks || []);
    } catch (error) {
      console.error('Error fetching quality checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (qcId: string) => {
    if (expandedRow === qcId) {
      setExpandedRow(null);
      setQcDetails(null);
    } else {
      setExpandedRow(qcId);
      await fetchQCDetails(qcId);
    }
  };

  const fetchQCDetails = async (qcId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/erp/manufacturing/quality/${qcId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch QC details');
      const data = await res.json();
      setQcDetails(data);
    } catch (error) {
      console.error('Error fetching QC details:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      partial: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      incoming: 'bg-blue-100 text-blue-800',
      in_process: 'bg-purple-100 text-purple-800',
      finished_goods: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      major: 'bg-orange-100 text-orange-800',
      minor: 'bg-yellow-100 text-yellow-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const filteredChecks = filterType === 'all' 
    ? qualityChecks 
    : qualityChecks.filter(qc => qc.inspectionType === filterType);

  const stats = {
    total: qualityChecks.length,
    passed: qualityChecks.filter(qc => qc.status === 'passed').length,
    failed: qualityChecks.filter(qc => qc.status === 'failed').length,
    pending: qualityChecks.filter(qc => qc.status === 'pending' || qc.status === 'in_progress').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Quality Control</h2>
          <p className="text-sm text-gray-500 mt-1">Inspection results and quality assurance tracking</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Create QC Check
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Checks</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Passed</div>
          <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Failed</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="incoming">Incoming</option>
          <option value="in_process">In Process</option>
          <option value="finished_goods">Finished Goods</option>
        </select>
      </div>

      {/* Quality Checks Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Quality Checks</h3>
          <div className="text-sm text-gray-600">
            Showing {filteredChecks.length} checks
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading quality checks...
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No quality checks found. Create your first quality check.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">QC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Checked</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Passed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredChecks.map((qc) => (
                  <React.Fragment key={qc.id}>
                    <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(qc.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <div className="flex items-center gap-2">
                          <span>{expandedRow === qc.id ? '▼' : '▶'}</span>
                          {qc.qcNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(qc.inspectionType)}`}>
                          {qc.inspectionType ? qc.inspectionType.replace('_', ' ') : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {qc.product?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{qc.batchNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{qc.quantityChecked}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{qc.quantityPassed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">{qc.quantityFailed}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(qc.status)}`}>
                          {qc.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="text-gray-500 text-xs">Click to expand</span>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedRow === qc.id && qcDetails && (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-gray-500">Check Date</div>
                                <div className="text-sm font-medium">{new Date(qc.checkDate).toLocaleDateString()}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Source Reference</div>
                                <div className="text-sm font-medium">{qc.sourceReference || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Rework</div>
                                <div className="text-sm font-medium">{qc.quantityRework || 0}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Notes</div>
                                <div className="text-sm font-medium">{qc.notes || 'N/A'}</div>
                              </div>
                            </div>

                            {/* Checkpoints */}
                            {qcDetails.checkpoints && qcDetails.checkpoints.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Checkpoints</h4>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="min-w-full">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Parameter</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Specification</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Actual Value</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Result</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y bg-white">
                                      {qcDetails.checkpoints.map((cp) => (
                                        <tr key={cp.id}>
                                          <td className="px-4 py-2 text-sm">{cp.parameter}</td>
                                          <td className="px-4 py-2 text-sm">{cp.specification}</td>
                                          <td className="px-4 py-2 text-sm">{cp.actualValue}</td>
                                          <td className="px-4 py-2 text-sm">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${cp.result === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                              {cp.result}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-sm">{cp.notes || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Defects */}
                            {qcDetails.defects && qcDetails.defects.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Defects</h4>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="min-w-full">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Type</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Severity</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Quantity</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Action</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y bg-white">
                                      {qcDetails.defects.map((def) => (
                                        <tr key={def.id}>
                                          <td className="px-4 py-2 text-sm">{def.defectType}</td>
                                          <td className="px-4 py-2 text-sm">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(def.severity)}`}>
                                              {def.severity}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-sm">{def.quantity}</td>
                                          <td className="px-4 py-2 text-sm capitalize">{def.action.replace('_', ' ')}</td>
                                          <td className="px-4 py-2 text-sm">{def.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quality Check Creation Modal */}
      <QualityCheckFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchQualityChecks}
      />
    </div>
  );
}
