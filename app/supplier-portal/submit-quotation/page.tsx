'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAlert } from '@/components/common/CustomAlert';

interface RFQ {
  id: string;
  rfqNumber: string;
  dueDate?: string;
  deadline?: string;
  title: string;
}

interface RFQLine {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_requested: string;
  target_price: string;
  description: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
}

function SubmitQuotationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [quotationType, setQuotationType] = useState<'file_upload' | 'manual_entry'>('manual_entry');
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [rfqLines, setRfqLines] = useState<RFQLine[]>([]);
  const [loadingRFQ, setLoadingRFQ] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    rfqId: '',
    purchaseOrderId: '',
    totalAmount: '',
    validityDays: '',
    deliveryLeadTime: '',
    paymentTerms: '',
    notes: '',
    termsAndConditions: '',
  });

  // Manual entry state
  const [manualItems, setManualItems] = useState<Array<{
    productName: string;
    productId?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    discount: string;
  }>>([
    { productName: '', quantity: '', unitPrice: '', taxRate: '', discount: '' },
  ]);

  useEffect(() => {
    const token = localStorage.getItem('supplierToken');
    if (!token) {
      router.push('/supplier-portal');
      return;
    }

    // Fetch purchase orders sent to this supplier
    fetchPurchaseOrders(token);

    // Check if RFQ ID is in URL
    const rfqId = searchParams.get('rfq_id');
    if (rfqId) {
      setFormData(prev => ({ ...prev, rfqId }));
      fetchRFQDetails(rfqId, token);
      setQuotationType('manual_entry'); // Force manual entry for RFQ quotes
    }
  }, [searchParams]);

  const fetchPurchaseOrders = async (token: string) => {
    try {
      const response = await fetch('/api/supplier-portal/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data.purchaseOrders || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchRFQDetails = async (rfqId: string, token: string) => {
    try {
      setLoadingRFQ(true);
      
      // Fetch RFQ lines
      const response = await fetch(`/api/supplier-portal/rfqs/${rfqId}/lines`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRfqLines(data.lines || []);
        
        // Pre-fill manual items from RFQ lines
        const items = data.lines.map((line: RFQLine) => ({
          productName: line.product_name,
          productId: line.product_id,
          quantity: line.quantity_requested,
          unitPrice: line.target_price || '',
          taxRate: '18',
          discount: '0',
        }));
        setManualItems(items.length > 0 ? items : [{ productName: '', quantity: '', unitPrice: '', taxRate: '', discount: '' }]);
      }
    } catch (error) {
      console.error('Error fetching RFQ details:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load RFQ details' });
    } finally {
      setLoadingRFQ(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showAlert({ type: 'error', title: 'Error', message: 'File must be less than 10MB' });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (!allowedTypes.includes(file.type)) {
      showAlert({ type: 'error', title: 'Error', message: 'Only PDF, Word documents, and images are allowed' });
      return;
    }

    setSelectedFile(file);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const addManualItem = () => {
    setManualItems([
      ...manualItems,
      { productName: '', quantity: '', unitPrice: '', taxRate: '', discount: '' },
    ]);
  };

  const removeManualItem = (index: number) => {
    setManualItems(manualItems.filter((_, i) => i !== index));
  };

  const updateManualItem = (index: number, field: string, value: string) => {
    const updated = [...manualItems];
    updated[index] = { ...updated[index], [field]: value };
    setManualItems(updated);
  };

  const calculateTotal = () => {
    return manualItems.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const discount = parseFloat(item.discount) || 0;

      const subtotal = quantity * unitPrice;
      const afterDiscount = subtotal - (subtotal * discount) / 100;
      const withTax = afterDiscount + (afterDiscount * taxRate) / 100;

      return total + withTax;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem('supplierToken');

    try {
      let fileData: any = null;

      if (quotationType === 'file_upload') {
        if (!selectedFile) {
          showAlert({ type: 'error', title: 'Error', message: 'Please select a file to upload' });
          setLoading(false);
          return;
        }

        // Convert file to base64
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        fileData = {
          fileUrl: reader.result as string,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        };
      }

      const payload = {
        quotationType,
        rfqId: formData.rfqId || null,
        purchaseOrderId: formData.purchaseOrderId || null,
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : quotationType === 'manual_entry' ? calculateTotal() : null,
        validityDays: formData.validityDays ? parseInt(formData.validityDays) : null,
        deliveryTimeInDays: formData.deliveryLeadTime ? parseInt(formData.deliveryLeadTime) : null,
        paymentTerms: formData.paymentTerms || null,
        notes: formData.notes || null,
        termsAndConditions: formData.termsAndConditions || null,
        ...(quotationType === 'file_upload' ? fileData : {}),
        ...(quotationType === 'manual_entry' ? { manualQuotationData: manualItems } : {}),
      };

      const response = await fetch('/api/supplier-portal/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Quotation submitted successfully' });
        router.push('/supplier-portal/dashboard');
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to submit quotation' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to submit quotation' });
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
                <span className="text-white text-sm font-bold">SP</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Submit Quotation</h1>
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          {/* RFQ Context Banner */}
          {selectedRFQ && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-1">Creating Quotation for RFQ</h3>
                  <p className="text-sm text-purple-800">
                    <span className="font-medium">{selectedRFQ.title}</span>
                    {(selectedRFQ.deadline || selectedRFQ.dueDate) && (
                      <> • Deadline: {new Date(selectedRFQ.deadline || selectedRFQ.dueDate!).toLocaleDateString()}</>
                    )}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Products have been pre-filled from the RFQ. Please enter your pricing for each item.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quotation Type Selection */}
          {!selectedRFQ && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotation Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setQuotationType('file_upload')}
                  className={`p-6 border-2 rounded-lg transition ${
                    quotationType === 'file_upload'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-3">
                    <svg className={`w-12 h-12 ${quotationType === 'file_upload' ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Upload File</h3>
                  <p className="text-sm text-gray-600">Upload PDF, Word, or Image</p>
                </button>

                <button
                  type="button"
                  onClick={() => setQuotationType('manual_entry')}
                  className={`p-6 border-2 rounded-lg transition ${
                    quotationType === 'manual_entry'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-3">
                    <svg className={`w-12 h-12 ${quotationType === 'manual_entry' ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Manual Entry</h3>
                  <p className="text-sm text-gray-600">Enter quotation details manually</p>
                </button>
              </div>
            </div>
          )}

          {/* Purchase Order Selection */}
          {!selectedRFQ && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Reference</h2>
              <p className="text-sm text-gray-600 mb-4">
                Select a purchase order to submit your quotation against (optional for RFQ-based quotations)
              </p>
              {purchaseOrders.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-600">No purchase orders available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Purchase orders will appear here when sent to you by the company
                  </p>
                </div>
              ) : (
                <select
                  value={formData.purchaseOrderId}
                  onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="">Select a Purchase Order (Optional)</option>
                  {purchaseOrders.map((po: any) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {new Date(po.po_date).toLocaleDateString()} - ₹{parseFloat(po.total_amount || 0).toLocaleString('en-IN')} {po.quotation_count > 0 ? '(Already Quoted)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* File Upload Section */}
          {quotationType === 'file_upload' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {!selectedFile ? (
                  <div>
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-block">
                        Choose File
                      </span>
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="text-sm text-gray-600 mt-2">PDF, Word, or Image (max 10MB)</p>
                  </div>
                ) : (
                  <div>
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="max-w-md mx-auto mb-4 rounded-lg" />
                    ) : (
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-sm text-gray-600">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Remove File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Entry Section */}
          {quotationType === 'manual_entry' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Quotation Items</h2>
                {!selectedRFQ && (
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    + Add Item
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {manualItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">Item {index + 1}</h3>
                        {selectedRFQ && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            From RFQ
                          </span>
                        )}
                      </div>
                      {manualItems.length > 1 && !selectedRFQ && (
                        <button
                          type="button"
                          onClick={() => removeManualItem(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateManualItem(index, 'productName', e.target.value)}
                          required
                          disabled={!!selectedRFQ}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                            selectedRFQ ? 'bg-gray-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="Enter product name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                          {selectedRFQ && <span className="text-xs text-gray-500 ml-1">(Requested)</span>}
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateManualItem(index, 'quantity', e.target.value)}
                          required
                          disabled={!!selectedRFQ}
                          min="0"
                          step="0.01"
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
                            selectedRFQ ? 'bg-gray-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₹)</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateManualItem(index, 'unitPrice', e.target.value)}
                          required
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                        <input
                          type="number"
                          value={item.taxRate}
                          onChange={(e) => updateManualItem(index, 'taxRate', e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => updateManualItem(index, 'discount', e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quotationType === 'file_upload' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Validity (Days)</label>
                <input
                  type="number"
                  value={formData.validityDays}
                  onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Lead Time (Days)</label>
                <input
                  type="number"
                  value={formData.deliveryLeadTime}
                  onChange={(e) => setFormData({ ...formData, deliveryLeadTime: e.target.value })}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="7"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="e.g., Net 30"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Any additional notes or comments"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Terms and Conditions</label>
                <textarea
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter your terms and conditions"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/supplier-portal/dashboard')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Quotation'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function SubmitQuotation() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-600">Loading quotation form...</p>
        </div>
      </div>
    }>
      <SubmitQuotationContent />
    </Suspense>
  );
}
