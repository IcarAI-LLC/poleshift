// src/renderer/components/OfflineWarning/OfflineWarning.tsx
//TODO add back online notification
import React from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * Represents the properties for an offline warning component.
 *
 * @interface OfflineWarningProps
 *
 * @property {string} [message] - An optional message to display in the offline warning.
 *                                Defaults to a generic offline message if not provided.
 *
 * @property {boolean} isVisible - Determines whether the offline warning is currently visible.
 *                                 Must be set to true to render the component.
 *
 * @property {Function} [onClose] - An optional callback function that gets executed when the offline
 *                                  warning is dismissed or closed by the user.
 */
interface OfflineWarningProps {
  message?: string;
  isVisible: boolean;
  onClose?: () => void;
}

/**
 * OfflineWarning is a React functional component that displays a banner message to inform the user they are offline.
 * The banner is only displayed when the `isVisible` prop is set to true.
 *
 * @param {OfflineWarningProps} props - The props for the OfflineWarning component.
 * @param {string} [props.message='You are offline. Some features may not be available.'] - The message displayed in the offline banner.
 * @param {boolean} props.isVisible - Determines whether the offline banner is visible.
 * @param {function} [props.onClose] - Optional callback function that is called when the close button is clicked.
 */
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
