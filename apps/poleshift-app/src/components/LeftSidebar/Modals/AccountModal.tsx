// src/components/LeftSidebar/Modals/AccountModal.tsx

import { FC } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.tsx';
import { Button } from '@/components/ui/button.tsx';

import { useUI } from '../../../hooks';
import { useAuth } from '@/hooks';
import ResetComponent from '../../ResetComponent.tsx';

const AccountModal: FC = () => {
  const { showAccountActions, setShowAccountActions } = useUI();
  const { user, logout, userProfile, organization, resetApp } = useAuth();

  const closeModal = () => {
    setShowAccountActions(false);
  };

  const handleLogoutClick = () => {
    logout();
    closeModal();
  };

  const capitalizeFirstLetter = (str?: string | null) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  const handleReset = async () => {
    try {
      resetApp();
      // Additional reset actions can be added here
    } catch (error) {
      console.error('Error during reset:', error);
      throw error; // Let ResetComponent handle the alert
    }
  };

  return (
    <Dialog open={showAccountActions} onOpenChange={setShowAccountActions}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>

        <div>
          <p>Email: {user?.email}</p>
          <p>User Type: {capitalizeFirstLetter(userProfile?.user_role)}</p>
          <p>Organization: {capitalizeFirstLetter(organization?.name)}</p>
          <p>
            Last Sign In:{' '}
            {user?.last_sign_in_at
              ? new Date(user.last_sign_in_at).toLocaleString()
              : 'N/A'}
          </p>
        </div>

        <DialogFooter>
          <ResetComponent onReset={handleReset} />
          <Button variant='destructive' onClick={handleLogoutClick}>
            Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountModal;
