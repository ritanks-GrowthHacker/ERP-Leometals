'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { LoadingSpinner, ButtonLoader } from '@/components/common/LoadingSpinner';

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface AdjustmentLine {
  productId: string;
  systemQuantity: string;
  countedQuantity: string;
  reason: string;
}

export default function NewAdjustmentPage() {
  const { showAlert } = useAlert();
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    adjustmentType: 'cycle_count',
    referenceNumber: '',
    adjustmentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [lines, setLines] = useState<AdjustmentLine[]>([
    { productId: '', systemQuantity: '', countedQuantity: '', reason: '' },
  ]);

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
  }, []);

  const fetchWarehouses = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWarehouses((data.warehouses || []).filter((w: any) => w.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/products', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts((data.products || []).filter((p: any) => p.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addLine = () => {
    setLines([...lines, { productId: '', systemQuantity: '', countedQuantity: '', reason: '' }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof AdjustmentLine, value: string) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    // Comprehensive validation with custom alerts
    if (!formData.warehouseId) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select a warehouse' });
      return;
    }

    if (!formData.adjustmentType) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select an adjustment type' });
      return;
    }

    if (!formData.adjustmentDate) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please select an adjustment date' });
      return;
    }

    if (lines.length === 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please add at least one product line' });
      return;
    }

    if (lines.some(l => !l.productId || !l.countedQuantity || !l.systemQuantity)) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in all required fields for each line' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/erp/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: lines.map(l => ({
            productId: l.productId,
            systemQuantity: parseFloat(l.systemQuantity),
            countedQuantity: parseFloat(l.countedQuantity),
            reason: l.reason || null,
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Stock adjustment created successfully!' });
        router.push('/erp/inventory/adjustments');
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create adjustment' });
      }
    } catch (error) {
      console.error('Error creating adjustment:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create adjustment' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Loading Overlay */}
      {loading && <LoadingSpinner size="lg" message="Creating adjustment..." fullScreen />}
      
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">New Stock Adjustment</h1>
        <Button onClick={() => router.push('/erp/inventory/adjustments')} className="bg-gray-500">
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Warehouse *</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <Select
                label="Adjustment Type *"
                value={formData.adjustmentType}
                onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value })}
                options={[
                  { value: 'cycle_count', label: '🔢 Cycle Count' },
                  { value: 'physical_inventory', label: '📋 Physical Inventory' },
                  { value: 'damage', label: '💔 Damage' },
                  { value: 'loss', label: '📉 Loss' },
                  { value: 'found', label: '🔍 Found' },
                  { value: 'other', label: '📝 Other' },
                ]}
              />

              <Input
                label="Reference Number"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="Optional"
              />

              <Input
                label="Adjustment Date *"
                type="date"
                value={formData.adjustmentDate}
                onChange={(e) => setFormData({ ...formData, adjustmentDate: e.target.value })}
              />
            </div>

            <Textarea
              label="Notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Adjustment Lines</h3>
                <Button type="button" onClick={addLine} className="bg-green-600">
                  + Add Line
                </Button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1">Product *</label>
                          <select
                            className="w-full px-3 py-2 border rounded"
                            value={line.productId}
                            onChange={(e) => updateLine(index, 'productId', e.target.value)}
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        <Input
                          label="System Qty *"
                          type="number"
                          step="0.01"
                          value={line.systemQuantity}
                          onChange={(e) => updateLine(index, 'systemQuantity', e.target.value)}
                        />

                        <Input
                          label="Counted Qty *"
                          type="number"
                          step="0.01"
                          value={line.countedQuantity}
                          onChange={(e) => updateLine(index, 'countedQuantity', e.target.value)}
                        />

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Difference
                          </label>
                          <Input
                            type="number"
                            value={
                              line.countedQuantity && line.systemQuantity
                                ? (parseFloat(line.countedQuantity) - parseFloat(line.systemQuantity)).toFixed(2)
                                : '0'
                            }
                            disabled
                            className="bg-gray-50"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="bg-red-600 w-full"
                            disabled={lines.length === 1}
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="md:col-span-6">
                          <Input
                            label="Reason"
                            value={line.reason}
                            onChange={(e) => updateLine(index, 'reason', e.target.value)}
                            placeholder="Optional reason for adjustment"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={() => router.push('/erp/inventory/adjustments')}
                className="bg-gray-500"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <ButtonLoader /> : 'Create Adjustment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
