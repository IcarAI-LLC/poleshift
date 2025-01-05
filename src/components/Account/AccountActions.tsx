// src/components/Account/AccountActions.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Typography,
  IconButton,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useUI } from '../../lib/hooks';
import { useAuth } from '../../lib/hooks';
import ResetComponent from "../ResetComponent.tsx";

const AccountActions: React.FC = () => {
  const { showAccountActions, setShowAccountActions } = useUI();
  const { user, logout, userProfile, organization, resetApp } = useAuth(); // Destructure userProfile and organization
  const theme = useTheme();

  const closeModal = () => {
    setShowAccountActions(false);
  };

  const handleLogoutClick = () => {
    logout();
    closeModal();
  };

  const capitalizeFirstLetter = (str?: string | null) => {
    if (str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
    return '';
  };

    // Define the reset logic
    const handleReset = async () => {
        try {
            resetApp();

            // Additional reset actions can be added here
        } catch (error) {
            console.error('Error during reset:', error);
            throw error; // Let ResetComponent handle the alert
        }
    };

  const infoRowStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  };

  const labelStyles = {
    color: theme.palette.text.secondary,
    fontWeight: 500,
    width: '120px',
    flexShrink: 0,
  };

  const valueStyles = {
    color: theme.palette.text.primary,
    flex: 1,
    textAlign: 'right',
  };

  return (
      <Dialog
          open={showAccountActions}
          onClose={closeModal}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              backgroundImage: 'none',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
      >
          <DialogTitle
              sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: theme.spacing(2),
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
              }}
          >
              <Typography>Account</Typography>
              <IconButton
                  onClick={closeModal}
                  aria-label="Close"
                  size="small"
                  sx={{
                      color: theme.palette.text.primary,
                      '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                      },
                  }}
              >
                  <CloseIcon />
              </IconButton>
          </DialogTitle>

        <DialogContent
            sx={{
              padding: theme.spacing(2),
              backgroundColor: theme.palette.background.paper,
            }}
        >
          <Box>
            <Box sx={infoRowStyles}>
              <Typography sx={labelStyles}>Email:</Typography>
              <Typography sx={valueStyles}>{user?.email}</Typography>
            </Box>

            <Box sx={infoRowStyles}>
              <Typography sx={labelStyles}>User Type:</Typography>
              <Typography sx={valueStyles}>
                {capitalizeFirstLetter(userProfile?.user_role)}
              </Typography>
            </Box>

            <Box sx={infoRowStyles}>
              <Typography sx={labelStyles}>Organization:</Typography>
              <Typography sx={valueStyles}>
                {capitalizeFirstLetter(organization?.name)}
              </Typography>
            </Box>

            <Box sx={infoRowStyles}>
              <Typography sx={labelStyles}>Last Sign In:</Typography>
              <Typography sx={valueStyles}>
                {user?.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString()
                    : 'N/A'}
              </Typography>
            </Box>

            <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: theme.spacing(3),
                }}
            >
                <ResetComponent onReset={ handleReset }></ResetComponent>
              <Button
                  variant="contained"
                  onClick={handleLogoutClick}
                  sx={{
                    backgroundColor: theme.palette.error.main,
                    color: theme.palette.common.white,
                    '&:hover': {
                      backgroundColor: theme.palette.error.dark,
                    },
                    minWidth: '100px',
                      marginLeft: 'auto',
                  }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
  );
};

export default AccountActions;
