'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

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

interface MovementLine {
  productId: string;
  quantityOrdered: string;
  unitCost: string;
  notes: string;
}

export default function NewMovementPage() {
  const { showAlert } = useAlert();
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    movementType: 'receipt',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    scheduledDate: '',
    notes: '',
  });
  const [lines, setLines] = useState<MovementLine[]>([
    { productId: '', quantityOrdered: '', unitCost: '', notes: '' },
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
    setLines([...lines, { productId: '', quantityOrdered: '', unitCost: '', notes: '' }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof MovementLine, value: string) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    // Validate
    if (lines.some(l => !l.productId || !l.quantityOrdered)) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in all required fields for each line' });
      return;
    }

    if (formData.movementType === 'internal_transfer') {
      if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
        showAlert({ type: 'error', title: 'Validation Error', message: 'Internal transfer requires both source and destination warehouses' });
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch('/api/erp/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          sourceWarehouseId: formData.sourceWarehouseId || null,
          destinationWarehouseId: formData.destinationWarehouseId || null,
          lines: lines.map(l => ({
            productId: l.productId,
            quantityOrdered: parseFloat(l.quantityOrdered),
            unitCost: l.unitCost ? parseFloat(l.unitCost) : null,
            notes: l.notes || null,
          })),
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Stock movement created successfully!' });
        router.push('/erp/inventory/movements');
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create movement' });
      }
    } catch (error) {
      console.error('Error creating movement:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create movement' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">New Stock Movement</h1>
        <Button onClick={() => router.push('/erp/inventory/movements')} className="bg-gray-500">
          Cancel
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Movement Details</h3>
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Movement Type *"
                value={formData.movementType}
                onChange={(e) => setFormData({ ...formData, movementType: e.target.value })}
                options={[
                  { value: 'receipt', label: '📥 Receipt' },
                  { value: 'delivery', label: '📤 Delivery' },
                  { value: 'internal_transfer', label: '🔄 Internal Transfer' },
                  { value: 'return', label: '↩️ Return' },
                  { value: 'scrap', label: '🗑️ Scrap' },
                ]}
                required
              />

              <Input
                label="Scheduled Date"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              />

              <div>
                <label className="block text-sm font-medium mb-1">Source Warehouse</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={formData.sourceWarehouseId}
                  onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Destination Warehouse</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={formData.destinationWarehouseId}
                  onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Textarea
              label="Notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Movement Lines</h3>
                <Button type="button" onClick={addLine} className="bg-green-600">
                  + Add Line
                </Button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={index} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1">Product *</label>
                          <select
                            className="w-full px-3 py-2 border rounded"
                            value={line.productId}
                            onChange={(e) => updateLine(index, 'productId', e.target.value)}
                            required
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
                          label="Quantity *"
                          type="number"
                          step="0.01"
                          value={line.quantityOrdered}
                          onChange={(e) => updateLine(index, 'quantityOrdered', e.target.value)}
                          required
                        />

                        <Input
                          label="Unit Cost"
                          type="number"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) => updateLine(index, 'unitCost', e.target.value)}
                        />

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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={() => router.push('/erp/inventory/movements')}
                className="bg-gray-500"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Movement'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
