'use client';

import { X, Calendar, DollarSign, FileText, User } from 'lucide-react';
import { useState } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  subtotal: string;
  taxAmount: string;
  currencyCode: string;
  paymentTerms?: number;
  notes?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    product?: {
      name: string;
    };
  }>;
}

interface SalesInvoiceViewModalProps {
  isOpen: boolean;
  invoice: SalesInvoice | null;
  onClose: () => void;
  onEdit?: () => void;
  onUpdate?: () => void;
}

export default function SalesInvoiceViewModal({
  isOpen,
  invoice,
  onClose,
  onEdit,
  onUpdate,
}: SalesInvoiceViewModalProps) {
  const { showAlert } = useAlert();
  const [marking, setMarking] = useState(false);

  if (!isOpen || !invoice) return null;

  const handleSend = async () => {
    if (!invoice?.customer?.email) {
      showAlert({ type: 'error', title: 'Error', message: 'Customer email not found' });
      return;
    }

    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/sales/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'send' }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Invoice sent successfully!' });
        onUpdate?.();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to send invoice' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send invoice' });
    }
  };

  const handleDownload = async () => {
    const token = getAuthToken();
    try {
      const response = await fetch(`/api/erp/sales/invoices/${invoice.id}?action=download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const html = await response.text();
        
        // Open HTML in new window for printing/saving
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          
          // Optional: Auto-trigger print dialog
          setTimeout(() => {
            printWindow.print();
          }, 250);
        }
        
        showAlert({ type: 'success', title: 'Success', message: 'Invoice opened in new window' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to download invoice' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to download invoice' });
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    const token = getAuthToken();
    setMarking(true);

    try {
      const response = await fetch(`/api/erp/sales/invoices/${invoice.id}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paidAmount: invoice.totalAmount,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'manual',
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Invoice marked as paid' });
        onUpdate?.();
        onClose();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.message || 'Failed to mark as paid' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to mark as paid' });
    } finally {
      setMarking(false);
    }
  }
  if (!isOpen || !invoice) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const calculateLineTotal = (quantity: string, unitPrice: string, taxRate: string) => {
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice);
    const tax = parseFloat(taxRate || '0');
    return (qty * price * (1 + tax / 100)).toFixed(2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
    {/* Header */}
    <div className="shrink-0 bg-linear-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
      <div>
        <h2 className="text-xl font-bold">Sales Invoice</h2>
        <p className="text-sm text-blue-100 mt-1">{invoice.invoiceNumber}</p>
      </div>
      <button
        onClick={onClose}
        className="text-white hover:bg-blue-500 rounded-full p-2 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>
    </div>

    {/* Scrollable Content */}
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Status and Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Customer Details</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Name:</span>
              <p className="font-medium text-gray-900">{invoice.customer.name}</p>
            </div>
            {invoice.customer.email && (
              <div>
                <span className="text-sm text-gray-500">Email:</span>
                <p className="text-sm text-gray-900">{invoice.customer.email}</p>
              </div>
            )}
            {invoice.customer.phone && (
              <div>
                <span className="text-sm text-gray-500">Phone:</span>
                <p className="text-sm text-gray-900">{invoice.customer.phone}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Invoice Details</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Invoice Date:</span>
              <span className="text-sm font-medium">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Due Date:</span>
              <span className="text-sm font-medium">{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</span>
            </div>
            {invoice.paymentTerms && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Payment Terms:</span>
                <span className="text-sm font-medium">{invoice.paymentTerms} days</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Invoice Items</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Product</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Tax Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.lines?.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{line.product?.name || 'N/A'}</div>
                    {line.description && (
                      <div className="text-xs text-gray-500 mt-1">{line.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{parseFloat(line.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">₹{parseFloat(line.unitPrice).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.taxRate || 0}%</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    ₹{parseFloat(calculateLineTotal(line.quantity, line.unitPrice, line.taxRate)).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-lg p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">₹{parseFloat(invoice.subtotal).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax Amount:</span>
            <span className="font-medium">₹{parseFloat(invoice.taxAmount).toLocaleString('en-IN')}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-base font-semibold">
            <span className="text-gray-900">Total Amount:</span>
            <span className="text-blue-600">₹{parseFloat(invoice.totalAmount).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Paid Amount:</span>
            <span className="font-medium text-green-600">₹{parseFloat(invoice.paidAmount || '0').toLocaleString('en-IN')}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-base font-semibold">
            <span className="text-red-600">Balance Due:</span>
            <span className="text-red-600">₹{parseFloat(invoice.balanceAmount || invoice.totalAmount).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
          <p className="text-sm text-gray-600">{invoice.notes}</p>
        </div>
      )}
    </div>

    {/* Footer Actions */}
    <div className="shrink-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 rounded-b-xl">
      {/* <button
        onClick={onClose}
        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Close
      </button> */}
      <button
        onClick={handleDownload}
        className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
      >
        Download PDF
      </button>
      {invoice.status === 'draft' && (
        <button
          onClick={handleSend}
          className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          Send to Customer
        </button>
      )}
      {invoice.status !== 'paid' && (
        <button
          onClick={handleMarkAsPaid}
          disabled={marking}
          className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {marking ? 'Marking...' : 'Mark as Paid'}
        </button>
      )}
      {/* {onEdit && (
        <button
          onClick={onEdit}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Edit Invoice
        </button>
      )} */}
    </div>
  </div>
</div>
  );
}
