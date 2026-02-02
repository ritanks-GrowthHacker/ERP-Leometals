'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Check } from 'lucide-react';

interface StockAlert {
  id: string;
  alert_type: string;
  alert_level: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  current_quantity: string;
  threshold_quantity: string;
}

export default function StockAlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [showResolved]);

  const fetchAlerts = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (!showResolved) params.append('resolved', 'false');

      const response = await fetch(`/api/erp/inventory/alerts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/alerts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alertId }),
      });

      if (response.ok) {
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const getAlertTypeColor = (alertType: string) => {
    switch (alertType) {
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out_of_stock':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'reorder_point':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (isResolved: boolean) => {
    return isResolved
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Stock Alerts</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">Show Resolved</span>
        </label>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="text-2xl font-bold">{alerts.filter((a) => !a.is_resolved).length}</div>
            <p className="text-sm text-gray-600">Active Alerts</p>
          </div>
        </div>

        <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
          <div className="p-6">
            <div className="text-2xl font-bold text-red-700">
              {alerts.filter((a) => a.alert_type === 'out_of_stock' && !a.is_resolved).length}
            </div>
            <p className="text-sm text-red-600">Out of Stock</p>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-xl border border-yellow-200 overflow-hidden">
          <div className="p-6">
            <div className="text-2xl font-bold text-yellow-700">
              {alerts.filter((a) => a.alert_type === 'low_stock' && !a.is_resolved).length}
            </div>
            <p className="text-sm text-yellow-600">Low Stock</p>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">All Alerts ({alerts.length})</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead>Alert Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Current Qty</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  {showResolved ? 'No alerts found' : 'No active alerts'}
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getAlertTypeColor(alert.alert_type)}`}>
                      {alert.alert_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{alert.product_name}</TableCell>
                  <TableCell className="text-gray-600">{alert.product_sku}</TableCell>
                  <TableCell>{alert.warehouse_name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {parseFloat(alert.current_quantity || '0').toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {parseFloat(alert.threshold_quantity || '0').toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate text-sm text-gray-600">{alert.message}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(alert.is_resolved)}`}>
                      {alert.is_resolved ? 'Resolved' : 'Active'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!alert.is_resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Resolve
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
