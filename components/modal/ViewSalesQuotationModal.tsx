'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, Download, Send, CheckCircle, XCircle } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface QuotationLine {
  id: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  discount: string;
  product?: {
    name: string;
    sku: string;
  };
}

interface Quotation {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms: number;
  notes: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  lines: QuotationLine[];
  createdAt: string;
}

interface ViewSalesQuotationModalProps {
  isOpen: boolean;
  quotationId: string;
  onClose: () => void;
  onSuccess?: () => void;
  apiPrefix?: string;
}

export default function ViewSalesQuotationModal({
  isOpen,
  quotationId,
  onClose,
  onSuccess,
  apiPrefix = '/api/erp/sales',
}: ViewSalesQuotationModalProps) {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { showAlert, showConfirm } = useAlert();

  useEffect(() => {
    if (isOpen && quotationId) {
      fetchQuotation();
    }
  }, [isOpen, quotationId]);

  const fetchQuotation = async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const response = await fetch(`${apiPrefix}/quotations/${quotationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setQuotation(data);
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to fetch quotation details',
        });
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Error fetching quotation',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!quotation) return;

    showConfirm({
      title: 'Send Quotation',
      message: `Send quotation ${quotation.quotationNumber} to ${quotation.customer.name} (${quotation.customer.email})?`,
      confirmText: 'Send Email',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setSending(true);
        const token = getAuthToken();
        try {
          const response = await fetch(`${apiPrefix}/quotations/${quotationId}/send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.emailSent) {
              showAlert({
                type: 'success',
                title: 'Quotation Sent! 📧',
                message: `Quotation ${quotation.quotationNumber} sent successfully to ${quotation.customer.email}`,
                duration: 6000,
              });
            } else {
              showAlert({
                type: 'warning',
                title: 'Quotation Status Updated',
                message: `Quotation marked as sent but email failed: ${data.emailError || 'Unknown error'}`,
                duration: 8000,
              });
            }
            if (onSuccess) onSuccess();
            onClose();
          } else {
            const data = await response.json();
            showAlert({
              type: 'error',
              title: 'Error',
              message: data.error || 'Failed to send quotation',
            });
          }
        } catch (error) {
          console.error('Error sending quotation:', error);
          showAlert({
            type: 'error',
            title: 'Error',
            message: 'Network error while sending quotation',
          });
        } finally {
          setSending(false);
        }
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            View Quotation
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : quotation ? (
            <div className="space-y-6">
              {/* Quotation Header */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">
                      {quotation.quotationNumber}
                    </h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(quotation.status)}`}>
                      {quotation.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Date</div>
                    <div className="font-semibold text-gray-900">
                      {new Date(quotation.quotationDate).toLocaleDateString('en-IN')}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">Valid Until</div>
                    <div className="font-semibold text-gray-900">
                      {new Date(quotation.validUntil).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-3 text-lg">Customer Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Name</div>
                    <div className="font-medium text-gray-900">{quotation.customer.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Email</div>
                    <div className="font-medium text-gray-900">{quotation.customer.email || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Phone</div>
                    <div className="font-medium text-gray-900">{quotation.customer.phone || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Payment Terms</div>
                    <div className="font-medium text-gray-900">{quotation.paymentTerms} days</div>
                  </div>
                </div>
                {quotation.customer.address && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600">Address</div>
                    <div className="font-medium text-gray-900">{quotation.customer.address}</div>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-lg">Items</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">SKU</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Qty</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Tax %</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Discount %</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {quotation.lines.map((line, index) => {
                        const lineSubtotal = parseFloat(line.quantity) * parseFloat(line.unitPrice);
                        const discount = lineSubtotal * (parseFloat(line.discount) / 100);
                        const afterDiscount = lineSubtotal - discount;
                        const tax = afterDiscount * (parseFloat(line.taxRate) / 100);
                        const lineTotal = afterDiscount + tax;

                        return (
                          <tr key={line.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 text-sm">
                              <div className="font-medium text-gray-900">{line.product?.name || line.description}</div>
                              {line.description && line.description !== line.product?.name && (
                                <div className="text-xs text-gray-500 mt-1">{line.description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{line.product?.sku || '—'}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{parseFloat(line.quantity).toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">₹{parseFloat(line.unitPrice).toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{parseFloat(line.taxRate).toFixed(2)}%</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{parseFloat(line.discount).toFixed(2)}%</td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-end">
                  <div className="w-80 space-y-3">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">₹{parseFloat(quotation.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Tax Amount:</span>
                      <span className="font-semibold">₹{parseFloat(quotation.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-bold text-gray-900">
                      <span>Total Amount:</span>
                      <span className="text-blue-600">₹{parseFloat(quotation.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {quotation.notes && (
                <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="text-sm text-gray-500 text-center">
                Created on {new Date(quotation.createdAt).toLocaleString('en-IN')}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Failed to load quotation
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {quotation && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Print / Download
              </button>
            </div>
            <div className="flex gap-3">
              {quotation.status === 'draft' && (
                <button
                  onClick={handleSendQuotation}
                  disabled={sending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send to Customer
                    </>
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
