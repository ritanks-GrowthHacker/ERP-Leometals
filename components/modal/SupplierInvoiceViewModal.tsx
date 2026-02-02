'use client';

interface SupplierInvoiceViewModalProps {
  isOpen: boolean;
  invoice: any;
  onClose: () => void;
  onMarkPaid?: () => void;
  showActions?: boolean;
}

export default function SupplierInvoiceViewModal({
  isOpen,
  invoice,
  onClose,
  onMarkPaid,
  showActions = true,
}: SupplierInvoiceViewModalProps) {
  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      partially_paid: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900">
            Invoice Details: {invoice.invoice_number}
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
              <div className="text-sm text-gray-500">Invoice Number</div>
              <div className="font-semibold">{invoice.invoice_number}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  invoice.payment_status
                )}`}
              >
                {invoice.payment_status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Supplier</div>
              <div className="font-semibold">{invoice.supplier_name}</div>
              <div className="text-xs text-gray-500">{invoice.supplier_code}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Invoice Date</div>
              <div className="font-semibold">
                {new Date(invoice.invoice_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Due Date</div>
              <div className="font-semibold">
                {invoice.due_date
                  ? new Date(invoice.due_date).toLocaleDateString()
                  : '—'}
              </div>
            </div>
            {invoice.quotation_number && (
              <div>
                <div className="text-sm text-gray-500">Quotation</div>
                <div className="font-semibold">{invoice.quotation_number}</div>
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div>
            <h4 className="font-semibold mb-3">Financial Details</h4>
            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  ₹{parseFloat(invoice.subtotal || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax Amount:</span>
                <span className="font-medium">
                  ₹{parseFloat(invoice.tax_amount || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping Charges:</span>
                <span className="font-medium">
                  ₹{parseFloat(invoice.shipping_charges || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">
                  -₹{parseFloat(invoice.discount_amount || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="text-lg font-semibold">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₹{parseFloat(invoice.total_amount || '0').toLocaleString('en-IN')}
                </span>
              </div>
              {invoice.payment_status === 'paid' && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-green-600">
                    <span className="font-medium">Paid Amount:</span>
                    <span className="font-bold">
                      ₹{parseFloat(invoice.paid_amount || '0').toLocaleString('en-IN')}
                    </span>
                  </div>
                  {invoice.payment_date && (
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Payment Date:</span>
                      <span>{new Date(invoice.payment_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {invoice.payment_method && (
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Payment Method:</span>
                      <span className="capitalize">{invoice.payment_method.replace('_', ' ')}</span>
                    </div>
                  )}
                  {invoice.payment_reference && (
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Reference:</span>
                      <span>{invoice.payment_reference}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded text-sm">
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {showActions && invoice.payment_status !== 'paid' && invoice.payment_status !== 'cancelled' && (
            <button
              onClick={onMarkPaid}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              💰 Mark as Paid
            </button>
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
