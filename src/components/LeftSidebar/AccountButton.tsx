// src/components/LeftSidebar/AccountButton.tsx

import React from 'react';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface AccountButtonProps {
  setShowAccountActions: (value: boolean) => void;
}

const AccountButton: React.FC<AccountButtonProps> = ({
  setShowAccountActions,
}) => {
  return (
    <button
      className="left-sidebar__account-button"
      onClick={() => setShowAccountActions(true)}
      aria-label="Account Actions"
    >
      <AccountCircleIcon className="left-sidebar__account-icon" />
    </button>
  );
};

export default AccountButton;
