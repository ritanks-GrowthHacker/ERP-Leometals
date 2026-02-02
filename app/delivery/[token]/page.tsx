'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Package, MapPin, Phone, Mail, User, CheckCircle, Clock, Truck } from 'lucide-react';

interface DeliveryItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DeliveryDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  totalAmount: number;
  status: 'pending' | 'picked_up' | 'delivered';
  pickupAddress: string;
  deliveryAddress: string;
  receiverMobile: string;
  receiverEmail: string;
  specialInstructions?: string;
  assignedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  items: DeliveryItem[];
}

export default function DeliveryPortalPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDeliveryDetails();
    }
  }, [token]);

  const fetchDeliveryDetails = async () => {
    try {
      const response = await fetch(`/api/delivery/${token}`);
      const data = await response.json();

      if (response.ok) {
        setDelivery(data.delivery);
      } else {
        setError(data.message || 'Failed to load delivery details');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPickedUp = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await fetch(`/api/delivery/${token}/pickup`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'Order marked as picked up successfully!');
        // Refresh to update status
        await fetchDeliveryDetails();
      } else {
        setError(data.message || 'Failed to mark as picked up');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await fetch(`/api/delivery/${token}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'Delivery completed successfully!');
        setShowSuccessModal(true);
        // Don't refetch - delivery is complete, show success modal
      } else {
        setError(data.message || 'Failed to verify OTP');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Pending Pickup</span>;
      case 'picked_up':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Out for Delivery</span>;
      case 'delivered':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Delivered</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  // Link Expired Message
  if (linkExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <Clock className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Link Expired</h2>
          <p className="text-gray-600 mb-4">
            This delivery link has expired after successful completion. Thank you for your service!
          </p>
          <p className="text-sm text-gray-500">
            If you have any questions, please contact support.
          </p>
        </div>
      </div>
    );
  }

  if (error && !delivery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Truck className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Delivery Portal</h1>
                <p className="text-green-100 text-sm">Order {delivery.orderNumber}</p>
              </div>
            </div>
            {getStatusBadge(delivery.status)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMessage}
          </div>
        )}
        
        {/* Status Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Delivery Progress</h2>
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
            <div className="absolute top-5 left-0 h-0.5 bg-green-500 z-0" style={{ width: delivery.status === 'pending' ? '0%' : delivery.status === 'picked_up' ? '50%' : '100%' }}></div>
            
            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${delivery.status !== 'pending' ? 'bg-green-500' : 'bg-gray-300'}`}>
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-2 text-gray-600">Assigned</span>
            </div>
            
            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${delivery.status === 'picked_up' || delivery.status === 'delivered' ? 'bg-green-500' : 'bg-gray-300'}`}>
                <Package className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-2 text-gray-600">Picked Up</span>
            </div>
            
            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${delivery.status === 'delivered' ? 'bg-green-500' : 'bg-gray-300'}`}>
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs mt-2 text-gray-600">Delivered</span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium text-gray-900">{delivery.customerName}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Package className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-medium text-gray-900">₹{parseFloat(delivery.totalAmount.toString()).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="font-medium text-gray-900">{new Date(delivery.orderDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Assigned At</p>
                <p className="font-medium text-gray-900">{new Date(delivery.assignedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-3">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Pickup Address</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{delivery.pickupAddress}</p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-3">
              <MapPin className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Delivery Address</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{delivery.deliveryAddress}</p>
          </div>
        </div>

        {/* Receiver Details */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-purple-900 mb-4">Receiver Contact (OTP Holder)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-purple-600" />
              <span className="text-gray-700">{delivery.receiverMobile}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-purple-600" />
              <span className="text-gray-700">{delivery.receiverEmail}</span>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {delivery.specialInstructions && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Special Instructions</h3>
            <p className="text-sm text-gray-700">{delivery.specialInstructions}</p>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-sm font-medium text-gray-600">Product</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Qty</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Price</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {delivery.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 text-sm text-gray-900">{item.product_name}</td>
                    <td className="py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                    <td className="py-3 text-sm text-gray-900 text-right">₹{parseFloat(item.unit_price.toString()).toLocaleString('en-IN')}</td>
                    <td className="py-3 text-sm font-medium text-gray-900 text-right">₹{parseFloat(item.total_price.toString()).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        {delivery.status === 'pending' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Ready to pickup?</h3>
            <button
              onClick={handleMarkPickedUp}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? 'Processing...' : 'Mark as Picked Up'}
            </button>
          </div>
        )}

        {delivery.status === 'picked_up' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Complete Delivery</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ask the receiver for the OTP sent to their email: <strong>{delivery.receiverEmail}</strong>
            </p>
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest"
                  placeholder="000000"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Verifying...' : 'Verify OTP & Complete Delivery'}
              </button>
            </form>
          </div>
        )}

        {delivery.status === 'delivered' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-900 mb-2">Delivery Completed!</h3>
            <p className="text-sm text-gray-700">
              Delivered on {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleString() : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-4">
              This delivery link is no longer active.
            </p>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Order Delivered Successfully!
              </h3>
              <p className="text-gray-600 mb-6">
                Thank you for completing the delivery. The invoice has been generated automatically.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setLinkExpired(true);
                }}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}