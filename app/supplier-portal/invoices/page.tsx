'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAlert } from '@/components/common/CustomAlert';

interface AcceptedQuotation {
  id: string;
  submission_number: string;
  total_amount: string;
  submission_date: string;
  rfq_number?: string;
  po_number?: string;
  manual_quotation_data?: any;
}

export default function SupplierInvoicesPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<'create' | 'list'>('list');
  const [acceptedQuotations, setAcceptedQuotations] = useState<AcceptedQuotation[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedQuotation, setSelectedQuotation] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<string>('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    fetchAcceptedQuotations();
    fetchInvoices();
  }, []);

  const fetchAcceptedQuotations = async () => {
    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch('/api/supplier-portal/quotations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('All quotations:', data.quotations);
        // Filter accepted quotations on client side
        const accepted = (data.quotations || []).filter((q: any) => q.status === 'accepted');
        console.log('Accepted quotations:', accepted);
        
        // Log each quotation's total_amount
        accepted.forEach((q: any) => {
          console.log(`Quotation ${q.submission_number}: total_amount =`, q.total_amount, typeof q.total_amount);
        });
        
        setAcceptedQuotations(accepted);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch('/api/supplier-portal/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showAlert({ type: 'error', title: 'Error', message: 'File size must be less than 10MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setInvoiceFile(reader.result as string);
      setInvoiceFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const calculateTotal = () => {
    const sub = parseFloat(subtotal || '0');
    const tax = parseFloat(taxAmount || '0');
    const shipping = parseFloat(shippingCharges || '0');
    const discount = parseFloat(discountAmount || '0');
    return sub + tax + shipping - discount;
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedQuotation || !dueDate || !subtotal) {
      showAlert({ type: 'error', title: 'Error', message: 'Please fill all required fields' });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch('/api/supplier-portal/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quotationId: selectedQuotation,
          dueDate,
          subtotal: parseFloat(subtotal),
          taxAmount: parseFloat(taxAmount || '0'),
          shippingCharges: parseFloat(shippingCharges || '0'),
          discountAmount: parseFloat(discountAmount || '0'),
          totalAmount: calculateTotal(),
          paymentTerms,
          invoiceFile,
          invoiceFileName,
          notes,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Invoice created successfully!' });
        setTab('list');
        fetchInvoices();
        // Reset form
        setSelectedQuotation('');
        setDueDate('');
        setSubtotal('');
        setTaxAmount('');
        setShippingCharges('');
        setDiscountAmount('');
        setPaymentTerms('');
        setNotes('');
        setInvoiceFile('');
        setInvoiceFileName('');
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create invoice' });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      partially_paid: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Partially Paid' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
      overdue: { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue' },
    };
    const c = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  const handleSendInvoice = async (invoiceId: string) => {
    if (!confirm('Send this invoice to the purchasing department?')) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('supplierToken');
      const response = await fetch(`/api/supplier-portal/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Invoice sent successfully!' });
        fetchInvoices();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to send invoice' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send invoice' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
            </div>
            <button
              onClick={() => router.push('/supplier-portal/dashboard')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition text-sm font-medium"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setTab('list')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                tab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              My Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setTab('create')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                tab === 'create'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Invoice
            </button>
          </div>
        </div>

        {/* Create Invoice Tab */}
        {tab === 'create' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <form onSubmit={handleCreateInvoice}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Select Quotation */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Accepted Quotation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedQuotation}
                    onChange={(e) => {
                      setSelectedQuotation(e.target.value);
                      const q = acceptedQuotations.find(q => q.id === e.target.value);
                      if (q && q.total_amount) {
                        setSubtotal(q.total_amount);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select quotation...</option>
                    {acceptedQuotations.map((q) => {
                      const submissionNum = q.submission_number || `QT-${q.id?.slice(0,8) || 'DRAFT'}`;
                      
                      // Try to get amount from total_amount or calculate from manual_quotation_data
                      let amount = 0;
                      if (q.total_amount) {
                        const parsed = parseFloat(String(q.total_amount));
                        if (!isNaN(parsed)) {
                          amount = parsed;
                        }
                      }
                      
                      // If still 0, try to calculate from manual_quotation_data
                      if (amount === 0 && q.manual_quotation_data) {
                        try {
                          const items = Array.isArray(q.manual_quotation_data) 
                            ? q.manual_quotation_data 
                            : JSON.parse(q.manual_quotation_data);
                          
                          if (Array.isArray(items)) {
                            items.forEach((item: any) => {
                              const qty = parseFloat(item.quantity || 0);
                              const price = parseFloat(item.unitPrice || 0);
                              const tax = parseFloat(item.taxRate || 0);
                              const discount = parseFloat(item.discount || 0);
                              const subtotal = qty * price;
                              const taxAmt = (subtotal * tax) / 100;
                              amount += subtotal + taxAmt - discount;
                            });
                          }
                        } catch (e) {
                          console.error('Error parsing manual_quotation_data:', e);
                        }
                      }
                      
                      const displayAmount = amount > 0 
                        ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0.00';
                      
                      return (
                        <option key={q.id} value={q.id}>
                          {submissionNum} - ₹{displayAmount}
                          {q.rfq_number && ` (RFQ: ${q.rfq_number})`}
                          {q.po_number && ` (PO: ${q.po_number})`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="net_30">Net 30 Days</option>
                    <option value="net_15">Net 15 Days</option>
                    <option value="net_7">Net 7 Days</option>
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="advance">Advance Payment</option>
                  </select>
                </div>

                {/* Amounts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtotal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Charges</label>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingCharges}
                    onChange={(e) => setShippingCharges(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Total */}
                <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-700">Total Amount:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Invoice File */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Invoice Document (PDF/Word/Image)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {invoiceFileName && (
                    <p className="text-sm text-green-600 mt-2">✓ {invoiceFileName}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes or payment instructions..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setTab('list')}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invoice List Tab */}
        {tab === 'list' && (
          <div className="bg-white rounded-lg border border-gray-200">
            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">No invoices created yet</p>
                <button
                  onClick={() => setTab('create')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create Your First Invoice
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{parseFloat(invoice.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        ₹{parseFloat(invoice.paid_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">{getPaymentStatusBadge(invoice.payment_status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowViewModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            View
                          </button>
                          {invoice.source === 'manual' && invoice.payment_status === 'pending' && (
                            <button 
                              onClick={() => handleSendInvoice(invoice.id)}
                              className="text-green-600 hover:text-green-700 text-sm font-medium"
                            >
                              Send
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedInvoice.invoice_number}</p>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Invoice Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <div className="mt-1">{getPaymentStatusBadge(selectedInvoice.payment_status)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Source</p>
                  <p className="font-medium">{selectedInvoice.source === 'auto' ? 'Auto-Generated' : 'Manual'}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold mb-3">Financial Breakdown</h3>
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{parseFloat(selectedInvoice.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">₹{parseFloat(selectedInvoice.tax_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-medium">₹{parseFloat(selectedInvoice.shipping_charges || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-red-600">-₹{parseFloat(selectedInvoice.discount_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">Total Amount:</span>
                    <span className="font-bold text-lg">₹{parseFloat(selectedInvoice.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Paid Amount:</span>
                    <span className="font-medium text-green-600">₹{parseFloat(selectedInvoice.paid_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Balance Due:</span>
                    <span className="font-bold text-red-600">
                      ₹{(parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.paid_amount || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {selectedInvoice.payment_terms && (
                <div>
                  <p className="text-sm text-gray-600">Payment Terms</p>
                  <p className="font-medium">{selectedInvoice.payment_terms}</p>
                </div>
              )}

              {selectedInvoice.notes && (
                <div>
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="text-sm mt-1">{selectedInvoice.notes}</p>
                </div>
              )}

              {selectedInvoice.invoice_file_url && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Attached Invoice</p>
                  <a
                    href={selectedInvoice.invoice_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    📎 {selectedInvoice.invoice_file_name || 'View Invoice File'}
                  </a>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedInvoice(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>
              {selectedInvoice.source === 'manual' && selectedInvoice.payment_status === 'pending' && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleSendInvoice(selectedInvoice.id);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Send Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}    </div>
  );
}