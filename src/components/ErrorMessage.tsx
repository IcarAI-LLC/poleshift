// src/renderer/components/ErrorMessage.tsx

import React, { useEffect } from 'react';
import { FaExclamationCircle } from 'react-icons/fa';
import { cn } from '@/lib/utils'; // Utility for conditional class names
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface ErrorMessageProps {
  message: string;
  onClose: () => void;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
                                                     message,
                                                     onClose,
                                                     className,
                                                   }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;
    console.log("ERROR MESSAGE:", message);
  return (
      <Alert
          variant="destructive"
          className={cn("flex items-end gap-2 p-4 border rounded-md", className)}
      >
        <FaExclamationCircle className="text-red-500 mt-1" size={20} />
        <div>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
      </Alert>
  );
};

export default ErrorMessage;