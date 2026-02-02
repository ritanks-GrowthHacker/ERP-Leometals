'use client';

import { useState, useEffect } from 'react';
import { X, Users, ShoppingCart, TrendingUp, CheckCircle, Clock, Activity, BarChart3, DollarSign, Package } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';

interface CustomerLifecycleModalProps {
  isOpen: boolean;
  customerId: string;
  onClose: () => void;
}

export default function CustomerLifecycleModal({ isOpen, customerId, onClose }: CustomerLifecycleModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchLifecycle();
    }
  }, [isOpen, customerId]);

  const fetchLifecycle = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/erp/sales/customers/${customerId}/lifecycle`, {
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
      title: 'Customer Created',
      icon: Users,
      color: 'blue',
      tooltip: null,
      ...data.lifecycle.created,
    },
    {
      key: 'first_order',
      title: 'First Order Placed',
      icon: ShoppingCart,
      color: 'purple',
      tooltip: data.firstOrder ? `Order: ${data.firstOrder.so_number}\nDate: ${new Date(data.firstOrder.order_date).toLocaleDateString()}\nAmount: ₹${parseFloat(data.firstOrder.total_amount || 0).toLocaleString('en-IN')}` : null,
      ...data.lifecycle.first_order,
    },
    {
      key: 'orders_count',
      title: 'Total Orders',
      icon: Package,
      color: 'orange',
      tooltip: data.orders && data.orders.length > 0
        ? data.orders.map((o: any) => `${o.so_number} - ₹${parseFloat(o.total_amount || 0).toLocaleString('en-IN')} (${o.status})`).join('\n')
        : null,
      ...data.lifecycle.orders_count,
    },
    {
      key: 'revenue',
      title: 'Total Revenue',
      icon: DollarSign,
      color: 'green',
      tooltip: null,
      ...data.lifecycle.revenue,
    },
    {
      key: 'customer_details',
      title: 'Customer Status',
      icon: Activity,
      color: 'indigo',
      tooltip: null,
      ...data.lifecycle.customer_details,
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
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-black leading-none">
                Customer Lifecycle
              </h3>
              <p className="text-sm text-slate-500 mt-1">{data?.customer?.name || 'Loading...'}</p>
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
              <p className="text-gray-600">Loading customer lifecycle...</p>
            </div>
          ) : data ? (
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Code</span>
                    <p className="font-semibold text-slate-900 font-mono">{data.customer.code}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Email</span>
                    <p className="font-semibold text-slate-900 text-sm">{data.customer.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Total Orders</span>
                    <p className="font-semibold text-slate-900">{data.orders?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Total Revenue</span>
                    <p className="font-semibold text-green-600">₹{parseFloat(data.totalRevenue || 0).toLocaleString('en-IN')}</p>
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
                {/* Sales Orders */}
                {data.orders && data.orders.length > 0 && (
                  <div className="bg-orange-50/40 border border-orange-200/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart size={18} className="text-orange-600" />
                      <h4 className="font-bold text-orange-900 uppercase tracking-wider text-xs">Sales Orders ({data.orders.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {data.orders.map((order: any) => (
                        <div key={order.id} className="bg-white p-3 rounded-lg border border-orange-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-bold text-slate-900">{order.so_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === 'completed' ? 'bg-green-100 text-green-700' :
                              order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>{new Date(order.order_date).toLocaleDateString()}</span>
                            <span className="font-bold text-green-600">₹{parseFloat(order.total_amount || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Details */}
                {data.customer && (
                  <div className="bg-indigo-50/40 border border-indigo-200/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Users size={18} className="text-indigo-600" />
                      <h4 className="font-bold text-indigo-900 uppercase tracking-wider text-xs">Customer Information</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-slate-700 font-medium">Phone:</span>
                        <span className="font-bold text-slate-900">{data.customer.phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-slate-700 font-medium">City:</span>
                        <span className="font-bold text-slate-900">{data.customer.city || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-slate-700 font-medium">Payment Terms:</span>
                        <span className="font-bold text-slate-900">{data.customer.payment_terms || 30} days</span>
                      </div>
                      <div className="flex justify-between text-sm bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-slate-700 font-medium">Status:</span>
                        <span className={`font-bold ${data.customer.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {data.customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Revenue Timeline */}
              {data.revenueTimeline && data.revenueTimeline.length > 0 && (
                <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-blue-600" />
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs italic">Revenue History</h4>
                  </div>
                  <div className="space-y-2">
                    {data.revenueTimeline.map((item: any, index: number) => {
                      const amount = parseFloat(item.total_amount || 0);
                      const maxAmount = Math.max(...data.revenueTimeline.map((r: any) => parseFloat(r.total_amount || 0)));
                      const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                      
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-semibold w-28">{new Date(item.order_date).toLocaleDateString()}</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-6 relative overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-green-600 w-24 text-right">
                            ₹{amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
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
