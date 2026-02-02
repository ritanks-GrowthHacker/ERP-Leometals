'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  receivedBy: string | null;
  status: string;
  poNumber: string | null;
  supplierName: string;
  warehouseName: string;
  lineCount: number;
}

export default function WarehouseManagerGoodsReceiptsPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchReceipts = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/warehouse-manager/purchasing/goods-receipts?page=${currentPage}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data.goodsReceipts || []);
        setReceipts(mapped);
        setTotalPages(data.pagination.totalPages);
      } else if (response.status === 403) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching goods receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Goods Receipts</h1>
          <p className="text-gray-600 mt-2">Manage goods receipts for your warehouse</p>
        </div>
       
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No goods receipts found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Receipt #</th>
                      <th className="text-left py-3 px-4">PO Number</th>
                      <th className="text-left py-3 px-4">Supplier</th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Received By</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-center py-3 px-4">Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={receipt.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium font-mono">{receipt.receiptNumber}</td>
                        <td className="py-3 px-4 font-mono text-sm">{receipt.poNumber || '-'}</td>
                        <td className="py-3 px-4">{receipt.supplierName}</td>
                        <td className="py-3 px-4 text-sm">
                          {new Date(receipt.receiptDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm">{receipt.receivedBy || '-'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full capitalize ${
                              receipt.status === 'received'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {receipt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{receipt.lineCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-6">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
