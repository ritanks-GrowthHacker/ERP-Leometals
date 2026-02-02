'use client';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: string;
  tax_amount: string;
  shipping_charges: string;
  discount_amount: string;
  total_amount: string;
  currency_code: string;
  payment_status: string;
  payment_terms: string;
  notes?: string;
  quotation_number?: string;
  po_number?: string;
  supplier_name?: string;
  supplier_code?: string;
  file_url?: string;
  file_name?: string;
}

interface InvoiceViewModalProps {
  isOpen: boolean;
  invoice: Invoice;
  onClose: () => void;
  onEdit?: () => void;
  showActions?: boolean;
}

export default function InvoiceViewModal({
  isOpen,
  invoice,
  onClose,
  onEdit,
  showActions = true,
}: InvoiceViewModalProps) {
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

  const handleDownloadFile = () => {
    if (!invoice.file_url) return;

    try {
      const link = document.createElement('a');
      link.href = invoice.file_url;
      link.download = invoice.file_name || 'invoice-file';
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
            Invoice: {invoice.invoice_number}
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
            {invoice.supplier_name && (
              <div>
                <div className="text-sm text-gray-500">Supplier</div>
                <div className="font-semibold">{invoice.supplier_name}</div>
                <div className="text-xs text-gray-500">{invoice.supplier_code}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Invoice Date</div>
              <div className="font-semibold">
                {new Date(invoice.invoice_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Due Date</div>
              <div className="font-semibold">
                {new Date(invoice.due_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Payment Terms</div>
              <div className="font-semibold">{invoice.payment_terms || '—'}</div>
            </div>
          </div>

          {/* References */}
          {(invoice.quotation_number || invoice.po_number) && (
            <div>
              <h4 className="font-semibold mb-2">References</h4>
              <div className="bg-gray-50 p-3 rounded space-y-2">
                {invoice.quotation_number && (
                  <div>
                    <span className="text-sm text-gray-600">Quotation: </span>
                    <span className="font-medium">{invoice.quotation_number}</span>
                  </div>
                )}
                {invoice.po_number && (
                  <div>
                    <span className="text-sm text-gray-600">Purchase Order: </span>
                    <span className="font-medium">{invoice.po_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount Breakdown */}
          <div>
            <h4 className="font-semibold mb-2">Amount Details</h4>
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  {invoice.currency_code} {parseFloat(invoice.subtotal || '0').toLocaleString('en-IN')}
                </span>
              </div>
              {parseFloat(invoice.tax_amount || '0') > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">
                    {invoice.currency_code} {parseFloat(invoice.tax_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {parseFloat(invoice.shipping_charges || '0') > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium">
                    {invoice.currency_code} {parseFloat(invoice.shipping_charges).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {parseFloat(invoice.discount_amount || '0') > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span className="font-medium">
                    -{invoice.currency_code} {parseFloat(invoice.discount_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {invoice.currency_code} {parseFloat(invoice.total_amount || '0').toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice File */}
          {invoice.file_url && (
            <div>
              <h4 className="font-semibold mb-2">Uploaded Document</h4>
              <div className="flex items-center gap-2 bg-blue-50 p-3 rounded border border-blue-200">
                <span className="text-2xl">📄</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {invoice.file_name || 'Invoice Document'}
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
          {showActions && onEdit && invoice.payment_status === 'pending' && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              ✏️ Edit Invoice
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
