'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useAuthStore } from '@/lib/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loginType, setLoginType] = useState<'email' | 'username'>('email');
  const [isWarehouseManager, setIsWarehouseManager] = useState(false);
  const [warehouseEmail, setWarehouseEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginData = loginType === 'email' 
        ? { email, password }
        : { username, password };

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Save token and user to Zustand store
      setAuth(data.token, data.user);
      
      // Redirect based on role
      if (data.user.role === 'warehouse_manager' || data.user.managerType === 'warehouse_manager') {
        router.push('/erp/warehouse-manager');
      } else {
        router.push('/erp');
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!warehouseEmail) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setSendingOtp(true);

    try {
      const response = await fetch('/api/auth/warehouse-manager/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: warehouseEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP');
        setSendingOtp(false);
        return;
      }

      setOtpSent(true);
      setSendingOtp(false);
    } catch (err: any) {
      setError('An error occurred. Please try again.');
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/warehouse-manager/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: warehouseEmail, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid OTP');
        setLoading(false);
        return;
      }

      // Save token and user to Zustand store
      setAuth(data.token, data.user);
      
      // Redirect based on role
      if (data.user.role === 'warehouse_manager' || data.user.managerType === 'warehouse_manager') {
        router.push('/erp/warehouse-manager');
      } else {
        router.push('/erp');
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-900"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="mb-6"
              >
                <div className="w-24 h-24 bg-white rounded-2xl shadow-2xl flex items-center justify-center mx-auto">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Icons.Inventory className="text-blue-600" size={48} />
                  </motion.div>
                </div>
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold text-white mb-2"
              >
                Welcome Back
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-blue-200"
              >
                Loading your workspace...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showLoader ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex"
      >
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-[#1E40AF] via-[#1E3A8A] to-[#0F172A] p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-2xl">
              <Icons.Inventory />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ERP System</h1>
              <p className="text-sm text-blue-200">Enterprise Resource Planning</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Streamline Your Business Operations
          </h2>
          <p className="text-lg text-blue-100">
            Manage inventory, purchasing, sales, and manufacturing all in one powerful platform.
          </p>
          
          {/* Features */}
          <div className="space-y-4 mt-8">
            {[
              { icon: <Icons.Inventory />, text: 'Real-time Inventory Tracking' },
              { icon: <Icons.Reports />, text: 'Advanced Analytics & Reporting' },
              { icon: <Icons.CheckCircle />, text: 'Automated Workflows' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  {feature.icon}
                </div>
                <span className="text-lg">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 ERP System. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-floor">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-[#1E40AF] to-[#0EA5E9] rounded-xl flex items-center justify-center shadow-lg">
                <Icons.Inventory />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">ERP System</h1>
                <p className="text-xs text-text-muted">Enterprise Solution</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-workspace rounded-2xl shadow-xl border border-border-default p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-text-primary mb-2">Welcome Back</h2>
              <p className="text-text-muted">Sign in to access your account</p>
            </div>

            <form onSubmit={isWarehouseManager ? (otpSent ? handleVerifyOTP : (e) => { e.preventDefault(); handleSendOTP(); }) : handleLogin} className="space-y-5">
              {error && (
                <div className="bg-[#FEF2F2] border border-[#FEE2E2] text-[#EF4444] px-4 py-3 rounded-lg flex items-start gap-3 animate-fade-in">
                  <Icons.Alert />
                  <div className="flex-1 text-sm">{error}</div>
                </div>
              )}
              
              {!isWarehouseManager ? (
                <>
                  {/* Regular Login - Login Type Tabs */}
                  <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                    <button
                      type="button"
                      onClick={() => setLoginType('email')}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                        loginType === 'email'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Email Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginType('username')}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                        loginType === 'username'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      API User Login
                    </button>
                  </div>

                  {loginType === 'email' ? (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Email Address
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="h-12"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Username
                      </label>
                      <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="API username"
                        required
                        className="h-12"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Password
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-border-default text-[#1E40AF] focus:ring-[#1E40AF] focus:ring-offset-0"
                      />
                      <span className="text-sm text-text-body">Remember me</span>
                    </label>
                    <a href="#" className="text-sm font-medium text-[#1E40AF] hover:text-[#1E3A8A] transition-colors">
                      Forgot password?
                    </a>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-12 text-base font-semibold"
                    loading={loading}
                  >
                    Sign In
                  </Button>
                </>
              ) : (
                <>
                  {/* Warehouse Manager Login */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Icons.Inventory size={20} />
                      <span className="font-semibold">Warehouse Manager Login</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">Enter your registered email to receive OTP</p>
                  </div>

                  {!otpSent ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Manager Email Address
                        </label>
                        <Input
                          type="email"
                          value={warehouseEmail}
                          onChange={(e) => setWarehouseEmail(e.target.value)}
                          placeholder="manager@company.com"
                          required
                          className="h-12"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleSendOTP}
                        variant="primary"
                        className="w-full h-12 text-base font-semibold"
                        loading={sendingOtp}
                      >
                        {sendingOtp ? 'Sending OTP...' : 'Send OTP'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-green-800">
                          OTP sent to <strong>{warehouseEmail}</strong>. Please check your email.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Enter 6-Digit OTP
                        </label>
                        <Input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          required
                          maxLength={6}
                          className="h-12 text-center text-2xl tracking-widest font-mono"
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-12 text-base font-semibold"
                        loading={loading}
                        disabled={otp.length !== 6}
                      >
                        Verify OTP
                      </Button>

                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors w-full text-center"
                      >
                        Change Email
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => { setIsWarehouseManager(false); setOtpSent(false); setOtp(''); setWarehouseEmail(''); setError(''); }}
                    className="text-sm text-gray-600 hover:text-gray-800 transition-colors w-full text-center"
                  >
                    ← Back to Regular Login
                  </button>
                </>
              )}
            </form>

            {!isWarehouseManager && (
              <div className="mt-6 space-y-3">
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsWarehouseManager(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Icons.Inventory size={16} />
                    <span>Warehouse Manager?</span>
                  </button>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-text-muted">
                    Don't have an account?{' '}
                    <a href="#" className="font-medium text-[#1E40AF] hover:text-[#1E3A8A] transition-colors">
                      Contact Administrator
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-border-default">
              <p className="text-xs text-center text-text-muted">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-text-muted text-xs">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Secured with 256-bit SSL encryption</span>
            </div>
          </div>
        </div>
        </div>
      </motion.div>
    </>
  );
}
