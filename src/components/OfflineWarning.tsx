// src/renderer/components/OfflineWarning/OfflineWarning.tsx

import React from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface OfflineWarningProps {
  message?: string;
  isVisible: boolean;
  onClose?: () => void;
}

const OfflineWarning: React.FC<OfflineWarningProps> = ({
  message = 'You are offline. Some features may not be available.',
  isVisible,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div className="offline-banner">
      <WarningAmberIcon className="offline-banner__icon" />
      <span className="offline-banner__message">{message}</span>
      {onClose && (
        <button
          className="offline-banner__close"
          onClick={onClose}
          aria-label="Close Offline Banner"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default OfflineWarning;
