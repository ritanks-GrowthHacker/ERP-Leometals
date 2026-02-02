'use client';

import { useState, useEffect } from 'react';
import { X, Warehouse, Package, Users, TrendingUp, TrendingDown, CheckCircle, Clock, Activity, BarChart3, MapPin } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface WarehouseLifecycleModalProps {
  isOpen: boolean;
  warehouseId: string;
  onClose: () => void;
}

export default function WarehouseLifecycleModal({ isOpen, warehouseId, onClose }: WarehouseLifecycleModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (isOpen && warehouseId) {
      fetchLifecycle();
    }
  }, [isOpen, warehouseId]);

  const fetchLifecycle = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/erp/inventory/warehouses/${warehouseId}/lifecycle`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const lifecycleData = await response.json();
        setData(lifecycleData);
        animateStages();
      }
    } catch (error) {
      console.error('Error fetching lifecycle:', error);
    } finally {
      setLoading(false);
    }
  };

  const animateStages = () => {
    let stage = 0;
    const interval = setInterval(() => {
      stage++;
      setCurrentStage(stage);
      if (stage >= 5) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  };

  if (!isOpen) return null;

  const stages = data?.lifecycle ? [
    {
      key: 'created',
      title: 'Warehouse Created',
      icon: Warehouse,
      color: 'blue',
      tooltip: null,
      ...data.lifecycle.created,
    },
    {
      key: 'manager_assigned',
      title: 'Manager Assigned',
      icon: Users,
      color: 'purple',
      tooltip: data.manager ? `Manager: ${data.manager.name}\nEmail: ${data.manager.email}\nPhone: ${data.manager.phone || 'N/A'}` : null,
      ...data.lifecycle.manager_assigned,
    },
    {
      key: 'products_stored',
      title: 'Products Stored',
      icon: Package,
      color: 'orange',
      tooltip: data.products && data.products.length > 0
        ? data.products.map((p: any) => `${p.product_name} (${p.sku}): ${parseFloat(p.quantity_on_hand || 0).toFixed(2)} units`).join('\n')
        : null,
      ...data.lifecycle.products_stored,
    },
    {
      key: 'status_active',
      title: 'Warehouse Status',
      icon: Activity,
      color: 'green',
      tooltip: null,
      ...data.lifecycle.status_active,
    },
    {
      key: 'stock_movements',
      title: 'Stock Movements',
      icon: TrendingDown,
      color: 'red',
      tooltip: data.stockMovements && data.stockMovements.length > 0
        ? data.stockMovements.slice(0, 5).map((sm: any) => {
            const movement = sm.from_warehouse && sm.to_warehouse 
              ? `${sm.from_warehouse} → ${sm.to_warehouse}`
              : sm.from_warehouse || sm.to_warehouse || 'N/A';
            return `${sm.transaction_type}: ${parseFloat(sm.quantity || 0).toFixed(2)} units (${movement})`;
          }).join('\n')
        : null,
      ...data.lifecycle.stock_movements,
    },
  ] : [];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 border-blue-300',
    purple: 'bg-purple-100 text-purple-600 border-purple-300',
    orange: 'bg-orange-100 text-orange-600 border-orange-300',
    green: 'bg-green-100 text-green-600 border-green-300',
    indigo: 'bg-indigo-100 text-indigo-600 border-indigo-300',
    red: 'bg-red-100 text-red-600 border-red-300',
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-6xl w-full mx-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b bg-slate-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-black shadow-md border">
              <Warehouse size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-black leading-none">
                Warehouse Lifecycle
              </h3>
              <p className="text-sm text-slate-500 mt-1">{data?.warehouse?.name || 'Loading...'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 cursor-pointer rounded-full text-black transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600">Loading warehouse lifecycle...</p>
            </div>
          ) : data ? (
            <div className="p-6 space-y-6">
              {/* Warehouse Info */}
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Code</span>
                    <p className="font-semibold text-slate-900 font-mono">{data.warehouse.code}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Location</span>
                    <p className="font-semibold text-slate-900">{data.warehouse.location || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Total Products</span>
                    <p className="font-semibold text-slate-900">{data.products?.length || 0} items</p>
                  </div>
                </div>
              </section>

              {/* Lifecycle Timeline */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                  <Activity size={18} className="text-blue-600" />
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs italic">Lifecycle Stages</h4>
                </div>

                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute left-8 top-0 bottom-0 w-1 bg-slate-200 rounded-full"></div>
                  <div 
                    className="absolute left-8 top-0 w-1 bg-green-500 transition-all duration-500 ease-in-out rounded-full"
                    style={{ height: `${(currentStage / stages.length) * 100}%` }}
                  ></div>

                  {/* Stages */}
                  <div className="space-y-6 w-[70%]">
                    {stages.map((stage, index) => {
                      const Icon = stage.icon;
                      const isActive = index < currentStage;

                      return (
                        <div key={stage.key} className="relative pl-20">
                          {/* Icon Circle */}
                          <div 
                            className={`absolute left-5 w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all duration-500 z-20 ${
                              isActive 
                                ? stage.completed 
                                  ? 'bg-green-500 border-green-600' 
                                  : colorClasses[stage.color as keyof typeof colorClasses]
                                : 'bg-slate-100 border-slate-300'
                            }`}
                            style={{
                              transform: isActive ? 'scale(1)' : 'scale(0.8)',
                              opacity: isActive ? 1 : 0.5,
                            }}
                          >
                            {isActive && stage.completed ? (
                              <CheckCircle className="h-5 w-5 text-white" />
                            ) : (
                              <Icon className={`h-4 w-4 ${isActive ? '' : 'text-slate-400'}`} />
                            )}
                          </div>

                          {/* Content */}
                          <div 
                            className={`group relative bg-white rounded-xl border-2 p-4 transition-all duration-500 z-10 ${
                              isActive ? 'border-green-300 shadow-md' : 'border-slate-200'
                            }`}
                            style={{
                              opacity: isActive ? 1 : 0.4,
                              transform: isActive ? 'translateX(0)' : 'translateX(-10px)',
                            }}
                          >
                            {/* Tooltip on hover */}
                            {stage.tooltip && isActive && (
                              <div className="hidden group-hover:block absolute z-50 left-full top-0 ml-4 w-80 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl whitespace-pre-line">
                                {stage.tooltip}
                                <div className="absolute left-0 top-4 w-2 h-2 bg-slate-900 transform rotate-45 -translate-x-1"></div>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-900">{stage.title}</h4>
                                <p className="text-sm text-slate-600 mt-1">{stage.description}</p>
                                {stage.timestamp && (
                                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(stage.timestamp).toLocaleString()}
                                  </p>
                                )}
                                {stage.tooltip && isActive && (
                                  <p className="text-xs text-blue-600 mt-2 font-semibold">
                                    Hover for details →
                                  </p>
                                )}
                              </div>
                              {stage.completed && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Detailed Sections */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manager Details */}
                {data.manager && (
                  <div className="bg-purple-50/40 border border-purple-200/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Users size={18} className="text-purple-600" />
                      <h4 className="font-bold text-purple-900 uppercase tracking-wider text-xs">Manager Details</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-purple-100">
                        <span className="text-slate-700 font-medium">Name:</span>
                        <span className="font-bold text-slate-900">{data.manager.name}</span>
                      </div>
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-purple-100">
                        <span className="text-slate-700 font-medium">Email:</span>
                        <span className="font-bold text-slate-900 text-xs">{data.manager.email}</span>
                      </div>
                      {data.manager.phone && (
                        <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-purple-100">
                          <span className="text-slate-700 font-medium">Phone:</span>
                          <span className="font-bold text-slate-900">{data.manager.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Products */}
                {data.products && data.products.length > 0 && (
                  <div className="bg-orange-50/40 border border-orange-200/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={18} className="text-orange-600" />
                      <h4 className="font-bold text-orange-900 uppercase tracking-wider text-xs">Products ({data.products.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {data.products.map((p: any, idx: number) => (
                        <div key={`${p.id}-${p.product_name}-${idx}`} className="flex justify-between text-sm bg-white p-2 rounded-lg border border-orange-100">
                          <span className="text-slate-700 font-medium">{p.product_name}</span>
                          <span className="font-bold text-slate-900">{parseFloat(p.quantity_on_hand || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Movements */}
                {data.stockMovements && data.stockMovements.length > 0 && (
                  <div className="bg-red-50/40 border border-red-200/50 rounded-xl p-5 col-span-full">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown size={18} className="text-red-600" />
                      <h4 className="font-bold text-red-900 uppercase tracking-wider text-xs">Recent Stock Movements</h4>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {data.stockMovements.slice(0, 10).map((sm: any) => (
                        <div key={sm.id} className="flex justify-between text-sm bg-white p-2 rounded-lg border border-red-100">
                          <span className="text-slate-700 font-medium">{sm.transaction_type}</span>
                          <span className="font-bold text-blue-600">Qty: {parseFloat(sm.quantity || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              No lifecycle data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end px-6 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
