// src/renderer/components/ErrorMessage.tsx

import React, { useEffect } from 'react';
import { FaExclamationCircle } from 'react-icons/fa';

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

  return (
    <div className={`error-message ${className}`}>
      <FaExclamationCircle className="error-message__icon" />
      <span>{message}</span>
    </div>
  );
};

export default ErrorMessage;
