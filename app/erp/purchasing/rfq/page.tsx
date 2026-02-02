'use client';

import { useState, useEffect } from 'react';

import { getAuthToken } from '@/lib/utils/token';
import RFQModal from '@/components/modal/RFQModal';
import { useAlert } from '@/components/common/CustomAlert';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';
import { LoadingSpinner, ButtonLoader } from '@/components/common/LoadingSpinner';

interface RFQ {
  id: string;
  rfqNumber: string;
  rfq_number?: string;
  rfqDate: string;
  rfq_date?: string;
  deadlineDate: string;
  deadline_date?: string;
  title: string;
  status: string;
  suppliers: any[];
  lines: any[];
  quotationsCount?: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface RFQLine {
  productId: string;
  productName: string;
  quantityRequested: string;
  targetPrice: string;
  description: string;
}

export default function RFQPage() {
  const { showAlert , showConfirm } = useAlert();
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<any>(null);
  const [sendingRFQ, setSendingRFQ] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [receivedQuotationsCount, setReceivedQuotationsCount] = useState(0);
  
  const [rfqLines, setRFQLines] = useState<RFQLine[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadlineDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchRFQs();
    fetchProducts();
    fetchSuppliers();
    fetchReceivedQuotations();
  }, []);

  const fetchReceivedQuotations = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/supplier-quotations?status=submitted', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReceivedQuotationsCount(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching received quotations:', error);
    }
  };

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/rfq', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRFQs(data.rfqs || []);
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/inventory/products', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/suppliers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const addLineItem = () => {
    setRFQLines([...rfqLines, {
      productId: '',
      productName: '',
      quantityRequested: '1',
      targetPrice: '',
      description: '',
    }]);
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...rfqLines];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].productName = product.name;
        updated[index].description = product.name;
        updated[index].targetPrice = product.costPrice || '';
      }
    }
    
    setRFQLines(updated);
  };

  const removeLineItem = (index: number) => {
    setRFQLines(rfqLines.filter((_, i) => i !== index));
  };

  const toggleSupplier = (supplierId: string) => {
    if (selectedSuppliers.includes(supplierId)) {
      setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplierId));
    } else {
      setSelectedSuppliers([...selectedSuppliers, supplierId]);
    }
  };

  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || rfqLines.length === 0 || selectedSuppliers.length === 0) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fill in title, add items, and select at least one supplier' });
      return;
    }
    
    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/purchasing/rfq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          lines: rfqLines.map(line => ({
            productId: line.productId,
            quantityRequested: parseFloat(line.quantityRequested),
            targetPrice: line.targetPrice ? parseFloat(line.targetPrice) : null,
            description: line.description,
          })),
          supplierIds: selectedSuppliers,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'RFQ created successfully!' });
        setShowCreateModal(false);
        resetForm();
        fetchRFQs();
      } else {
        const data = await response.json();
        showAlert({ type: 'error', title: 'Error', message: data.error });
      }
    } catch (error) {
      console.error('Error creating RFQ:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create RFQ' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      deadlineDate: '',
      notes: '',
    });
    setRFQLines([]);
    setSelectedSuppliers([]);
  };

  const handleSendRFQ = async (rfqId: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Send RFQ',
      message: 'Send this RFQ to all invited suppliers via email?',
      confirmText: 'Send RFQ',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setSendingRFQ(rfqId);
          setShowEmailAnimation(true); // Show animation immediately
          const response = await fetch(`/api/erp/purchasing/rfq/${rfqId}/send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setTimeout(() => {
              setShowEmailAnimation(false);
              showAlert({ type: 'success', title: 'Success', message: data.message });
              fetchRFQs(); // Refresh to show updated status
            }, 2000);
          } else {
            setShowEmailAnimation(false);
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          setShowEmailAnimation(false);
          console.error('Error sending RFQ:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to send RFQ' });
        } finally {
          setSendingRFQ(null);
        }
      }
    });
  };

  const handleViewRFQ = async (rfqId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/rfq/${rfqId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedRFQ(data.rfq);
        setShowViewModal(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQ details' });
      }
    } catch (error) {
      console.error('Error fetching RFQ:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch RFQ details' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      closed: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleViewQuotation = async (quotationId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/erp/purchasing/supplier-quotations/${quotationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // For now, just show alert with basic info
        // TODO: Create detailed quotation view modal
        showAlert({
          type: 'info',
          title: 'Quotation Details',
          message: `Quotation from ${data.quotation.supplier_name}\nTotal: ₹${parseFloat(data.quotation.total_amount).toLocaleString('en-IN')}\nStatus: ${data.quotation.status}`,
        });
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to fetch quotation details' });
      }
    } catch (error) {
      console.error('Error viewing quotation:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to view quotation' });
    }
  };

  const handleAcceptQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Accept Quotation',
      message: 'Are you sure you want to accept this quotation? This will automatically generate an invoice.',
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const response = await fetch(`/api/erp/purchasing/supplier-quotations/${quotationId}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            showAlert({ type: 'success', title: 'Success', message: data.message });
            // Refresh both RFQ details AND the main list to update stats
            await fetchRFQs();
            await handleViewRFQ(selectedRFQ.id);
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error accepting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to accept quotation' });
        }
      },
    });
  };

  const handleRejectQuotation = async (quotationId: string) => {
    showConfirm({
      title: 'Reject Quotation',
      message: 'Are you sure you want to reject this quotation?',
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const response = await fetch(`/api/erp/purchasing/supplier-quotations/${quotationId}/reject`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ rejectionReason: 'Declined by purchaser' }),
          });

          if (response.ok) {
            const data = await response.json();
            showAlert({ type: 'success', title: 'Success', message: data.message });
            handleViewRFQ(selectedRFQ.id); // Refresh RFQ details
          } else {
            const data = await response.json();
            showAlert({ type: 'error', title: 'Error', message: data.error });
          }
        } catch (error) {
          console.error('Error rejecting quotation:', error);
          showAlert({ type: 'error', title: 'Error', message: 'Failed to reject quotation' });
        }
      },
    });
  };

  return (
    <div className="p-6">
      {/* Loading Overlay */}
      {loading && <LoadingSpinner size="lg" message="Loading RFQs..." fullScreen />}
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Request for Quotations (RFQ)</h2>
          <p className="text-sm text-gray-500 mt-1">Request quotes from multiple suppliers</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Create RFQ
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Draft</div>
          <div className="text-2xl font-bold text-gray-600">
            {rfqs.filter(r => r.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Sent</div>
          <div className="text-2xl font-bold text-blue-600">
            {rfqs.filter(r => r.status === 'sent' || r.status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {rfqs.filter(r => r.status === 'closed' || r.status === 'received').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">Quotes Received</div>
          <div className="text-2xl font-bold text-purple-600">
            {rfqs.reduce((sum, r) => sum + (r.quotationsCount || 0), 0)}
          </div>
        </div>
      </div>

      {/* RFQ Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Request for Quotations</h3>
          <input placeholder="Search RFQs..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading RFQs...
            </div>
          ) : rfqs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No RFQs found. Create your first request for quotation.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">RFQ #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Suppliers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Quotes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rfq.rfqNumber || rfq.rfq_number || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rfq.rfqDate || rfq.rfq_date ? new Date((rfq.rfqDate || rfq.rfq_date)!).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rfq.deadlineDate || rfq.deadline_date ? new Date((rfq.deadlineDate || rfq.deadline_date)!).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.suppliers?.length || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.lines?.length || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (rfq.quotationsCount || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rfq.quotationsCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rfq.status)}`}>
                        {rfq.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2 items-center">
                        {rfq.status === 'draft' && (
                          <button
                            onClick={() => handleSendRFQ(rfq.id)}
                            disabled={sendingRFQ === rfq.id}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 disabled:opacity-50"
                          >
                            {sendingRFQ === rfq.id ? <><ButtonLoader /> Sending</> : '📧 Send'}
                          </button>
                        )}
                        {rfq.status === 'sent' && (
                          <>
                            <span className="text-green-600 text-sm flex items-center">✓ Sent</span>
                            <button
                              onClick={() => handleSendRFQ(rfq.id)}
                              disabled={sendingRFQ === rfq.id}
                              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                              {sendingRFQ === rfq.id ? <><ButtonLoader /> Resending</> : '🔄 Resend'}
                            </button>
                          </>
                        )}
                        <button onClick={() => handleViewRFQ(rfq.id)} className="text-blue-600 hover:text-blue-800 font-medium">View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View RFQ Modal */}
      {showViewModal && selectedRFQ && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-xl font-semibold text-gray-900">RFQ Details: {selectedRFQ.rfqNumber}</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <div className="text-sm text-gray-500">RFQ Number</div>
                  <div className="font-semibold">{selectedRFQ.rfqNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRFQ.status)}`}>
                    {selectedRFQ.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">RFQ Date</div>
                  <div className="font-semibold">{new Date(selectedRFQ.rfqDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Deadline</div>
                  <div className="font-semibold">
                    {selectedRFQ.deadlineDate ? new Date(selectedRFQ.deadlineDate).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              {/* Title and Description */}
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedRFQ.title}</h3>
                {selectedRFQ.description && (
                  <p className="text-gray-600">{selectedRFQ.description}</p>
                )}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-semibold mb-3">Requested Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Quantity</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Target Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedRFQ.lines && selectedRFQ.lines.map((line: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{line.product?.name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{line.description || '—'}</td>
                          <td className="px-4 py-3 text-sm text-right">{parseFloat(line.quantityRequested).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {line.targetPrice ? `₹${parseFloat(line.targetPrice).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invited Suppliers */}
              <div>
                <h4 className="font-semibold mb-3">Invited Suppliers ({selectedRFQ.suppliers?.length || 0})</h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedRFQ.suppliers && selectedRFQ.suppliers.map((supplier: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="font-medium">{supplier.supplier?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{supplier.supplier?.code || '—'}</div>
                      <div className="text-sm text-gray-600 mt-1">{supplier.supplier?.email || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Received Quotations */}
              {selectedRFQ.quotations && selectedRFQ.quotations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Received Quotations ({selectedRFQ.quotations.length})</h4>
                  <div className="space-y-3">
                    {selectedRFQ.quotations.map((quote: any) => (
                      <div key={quote.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-gray-900">{quote.supplier_name}</div>
                            <div className="text-sm text-gray-500">
                              Submitted: {new Date(quote.submission_date || quote.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            quote.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            quote.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                            quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {quote.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        
                        {quote.total_amount && (
                          <div className="mb-3">
                            <span className="text-sm text-gray-600">Total Amount: </span>
                            <span className="text-lg font-semibold text-gray-900">
                              ₹{parseFloat(quote.total_amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewQuotation(quote.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                          >
                            View Details
                          </button>
                          {quote.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => handleAcceptQuotation(quote.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRejectQuotation(quote.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedRFQ.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">{selectedRFQ.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button 
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create RFQ Modal */}
      <RFQModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchRFQs}
      />

      {/* Email Sent Animation */}
      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />
    </div>
  );
}
