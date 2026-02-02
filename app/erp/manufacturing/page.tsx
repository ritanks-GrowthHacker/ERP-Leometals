'use client';
import { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertTriangle, CheckCircle, Clock, Activity, Gauge, Plus, Play } from 'lucide-react';
import Link from 'next/link';
import { getAuthToken } from '@/lib/utils/token';
import Lottie from 'lottie-react';
import manufacturingAnimation from '@/lib/lottie/Manufacturing.json';

interface DashboardStats {
  activeOrders: number;
  completedToday: number;
  pendingQC: number;
  materialShortages: number;
  avgOEE: number;
  productionYield: number;
  onTimeDelivery: number;
  scrapRate: number;
}

interface RecentOrder {
  id: string;
  moNumber: string;
  productName: string;
  progress: number;
  status: string;
  dueDate: string;
}

interface WorkCenterStatus {
  id: string;
  name: string;
  utilization: number;
  status: 'active' | 'idle' | 'maintenance';
  currentJob: string | null;
}

interface Alert {
  id: string;
  type: 'shortage' | 'delay' | 'quality' | 'maintenance';
  message: string;
  priority: 'high' | 'medium' | 'low';
  time: string;
}

export default function ManufacturingDashboard() {
  const [showLoader, setShowLoader] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterStatus[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      
      const [ordersRes, mrpRes, wcRes, qcRes] = await Promise.all([
        fetch('/api/erp/manufacturing/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/erp/manufacturing/mrp', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/erp/manufacturing/work-centers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/erp/manufacturing/quality', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const orders = ordersRes.ok ? await ordersRes.json() : [];
      const mrpData = mrpRes.ok ? await mrpRes.json() : null;
      const wcData = wcRes.ok ? await wcRes.json() : null;
      const qcData = qcRes.ok ? await qcRes.json() : null;

      const ordersArray = Array.isArray(orders) ? orders : (orders.orders || []);
      const activeOrders = ordersArray.filter((o: any) => o.status === 'in_progress' || o.status === 'confirmed').length;
      const completedToday = ordersArray.filter((o: any) => {
        if (!o.actualEnd) return false;
        const today = new Date().toDateString();
        return o.status === 'done' && new Date(o.actualEnd).toDateString() === today;
      }).length;
      const pendingQC = qcData?.qualityChecks?.filter((qc: any) => qc.status === 'pending' || qc.status === 'in_progress').length || 0;
      const materialShortages = mrpData?.materialShortages?.total || 0;

      // Calculate real metrics with proper null/undefined handling
      const doneOrders = ordersArray.filter((o: any) => o.status === 'done');
      const totalProduced = doneOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.producedQuantity) || 0), 0);
      const totalPlanned = doneOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.plannedQuantity) || 0), 0);
      const productionYield = (totalPlanned > 0 && !isNaN(totalProduced)) ? Math.round((totalProduced / totalPlanned) * 100) : 0;
      
      const ordersWithDates = ordersArray.filter((o: any) => o.scheduledEnd && o.actualEnd);
      const onTimeOrders = ordersWithDates.filter((o: any) => new Date(o.actualEnd) <= new Date(o.scheduledEnd)).length;
      const onTimeDelivery = (ordersWithDates.length > 0 && !isNaN(onTimeOrders)) ? Math.round((onTimeOrders / ordersWithDates.length) * 100) : 0;
      
      const totalScrap = doneOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.scrapQuantity) || 0), 0);
      const scrapRate = (totalProduced > 0 && !isNaN(totalScrap)) ? Number(((totalScrap / totalProduced) * 100).toFixed(1)) : 0;
      
      // Work centers API returns array directly
      const workCentersArray = Array.isArray(wcData) ? wcData : (wcData?.workCenters || []);
      const totalEfficiency = workCentersArray.reduce((sum: number, wc: any) => sum + (parseFloat(wc.efficiency) || 0), 0);
      const avgOEE = (workCentersArray.length > 0 && !isNaN(totalEfficiency)) ? Math.round(totalEfficiency / workCentersArray.length) : 0;

      const calculatedStats: DashboardStats = {
        activeOrders,
        completedToday,
        pendingQC,
        materialShortages,
        avgOEE,
        productionYield,
        onTimeDelivery,
        scrapRate
      };

      const recentOrders: RecentOrder[] = ordersArray.slice(0, 4).map((o: any) => ({
        id: o.id,
        moNumber: o.moNumber,
        productName: o.productName,
        progress: o.plannedQuantity > 0 ? Math.round((o.producedQuantity / o.plannedQuantity) * 100) : 0,
        status: o.status,
        dueDate: o.scheduledEnd
      }));

      const workCenters: WorkCenterStatus[] = workCentersArray.slice(0, 5).map((wc: any) => ({
        id: wc.id,
        name: wc.name,
        utilization: wc.efficiency || 0,
        status: wc.status,
        currentJob: null
      }));

      const alerts: Alert[] = [];
      if (mrpData?.materialShortages?.data?.length > 0) {
        alerts.push({
          id: '1',
          type: 'shortage',
          message: `${mrpData.materialShortages.data[0].componentName} stock shortage detected`,
          priority: 'high',
          time: 'Just now'
        });
      }
      if (orders.some((o: any) => new Date(o.scheduledEnd) < new Date() && o.status !== 'done')) {
        alerts.push({
          id: '2',
          type: 'delay',
          message: 'Some orders are behind schedule',
          priority: 'medium',
          time: '1 hour ago'
        });
      }

      setStats(calculatedStats);
      setRecentOrders(recentOrders);
      setWorkCenters(workCenters);
      setAlerts(alerts);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'idle': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'shortage': return <Package size={16} className="text-red-600" />;
      case 'delay': return <Clock size={16} className="text-orange-600" />;
      case 'quality': return <AlertTriangle size={16} className="text-yellow-600" />;
      case 'maintenance': return <Activity size={16} className="text-blue-600" />;
      default: return <AlertTriangle size={16} className="text-gray-600" />;
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-orange-500 bg-orange-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'text-green-600';
    if (utilization >= 60) return 'text-yellow-600';
    if (utilization >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="relative min-h-screen">
      {showLoader && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
          <div className="w-96 h-96">
            <Lottie animationData={manufacturingAnimation} loop={true} />
          </div>
        </div>
      )}

      <div style={{ opacity: showLoader ? 0 : 1, transition: 'opacity 0.5s' }}>
        <div className="p-6">
          {/* Header with Tabs */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Manufacturing</h2>
                <p className="text-sm text-gray-500 mt-1">Real-time production overview and KPIs</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('new-mo')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'new-mo'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus size={16} />
            New MO
          </button>
          <button
            onClick={() => setActiveTab('bom')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'bom'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Manage BOM
          </button>
          <button
            onClick={() => setActiveTab('quality')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'quality'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Quality Check
          </button>
          <button
            onClick={() => setActiveTab('mrp')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'mrp'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Run MRP
          </button>
        </div>
      </div>

      {/* Dashboard Tab Content */}
      {activeTab === 'dashboard' && (
        <>
          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Link href="/erp/manufacturing/work-centers">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-6 h-6 text-blue-600" />
                  <div className="text-lg font-bold text-blue-900">Work Centers</div>
                </div>
                <p className="text-sm text-blue-700">Manage production work centers and capacity</p>
              </div>
            </Link>

            <Link href="/erp/manufacturing/routing">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <div className="text-lg font-bold text-purple-900">Routings</div>
                </div>
                <p className="text-sm text-purple-700">Define production sequences and operations</p>
              </div>
            </Link>

            <Link href="/erp/manufacturing/bom">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200 hover:border-green-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-6 h-6 text-green-600" />
                  <div className="text-lg font-bold text-green-900">Bill of Materials</div>
                </div>
                <p className="text-sm text-green-700">Manage product recipes and components</p>
              </div>
            </Link>

            <Link href="/erp/manufacturing/orders">
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-5 border-2 border-orange-200 hover:border-orange-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <Play className="w-6 h-6 text-orange-600" />
                  <div className="text-lg font-bold text-orange-900">Manufacturing Orders</div>
                </div>
                <p className="text-sm text-orange-700">Execute operations and track production</p>
              </div>
            </Link>

            <Link href="/erp/manufacturing/rework">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-5 border-2 border-red-200 hover:border-red-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div className="text-lg font-bold text-red-900">Rework Orders</div>
                </div>
                <p className="text-sm text-red-700">Manage defects and rework processes</p>
              </div>
            </Link>

            <Link href="/erp/manufacturing/quality">
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-5 border-2 border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                  <div className="text-lg font-bold text-teal-900">Quality Checks</div>
                </div>
                <p className="text-sm text-teal-700">Batch tracking and quality control</p>
              </div>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Link href="/erp/manufacturing/orders">
              <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div className="text-sm font-medium text-gray-600">Active Orders</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.activeOrders}</div>
              </div>
            </Link>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="text-sm font-medium text-gray-600">Completed Today</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.completedToday}</div>
            </div>

            <Link href="/erp/manufacturing/quality">
              <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div className="text-sm font-medium text-gray-600">Pending QC</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.pendingQC}</div>
              </div>
            </Link>

            <Link href="/erp/manufacturing/mrp">
              <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div className="text-sm font-medium text-gray-600">Material Shortages</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.materialShortages}</div>
              </div>
            </Link>
          </div>

          {/* KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="text-purple-600" size={16} />
                <div className="text-sm font-medium text-gray-700">Avg OEE</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.avgOEE}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${stats.avgOEE}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-2">Overall Equipment Effectiveness</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-green-600" size={18} />
                <div className="text-sm font-medium text-gray-700">Production Yield</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.productionYield}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: `${stats.productionYield}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-2">Good units / Total units</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="text-blue-600" size={18} />
                <div className="text-sm font-medium text-gray-700">On-Time Delivery</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.onTimeDelivery}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${stats.onTimeDelivery}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-2">Orders delivered on schedule</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-red-600" size={18} />
                <div className="text-sm font-medium text-gray-700">Scrap Rate</div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.scrapRate}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full" style={{ width: `${stats.scrapRate * 10}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-2">Scrapped / Total produced</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Recent Manufacturing Orders */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">Recent Manufacturing Orders</h3>
                <Link href="/erp/manufacturing/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View All →
                </Link>
              </div>
              <div className="p-4 space-y-3">
                {recentOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No recent orders</p>
                  </div>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-blue-600 text-sm">{order.moNumber}</span>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">{order.productName}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${order.progress === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                              style={{ width: `${order.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{order.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Work Center Status */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">Work Center Status</h3>
                <Link href="/erp/manufacturing/work-centers" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View All →
                </Link>
              </div>
              <div className="p-4 space-y-3">
                {workCenters.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No work centers</p>
                  </div>
                ) : (
                  workCenters.map((center) => (
                    <div key={center.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900 text-sm">{center.name}</span>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(center.status)}`}>
                            {center.status}
                          </span>
                        </div>
                        {center.currentJob && (
                          <div className="text-xs text-gray-600 mb-2">Working on: {center.currentJob}</div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${center.utilization}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${getUtilizationColor(center.utilization)}`}>
                            {center.utilization}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Alerts & Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 mb-6">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Alerts & Notifications</h3>
            </div>
            <div className="p-4">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`flex items-start gap-3 p-3 border-l-4 rounded ${getAlertColor(alert.priority)}`}>
                      <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{alert.message}</div>
                        <div className="text-xs text-gray-600 mt-1">{alert.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* New MO Tab */}
      {activeTab === 'new-mo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Create New Manufacturing Order</h3>
            <p className="text-gray-600 mb-6">Add a new manufacturing order with detailed specifications</p>
            <Link href="/erp/manufacturing/orders" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Go to Orders
            </Link>
          </div>
        </div>
      )}

      {/* Manage BOM Tab */}
      {activeTab === 'bom' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-green-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Bill of Materials</h3>
            <p className="text-gray-600 mb-6">Create and manage BOMs for your products</p>
            <Link href="/erp/manufacturing/bom" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Go to BOM
            </Link>
          </div>
        </div>
      )}

      {/* Quality Check Tab */}
      {activeTab === 'quality' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto text-purple-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Check Management</h3>
            <p className="text-gray-600 mb-6">Monitor and manage quality checks for all orders</p>
            <Link href="/erp/manufacturing/quality" className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Go to Quality
            </Link>
          </div>
        </div>
      )}

      {/* Run MRP Tab */}
      {activeTab === 'mrp' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center py-12">
            <TrendingUp size={48} className="mx-auto text-orange-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Material Requirements Planning</h3>
            <p className="text-gray-600 mb-6">Run MRP and manage material shortages</p>
            <Link href="/erp/manufacturing/mrp" className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              Go to MRP
            </Link>
          </div>
        </div>
      )}
    </div>
      </div>
    </div>
  );
}