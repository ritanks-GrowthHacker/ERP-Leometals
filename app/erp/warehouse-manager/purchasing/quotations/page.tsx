'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { mapSnakeToCamel } from '@/lib/utils/dataMapper';

interface Quotation {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string | null;
  status: string;
  totalAmount: number;
  currencyCode: string;
  supplierName: string;
  rfqId: string | null;
  rfqNumber: string | null;
}

export default function WarehouseManagerQuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchQuotations = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/warehouse-manager/purchasing/quotations?page=${currentPage}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const mapped = mapSnakeToCamel(data.quotations || []);
        setQuotations(mapped);
        setTotalPages(data.pagination.totalPages);
      } else if (response.status === 403) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quotations</h1>
          <p className="text-gray-600 mt-2">View quotations (Read-only - cannot accept/reject)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
          <p className="text-sm text-blue-800">📖 View Only</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No quotations found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Quotation #</th>
                      <th className="text-left py-3 px-4">Supplier</th>
                      <th className="text-left py-3 px-4">RFQ</th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Valid Until</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-right py-3 px-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((quotation) => (
                      <tr key={quotation.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium font-mono">
                          {quotation.quotationNumber}
                        </td>
                        <td className="py-3 px-4">{quotation.supplierName}</td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {quotation.rfqNumber || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {new Date(quotation.quotationDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {quotation.validUntil
                            ? new Date(quotation.validUntil).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(
                              quotation.status
                            )}`}
                          >
                            {quotation.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {quotation.currencyCode} {quotation.totalAmount.toLocaleString()}
                        </td>
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
