'use client';
import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { X, MapPin, User, Mail, Phone } from 'lucide-react';
import { inputFieldDesign, modalLabels } from './modalInputDesigns';
import EmailSentAnimation from '@/components/common/EmailSentAnimation';

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  warehouseAddress?: string;
  warehouseName?: string;
}

interface AssignDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  salesOrder: SalesOrder | null;
}

export default function AssignDeliveryModal({
  isOpen,
  onClose,
  onSuccess,
  salesOrder,
}: AssignDeliveryModalProps) {
  const [step, setStep] = useState(1); // 1 = form, 2 = confirmation
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showEmailAnimation, setShowEmailAnimation] = useState(false);

  // Form fields
  const [deliveryPartnerName, setDeliveryPartnerName] = useState('');
  const [deliveryPartnerMobile, setDeliveryPartnerMobile] = useState('');
  const [deliveryPartnerEmail, setDeliveryPartnerEmail] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    if (isOpen && salesOrder) {
      // Pre-fill addresses from sales order
      setPickupAddress(salesOrder.warehouseAddress || '');
      setDeliveryAddress(salesOrder.shippingAddress || '');
      setReceiverMobile(salesOrder.customerPhone || '');
      setReceiverEmail(salesOrder.customerEmail || '');
      setStep(1);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen, salesOrder]);

  const handleClose = () => {
    if (!submitting) {
      setStep(1);
      setDeliveryPartnerName('');
      setDeliveryPartnerMobile('');
      setDeliveryPartnerEmail('');
      setPickupAddress('');
      setDeliveryAddress('');
      setReceiverMobile('');
      setReceiverEmail('');
      setSpecialInstructions('');
      onClose();
    }
  };

  const handleNext = () => {
    // Validation
    setError('');
    if (!deliveryPartnerName.trim()) {
      setError('Please enter delivery partner name');
      return;
    }
    if (!deliveryPartnerMobile.trim()) {
      setError('Please enter delivery partner mobile number');
      return;
    }
    if (!deliveryPartnerEmail.trim()) {
      setError('Please enter delivery partner email');
      return;
    }
    if (!receiverMobile.trim()) {
      setError('Please enter receiver mobile number');
      return;
    }
    if (!receiverEmail.trim()) {
      setError('Please enter receiver email');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(deliveryPartnerEmail)) {
      setError('Please enter a valid delivery partner email');
      return;
    }
    if (!emailRegex.test(receiverEmail)) {
      setError('Please enter a valid receiver email');
      return;
    }

    // Phone validation (basic)
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(deliveryPartnerMobile.replace(/[\s\-\(\)]/g, ''))) {
      setError('Please enter a valid delivery partner mobile number');
      return;
    }
    if (!phoneRegex.test(receiverMobile.replace(/[\s\-\(\)]/g, ''))) {
      setError('Please enter a valid receiver mobile number');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async () => {
    if (!salesOrder) return;

    const token = getAuthToken();
    if (!token) {
      setError('No authentication token found');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/erp/sales/orders/${salesOrder.id}/assign-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deliveryPartnerName,
          deliveryPartnerMobile,
          deliveryPartnerEmail,
          pickupAddress: pickupAddress || salesOrder.warehouseAddress || '',
          deliveryAddress: deliveryAddress || salesOrder.shippingAddress || '',
          receiverMobile,
          receiverEmail,
          specialInstructions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setError(''); // Clear any previous errors
        setShowEmailAnimation(true);
        setSuccessMessage(data.message || 'Delivery partner assigned successfully! Emails sent.');
        
        // Show success message for 3 seconds before closing
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to assign delivery partner');
      }
    } catch (error) {
      console.error('Error assigning delivery partner:', error);
      setError('An error occurred while assigning delivery partner');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !salesOrder) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full ">
        {/* Header */}
        <div className="sticky top-0 rounded-t-md bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {step === 1 ? 'Assign Delivery Partner' : 'Confirm Assignment'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Order: {salesOrder.orderNumber} - {salesOrder.customerName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
       <div className="flex flex-col max-h-[80vh]">
  <div className="p-6 overflow-y-auto flex-1">
    {/* Error/Success Messages */}
    {error && (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )}
    {successMessage && (
      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
        {successMessage}
      </div>
    )}
    
    {step === 1 ? (
      <div className="space-y-6">
        {/* Delivery Partner Details */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            Delivery Partner Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={modalLabels}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deliveryPartnerName}
                onChange={(e) => setDeliveryPartnerName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                placeholder="Enter partner name"
                required
              />
            </div>
            <div>
              <label className={modalLabels}>
                Mobile <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={deliveryPartnerMobile}
                onChange={(e) => setDeliveryPartnerMobile(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                placeholder="Enter mobile number"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className={modalLabels}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={deliveryPartnerEmail}
                onChange={(e) => setDeliveryPartnerEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                placeholder="Enter email address"
                required
              />
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="border rounded-lg p-4 bg-green-50">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-green-600" />
            Pickup & Delivery Addresses
          </h3>
          <div className="space-y-4">
            <div>
              <label className={modalLabels}>
                Pickup Address (Warehouse)
              </label>
              <textarea
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                rows={2}
                placeholder="Auto-filled from warehouse, editable"
              />
              {salesOrder.warehouseName && (
                <p className="text-xs text-gray-500 mt-1">
                  Default: {salesOrder.warehouseName}
                </p>
              )}
            </div>
            <div>
              <label className={modalLabels}>
                Delivery Address (Customer)
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                rows={2}
                placeholder="Auto-filled from order, editable"
              />
            </div>
          </div>
        </div>

        {/* Receiver Details */}
        <div className="border rounded-lg p-4 bg-purple-50">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
            <Mail className="h-5 w-5 mr-2 text-purple-600" />
            Receiver Information (OTP Recipient)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={modalLabels}>
                Mobile <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={receiverMobile}
                onChange={(e) => setReceiverMobile(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                placeholder="Receiver's mobile"
                required
              />
            </div>
            <div>
              <label className={modalLabels}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
                placeholder="Receiver's email"
                required
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            OTP will be sent to this email for delivery verification
          </p>
        </div>

        {/* Special Instructions */}
        <div>
          <label className={modalLabels}>Special Instructions</label>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md ${inputFieldDesign}`}
            rows={3}
            placeholder="Any special delivery instructions..."
          />
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        {/* Confirmation Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-3">Delivery Assignment Summary</h3>
          
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="font-medium text-gray-700">Order Number:</span>
              <span className="text-gray-900">{salesOrder.orderNumber}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-medium text-gray-700">Customer:</span>
              <span className="text-gray-900">{salesOrder.customerName}</span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">Delivery Partner</h4>
          <div className="space-y-1 text-sm">
            <p className="text-gray-900">{deliveryPartnerName}</p>
            <p className="text-gray-600">{deliveryPartnerMobile}</p>
            <p className="text-gray-600">{deliveryPartnerEmail}</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-800 mb-2">Receiver (OTP Recipient)</h4>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">{receiverMobile}</p>
            <p className="text-gray-600">{receiverEmail}</p>
          </div>
        </div>

        {specialInstructions && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Special Instructions</h4>
            <p className="text-sm text-gray-700">{specialInstructions}</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-semibold text-amber-800 mb-2">⚠️ Important</h4>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Delivery partner will receive an email with a unique delivery link</li>
            <li>Receiver will receive an OTP via email for delivery verification</li>
            <li>The delivery link will expire after 7 days or once delivery is completed</li>
            <li>Once delivered, the link cannot be reused</li>
          </ul>
        </div>
      </div>
    )}
  </div>

  {/* Actions - Fixed at bottom */}
  <div className="shrink-0 p-6 pt-4 border-t bg-white rounded-b-md">
    {step === 1 ? (
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Next
        </button>
      </div>
    ) : (
      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={submitting}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Assigning...' : 'Confirm & Send Emails'}
          </button>
        </div>
      </div>
    )}
  </div>
</div>
      </div>

      {/* Email Sent Animation */}
      <EmailSentAnimation 
        show={showEmailAnimation} 
        onComplete={() => setShowEmailAnimation(false)}
      />
    </div>
  );
}
