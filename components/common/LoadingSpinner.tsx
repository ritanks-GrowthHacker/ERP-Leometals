'use client';

import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({ size = 'md', message, fullScreen = false }: LoadingSpinnerProps) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const spinnerSize = sizes[size];

  const spinner = (
    <motion.div
      className="relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`${spinnerSize} relative`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
        {/* Spinning segment */}
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full"></div>
      </motion.div>
      
      {/* Center dot with pulse */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
      </motion.div>
    </motion.div>
  );

  if (fullScreen) {
    return (
      <motion.div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {spinner}
        {message && (
          <motion.p
            className="mt-4 text-gray-700 font-medium text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      {spinner}
      {message && (
        <motion.p
          className="mt-4 text-gray-700 font-medium text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

// ERP-themed loading animation with gears and data flow
export const ERPLoader = ({ message }: { message?: string }) => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative w-24 h-24">
        {/* Rotating gears */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-blue-600">
            <path
              fill="currentColor"
              d="M50,10 L55,20 L50,30 L45,20 Z M70,20 L80,25 L75,35 L65,30 Z M80,40 L90,45 L85,55 L75,50 Z M85,60 L90,70 L80,75 L75,65 Z M75,80 L70,90 L60,85 L65,75 Z M55,90 L50,100 L45,90 L50,80 Z M30,85 L25,95 L15,90 L20,80 Z M15,70 L10,80 L5,70 L10,60 Z M10,50 L5,60 L0,50 L5,40 Z M15,30 L10,40 L5,30 L10,20 Z M30,15 L25,25 L15,20 L20,10 Z"
            />
          </svg>
        </motion.div>

        {/* Counter-rotating inner gear */}
        <motion.div
          className="absolute inset-4"
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-purple-600">
            <circle cx="50" cy="50" r="20" fill="currentColor" />
            <circle cx="50" cy="50" r="12" fill="white" />
          </svg>
        </motion.div>

        {/* Pulsing center */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
        </motion.div>
      </div>

      {message && (
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-gray-700 font-medium">{message}</p>
          <motion.div
            className="mt-2 flex items-center justify-center gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-gray-500 text-sm">Processing</span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            >
              .
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

// Data flow loader
export const DataFlowLoader = () => {
  return (
    <div className="relative w-32 h-32">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 border-2 border-blue-500 rounded-full"
          initial={{ scale: 0, opacity: 1 }}
          animate={{
            scale: [0, 1.5],
            opacity: [1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-8 h-8 bg-blue-600 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
    </div>
  );
};

// Button loader (for inline use in buttons)
export const ButtonLoader = () => {
  return (
    <motion.div
      className="inline-flex items-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-2 h-2 bg-current rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 bg-current rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-current rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
      />
    </motion.div>
  );
};
