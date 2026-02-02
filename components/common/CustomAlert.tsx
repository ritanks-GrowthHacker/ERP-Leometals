'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

interface AlertOptions {
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Array<AlertOptions & { id: string }>>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAlert = (options: AlertOptions) => {
    const id = Math.random().toString(36).substring(7);
    const newAlert = { ...options, id };
    setAlerts((prev) => [...prev, newAlert]);

    if (options.duration !== 0) {
      setTimeout(() => {
        removeAlert(id);
      }, options.duration || 5000);
    }
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const showConfirm = (options: ConfirmOptions) => {
    setConfirmDialog(options);
  };

  const handleConfirm = async () => {
    if (confirmDialog) {
      setConfirmDialog(null);
      await confirmDialog.onConfirm();
    }
  };

  const handleCancel = () => {
    if (confirmDialog?.onCancel) {
      confirmDialog.onCancel();
    }
    setConfirmDialog(null);
  };

  const getAlertIcon = (type: AlertOptions['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertStyles = (type: AlertOptions['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Toast Notifications - Only render on client */}
      {mounted && (
        <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-md">
          <AnimatePresence>
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`${getAlertStyles(
                  alert.type
                )} border rounded-lg shadow-lg p-4 flex items-start gap-3`}
              >
                <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  {alert.title && (
                    <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                  )}
                  <p className="text-sm">{alert.message}</p>
                </div>
                <button
                  onClick={() => {
                    removeAlert(alert.id);
                    alert.onClose?.();
                  }}
                  className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation Dialog - Only render on client */}
      {mounted && (
        <AnimatePresence>
          {confirmDialog && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[9998]"
                onClick={handleCancel}
              />
              <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmDialog.title && (
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      {confirmDialog.title}
                    </h3>
                  )}
                  <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {confirmDialog.cancelText || 'Cancel'}
                    </button>
                    <button
                      onClick={handleConfirm}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                        confirmDialog.confirmVariant === 'danger'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {confirmDialog.confirmText || 'Confirm'}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      )}
    </AlertContext.Provider>
  );
};
