'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CustomerPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

  async function fetchInvoiceDetails() {
    try {
      const response = await fetch(`/api/payment/customer/invoice/${invoiceId}`);
      const data = await response.json();
      
      if (response.ok) {
        setInvoice(data);
      } else {
        setError(data.error || 'Failed to fetch invoice');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayNow() {
    if (paying) return;
    setPaying(true);
    setError('');

    try {
      // Create Razorpay order
      const orderResponse = await fetch('/api/payment/customer/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'ERP System',
        description: `Payment for Invoice ${orderData.invoice.invoiceNumber}`,
        order_id: orderData.order.id,
        handler: async function (response: any) {
          // Verify payment
          try {
            const verifyResponse = await fetch('/api/payment/customer/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                invoiceId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.success) {
              alert('Payment successful! Thank you.');
              router.push('/payment/success');
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (err: any) {
            alert(`Payment verification failed: ${err.message}`);
            setPaying(false);
          }
        },
        prefill: {
          name: invoice.customer?.name || '',
          email: invoice.customer?.email || '',
          contact: invoice.customer?.phone || '',
        },
        theme: {
          color: '#fb923c',
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const isPaid = invoice.status === 'paid';
  const balanceAmount = parseFloat(invoice.balanceAmount || invoice.totalAmount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Invoice Payment</h1>
            <p className="text-orange-100">Secure payment powered by Razorpay</p>
          </div>

          {/* Invoice Details */}
          <div className="p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-semibold text-lg">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium text-red-600">{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</span>
                </div>
              )}
              {invoice.customer && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{invoice.customer.name}</span>
                </div>
              )}
            </div>

            <div className="border-t border-b border-gray-200 py-6 my-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">₹{parseFloat(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">₹{parseFloat(invoice.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold text-lg">₹{parseFloat(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {invoice.paidAmount && parseFloat(invoice.paidAmount) > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600">Paid Amount:</span>
                  <span className="font-medium text-green-600">₹{parseFloat(invoice.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-300">
                <span className="text-lg font-bold text-gray-900">Amount Due:</span>
                <span className="text-2xl font-bold text-orange-600">₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {isPaid ? (
              <div className="text-center py-8">
                <div className="text-green-500 text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Paid</h2>
                <p className="text-gray-600">This invoice has been fully paid. Thank you!</p>
              </div>
            ) : (
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>Pay ₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>
                )}
              </button>
            )}

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>🔒 Secure payment powered by Razorpay</p>
              <p className="mt-1">Your payment information is encrypted and secure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
    </div>
  );
}
