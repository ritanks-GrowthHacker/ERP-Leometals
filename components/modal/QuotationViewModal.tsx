'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface Quotation {
  id: string;
  submission_number: string;
  submission_date: string;
  valid_until: string;
  status: string;
  total_amount: string;
  delivery_time_in_days: number;
  supplier_name: string;
  supplier_code: string;
  rfq_number: string;
  rfq_title: string;
  quotation_type: string;
  file_url?: string;
  file_name?: string;
  payment_terms?: string;
  notes?: string;
  manual_quotation_data?: Array<{
    productName?: string;
    quantity?: string | number;
    unitPrice?: string | number;
    taxRate?: string | number;
    discount?: string | number;
  }>;
}

interface ManualQuotationItem {
  id: string;
  product_name: string;
  product_code: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  discount_percent: string;
  discount_amount: string;
  line_total: string;
  unit_of_measure: string;
  notes: string;
}

interface QuotationViewModalProps {
  isOpen: boolean;
  quotation: Quotation;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export default function QuotationViewModal({
  isOpen,
  quotation,
  onClose,
  onAccept,
  onReject,
  showActions = true,
}: QuotationViewModalProps) {
  const [manualQuotationDetails, setManualQuotationDetails] = useState<any>(null);
  const [manualItems, setManualItems] = useState<ManualQuotationItem[]>([]);
  const [loadingManualDetails, setLoadingManualDetails] = useState(false);

  useEffect(() => {
    if (isOpen && quotation.quotation_type === 'manual_entry') {
      fetchManualQuotationDetails();
    }
  }, [isOpen, quotation.id, quotation.quotation_type]);

  const fetchManualQuotationDetails = async () => {
    setLoadingManualDetails(true);
    try {
      // Try to get ERP token first, fallback to supplier token
      let token = null;
      try {
        token = getAuthToken();
      } catch {
        token = localStorage.getItem('supplierToken');
      }

      const response = await fetch(`/api/supplier-portal/quotations/${quotation.id}/manual-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setManualQuotationDetails(data.manualQuotation);
        setManualItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching manual quotation details:', error);
    } finally {
      setLoadingManualDetails(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDownloadFile = () => {
    if (!quotation.file_url) return;

    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = quotation.file_url;
      link.download = quotation.file_name || 'quotation-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900">
            Quotation Details: {quotation.submission_number}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <div className="text-sm text-gray-500">Submission Number</div>
              <div className="font-semibold">{quotation.submission_number}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  quotation.status
                )}`}
              >
                {quotation.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Supplier</div>
              <div className="font-semibold">{quotation.supplier_name}</div>
              <div className="text-xs text-gray-500">{quotation.supplier_code}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Submission Date</div>
              <div className="font-semibold">
                {new Date(quotation.submission_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Valid Until</div>
              <div className="font-semibold">
                {quotation.valid_until
                  ? new Date(quotation.valid_until).toLocaleDateString()
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Estimated Delivery</div>
              <div className="font-semibold">
                {quotation.delivery_time_in_days
                  ? `${quotation.delivery_time_in_days} days`
                  : '—'}
              </div>
            </div>
          </div>

          {/* RFQ Reference */}
          {quotation.rfq_number && (
            <div>
              <h4 className="font-semibold mb-2">RFQ Reference</h4>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium">{quotation.rfq_number}</div>
                <div className="text-sm text-gray-600">{quotation.rfq_title}</div>
              </div>
            </div>
          )}

          {/* Quotation File/Details */}
          <div>
            <h4 className="font-semibold mb-2">Quotation Details</h4>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600">Type:</span>
                <span className="font-medium">
                  {quotation.quotation_type === 'file_upload'
                    ? 'File Upload'
                    : 'Manual Entry'}
                </span>
              </div>
              {quotation.quotation_type === 'file_upload' && quotation.file_url && (
                <div className="mt-3">
                  <div className="text-sm text-gray-600 mb-2">Uploaded File:</div>
                  <div className="flex items-center gap-2 bg-blue-50 p-3 rounded border border-blue-200">
                    <span className="text-2xl">📄</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {quotation.file_name || 'Quotation Document'}
                      </div>
                      <button
                        onClick={handleDownloadFile}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        📥 Download File
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Manual Entry Product Details */}
              {quotation.quotation_type === 'manual_entry' && (
                <div className="mt-3">
                  <div className="text-sm text-gray-600 mb-2">Product Details:</div>
                  {loadingManualDetails ? (
                    <div className="text-center py-4 text-gray-500">Loading details...</div>
                  ) : manualItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tax %</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Discount %</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {manualItems.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {item.product_name}
                                {item.notes && (
                                  <div className="text-xs text-gray-500">{item.notes}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.product_code || '-'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {parseFloat(item.quantity).toFixed(2)} {item.unit_of_measure}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                ₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {parseFloat(item.tax_rate).toFixed(2)}%
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                {parseFloat(item.discount_percent).toFixed(2)}%
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                                ₹{parseFloat(item.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {manualQuotationDetails && (
                        <div className="mt-4 bg-gray-50 p-4 rounded space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium">
                              ₹{parseFloat(manualQuotationDetails.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {parseFloat(manualQuotationDetails.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Discount:</span>
                              <span className="font-medium text-red-600">
                                -₹{parseFloat(manualQuotationDetails.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax Amount:</span>
                            <span className="font-medium">
                              ₹{parseFloat(manualQuotationDetails.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {parseFloat(manualQuotationDetails.shipping_charges || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Shipping Charges:</span>
                              <span className="font-medium">
                                ₹{parseFloat(manualQuotationDetails.shipping_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : quotation.manual_quotation_data && 
                     Array.isArray(quotation.manual_quotation_data) &&
                     quotation.manual_quotation_data.length > 0 ? (
                    // Fallback to JSONB data if manual_quotations table doesn't have data yet
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tax %</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Discount %</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {quotation.manual_quotation_data.map((item, idx) => {
                            const qty = parseFloat(item.quantity?.toString() || '0');
                            const price = parseFloat(item.unitPrice?.toString() || '0');
                            const tax = parseFloat(item.taxRate?.toString() || '0');
                            const discount = parseFloat(item.discount?.toString() || '0');
                            const subtotal = qty * price;
                            const discountAmount = subtotal * (discount / 100);
                            const taxableAmount = subtotal - discountAmount;
                            const taxAmount = taxableAmount * (tax / 100);
                            const total = taxableAmount + taxAmount;
                            
                            return (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-sm text-gray-900">
                                  {item.productName || 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{qty}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{tax}%</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{discount}%</td>
                                <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">No product details available</div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₹{parseFloat(quotation.total_amount || '0').toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          {quotation.payment_terms && (
            <div>
              <h4 className="font-semibold mb-2">Payment Terms</h4>
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
                {quotation.payment_terms}
              </div>
            </div>
          )}

          {/* Notes */}
          {quotation.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded text-sm">
                {quotation.notes}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {showActions &&
            (quotation.status === 'submitted' || quotation.status === 'under_review') && (
              <>
                <button
                  onClick={onAccept}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  ✓ Accept Quotation
                </button>
                <button
                  onClick={onReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  ✗ Reject Quotation
                </button>
              </>
            )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
