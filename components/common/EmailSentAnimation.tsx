'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Check } from 'lucide-react';

interface EmailSentAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export default function EmailSentAnimation({ show, onComplete }: EmailSentAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onAnimationComplete={() => {
            if (onComplete) {
              setTimeout(onComplete, 2000);
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center">
              {/* Animated envelope */}
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: -100 }}
                transition={{ 
                  delay: 0.3,
                  duration: 0.8,
                  ease: "easeInOut"
                }}
                className="relative"
              >
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ 
                    delay: 0.3,
                    duration: 0.5,
                    repeat: 0
                  }}
                  className="bg-blue-100 rounded-full p-6"
                >
                  <Mail className="text-blue-600" size={48} />
                </motion.div>

                {/* Flying effect particles */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 2],
                    y: [-20, -40, -60]
                  }}
                  transition={{ 
                    delay: 0.5,
                    duration: 0.6,
                    times: [0, 0.5, 1]
                  }}
                  className="absolute top-0 left-0 w-2 h-2 bg-blue-400 rounded-full"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 2],
                    y: [-20, -40, -60]
                  }}
                  transition={{ 
                    delay: 0.6,
                    duration: 0.6,
                    times: [0, 0.5, 1]
                  }}
                  className="absolute top-0 right-0 w-2 h-2 bg-blue-400 rounded-full"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 2],
                    y: [-20, -40, -60]
                  }}
                  transition={{ 
                    delay: 0.7,
                    duration: 0.6,
                    times: [0, 0.5, 1]
                  }}
                  className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full"
                />
              </motion.div>

              {/* Success checkmark */}
              <motion.div
                initial={{ opacity: 0, scale: 0, y: -50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  delay: 1.1,
                  type: "spring",
                  stiffness: 500,
                  damping: 20
                }}
                className="mt-16 bg-green-100 rounded-full p-4"
              >
                <Check className="text-green-600" size={32} />
              </motion.div>

              {/* Text */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className="mt-4 text-xl font-semibold text-gray-900"
              >
                Email Sent!
              </motion.h3>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-2 text-gray-600 text-center"
              >
                Your email has been sent successfully
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
