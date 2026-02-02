'use client';
import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

interface PO {
  id: string;
  poNumber: string;
  supplier: {
    name: string;
  };
}

interface POItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
}

interface ReceiveItem {
  poItemId: string;
  productName: string;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  quantityToReceive: number;
}

interface ReceiveGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceiveGoodsModal({ isOpen, onClose, onSuccess }: ReceiveGoodsModalProps) {
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form fields
  const [grnNumber, setGrnNumber] = useState('');
  const [receiveDate, setReceiveDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qualityCheck, setQualityCheck] = useState(false);
  const [notes, setNotes] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      generateGRNNumber();
      fetchPOs();
      fetchWarehouses();
      setReceiveDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const fetchPOs = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/erp/purchasing/orders?status=pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPos(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching POs:', error);
    }
  };

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchPOItems = async (poId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/erp/purchasing/orders/${poId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setPoItems(items);
        
        // Initialize receive items with remaining quantities
        const receiveItemsInit: ReceiveItem[] = items
          .filter((item: POItem) => item.remainingQuantity > 0)
          .map((item: POItem) => ({
            poItemId: item.id,
            productName: item.productName,
            sku: item.sku,
            orderedQuantity: item.orderedQuantity,
            receivedQuantity: item.receivedQuantity,
            quantityToReceive: item.remainingQuantity,
          }));
        setReceiveItems(receiveItemsInit);
      }
    } catch (error) {
      console.error('Error fetching PO items:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateGRNNumber = () => {
    setGenerating(true);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setGrnNumber(`GRN-${timestamp}-${random}`);
    setGenerating(false);
  };

  const handlePOSelect = (po: PO) => {
    setSelectedPO(po);
    fetchPOItems(po.id);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const newReceiveItems = [...receiveItems];
    const maxQty = newReceiveItems[index].orderedQuantity - newReceiveItems[index].receivedQuantity;
    const qty = parseFloat(quantity) || 0;
    newReceiveItems[index].quantityToReceive = Math.min(qty, maxQty);
    setReceiveItems(newReceiveItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPO) {
      alert('Please select a purchase order');
      return;
    }

    if (!warehouseId) {
      alert('Please select a warehouse');
      return;
    }

    const itemsToReceive = receiveItems.filter(item => item.quantityToReceive > 0);
    if (itemsToReceive.length === 0) {
      alert('Please enter quantities to receive');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      alert('No authentication token found');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/erp/purchasing/goods-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          grnNumber,
          poId: selectedPO.id,
          warehouseId,
          receiveDate,
          qualityCheck,
          notes,
          items: itemsToReceive,
        }),
      });

      if (response.ok) {
        alert('Goods received successfully!');
        onSuccess();
        resetForm();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to receive goods: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error receiving goods:', error);
      alert('Failed to receive goods. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setGrnNumber('');
    setSelectedPO(null);
    setPoItems([]);
    setReceiveItems([]);
    setReceiveDate('');
    setWarehouseId('');
    setQualityCheck(false);
    setNotes('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-xl max-w-5xl w-full mx-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Receive Goods</h3>
            <p className="text-sm text-slate-500 mt-1">Record incoming goods from purchase orders</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* GRN Number with Generate Button */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              GRN Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="GRN-2024-001"
              />
              <button
                type="button"
                onClick={generateGRNNumber}
                disabled={generating}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                Generate
              </button>
            </div>
          </div>

          {/* Purchase Order Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Purchase Order <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedPO?.id || ''}
              onChange={(e) => {
                const po = pos.find(p => p.id === e.target.value);
                if (po) handlePOSelect(po);
              }}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Purchase Order</option>
              {pos.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} - {po.supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Receive Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Quality Check Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="qualityCheck"
              checked={qualityCheck}
              onChange={(e) => setQualityCheck(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="qualityCheck" className="text-sm font-semibold text-slate-700">
              Require Quality Check before accepting
            </label>
          </div>

          {/* Items to Receive */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-500 mx-auto"></div>
              <p className="text-slate-600 mt-2">Loading PO items...</p>
            </div>
          )}

          {!loading && receiveItems.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h4 className="font-semibold text-slate-900">Items to Receive</h4>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Ordered</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Received</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Remaining</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Receive Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receiveItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm text-slate-900">{item.productName}</div>
                        <div className="text-xs text-slate-600">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{item.orderedQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{item.receivedQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {item.orderedQuantity - item.receivedQuantity}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantityToReceive}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          max={item.orderedQuantity - item.receivedQuantity}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-slate-200 rounded text-right focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && selectedPO && receiveItems.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              All items from this PO have been fully received.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Any observations, damage reports, or special notes..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPO || receiveItems.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Receiving...' : 'Receive Goods'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
