// src/components/TopControls/AccountButton.tsx

import React from 'react';
import { IconButton } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface AccountButtonProps {
  setShowAccountActions: (value: boolean) => void;
}

const AccountButton: React.FC<AccountButtonProps> = ({
                                                       setShowAccountActions,
                                                     }) => {
  return (
      <IconButton
          onClick={() => setShowAccountActions(true)}
          aria-label="Account Actions"
          sx={{
            color: 'var(--color-white)',
            padding: '8px',
            '&:hover': {
              color: 'var(--color-primary)',
              backgroundColor: 'transparent',
            },
          }}
      >
        <AccountCircleIcon />
      </IconButton>
  );
};

export default AccountButton;