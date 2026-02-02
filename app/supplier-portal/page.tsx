'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAlert } from '@/components/common/CustomAlert';

function SupplierPortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Auto-extract email from URL and send OTP on page load
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl && !otpSent) {
      setEmail(emailFromUrl);
      sendOTPAutomatic(emailFromUrl);
    } else if (!emailFromUrl && !otpSent) {
      // No email in URL, set loading to false to show manual email entry
      setLoading(false);
    }
  }, [searchParams, otpSent]);

  const sendOTPAutomatic = async (emailAddress: string) => {
    setLoading(true);

    try {
      const response = await fetch('/api/supplier-portal/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'OTP sent to your email!' });
        setSupplierId(data.supplierId);
        setOtpSent(true);
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to send OTP' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) return;
    setLoading(true);

    try {
      const response = await fetch('/api/supplier-portal/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'OTP sent again to your email!' });
        setSupplierId(data.supplierId);
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to send OTP' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to send OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTPManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showAlert({ type: 'error', title: 'Error', message: 'Please enter your email' });
      return;
    }
    sendOTPAutomatic(email);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      showAlert({ type: 'error', title: 'Error', message: 'Please enter valid 6-digit OTP' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/supplier-portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token in localStorage
        localStorage.setItem('supplierToken', data.token);
        localStorage.setItem('supplierData', JSON.stringify(data.supplier));
        
        showAlert({ type: 'success', title: 'Success', message: 'Login successful!' });
        router.push('/supplier-portal/dashboard');
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Invalid OTP' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to verify OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!otpSent && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-600">Preparing your login session...</p>
        </div>
      </div>
    );
  }

  if (!otpSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-blue-600 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Supplier Portal</h1>
            <p className="text-gray-600">Enter your email to receive verification code</p>
          </div>

          {/* Email Entry Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSendOTPManual}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="your.email@company.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending OTP...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Need help? Contact support</p>
            <p className="mt-2">&copy; 2025 ERP System. All rights reserved.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-blue-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Supplier Portal</h1>
          <p className="text-gray-600">Secure access for suppliers</p>
        </div>

        {/* OTP Verification Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleVerifyOTP}>
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 mb-1">Verification code sent to</p>
              <p className="text-sm font-semibold text-gray-900">{email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">Valid for 10 minutes</p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify & Login'
              )}
            </button>

            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading}
              className="w-full mt-3 text-blue-600 font-medium py-2 hover:text-blue-700 disabled:opacity-50 text-sm"
            >
              Didn't receive the code? Resend OTP
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Need help? Contact support</p>
          <p className="mt-2">&copy; 2025 ERP System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default function SupplierPortalLogin() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SupplierPortalLoginContent />
    </Suspense>
  );
}