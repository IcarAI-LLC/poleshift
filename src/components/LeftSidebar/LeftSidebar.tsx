// src/components/LeftSidebar.tsx

import React, { useCallback, useState, useMemo } from 'react';
import { Box, Button } from '@mui/material';
import {
  AddCircle as AddCircleIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useUI, useData, useAuth } from '../../lib/hooks';
import { useAuthStore } from '../../lib/stores/authStore';
import { PoleshiftPermissions } from '../../lib/types';

import LeftSidebarTree from './LeftSidebarTree';
import CreateSampleGroupModal from './CreateSampleGroupModal';
import CreateFolderModal from './CreateFolderModal';

const LeftSidebar: React.FC = () => {
  const theme = useTheme();
  const { setSelectedLeftItem, isLeftSidebarCollapsed, setErrorMessage } = useUI();
  const { userPermissions } = useAuthStore.getState();
  const { organization } = useAuth();
  const { sampleGroups, createSampleGroup, addFileNode, locations } = useData();

  // Permissions
  const hasCreatePermission = userPermissions?.includes(PoleshiftPermissions.CreateSampleGroup);

  // Disentangled modals
  const [isSampleGroupModalOpen, setIsSampleGroupModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Click handlers to open each modal
  const openSampleGroupModal = useCallback(() => {
    if (!hasCreatePermission) {
      setErrorMessage('You do not have permission to create a new sampling event.');
      return;
    }
    setIsSampleGroupModalOpen(true);
  }, [hasCreatePermission, setErrorMessage]);

  const openFolderModal = useCallback(() => {
    if (!hasCreatePermission) {
      setErrorMessage('You do not have permission to create a new folder.');
      return;
    }
    setIsFolderModalOpen(true);
  }, [hasCreatePermission, setErrorMessage]);

  // Reset selection
  const handleResetSelection = useCallback(() => {
    setSelectedLeftItem(undefined);
  }, [setSelectedLeftItem]);

  // Styles
  const styles = useMemo(() => ({
    sidebar: {
      width: 'var(--sidebar-width)',
      height: '100vh',
      backgroundColor: 'var(--color-sidebar)',
      display: 'flex',
      flexDirection: 'column',
      transition: theme.transitions.create('width', {
        duration: theme.transitions.duration.standard,
      }),
      overflow: 'hidden',
      position: 'absolute',
      zIndex: 1000,
    } as const,
    contentContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      marginTop: 'var(--header-height)',
    } as const,
    buttonContainer: {
      padding: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      borderBottom: '1px solid var(--color-border)',
    } as const,
    sidebarButton: {
      width: '100%',
      justifyContent: 'flex-start',
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-text)',
    } as const,
    resetButton: {
      width: '100%',
      justifyContent: 'flex-start',
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-text)',
    } as const,
  }), [theme]);

  return (
      <Box
          className={`left-sidebar ${isLeftSidebarCollapsed ? 'collapsed' : ''}`}
          sx={styles.sidebar}
      >
        <Box sx={styles.contentContainer}>
          <Box sx={styles.buttonContainer}>

            {/* New Sampling Event Button */}
            <Button
                variant="contained"
                onClick={openSampleGroupModal}
                aria-label="Create New Sampling Event"
                sx={styles.sidebarButton}
                disableElevation
                disabled={!hasCreatePermission}
            >
              <AddCircleIcon />
              {!isLeftSidebarCollapsed && (
                  <span style={{ marginLeft: theme.spacing(1) }}>
                New Sampling Event
              </span>
              )}
            </Button>

            {/* New Folder Button */}
            <Button
                variant="contained"
                onClick={openFolderModal}
                aria-label="Create New Folder"
                sx={styles.sidebarButton}
                disableElevation
                disabled={!hasCreatePermission}
            >
              <CreateNewFolderIcon />
              {!isLeftSidebarCollapsed && (
                  <span style={{ marginLeft: theme.spacing(1) }}>New Folder</span>
              )}
            </Button>

            {/* Reset Selection Button */}
            <Button
                variant="contained"
                onClick={handleResetSelection}
                aria-label="Reset Selection"
                sx={styles.resetButton}
                disableElevation
            >
              <PublicIcon />
              {!isLeftSidebarCollapsed && (
                  <span style={{ marginLeft: theme.spacing(1) }}>
                Reset Selection
              </span>
              )}
            </Button>
          </Box>

          <LeftSidebarTree />
        </Box>

        {/* 1) Create Sample Group Modal */}
        {isSampleGroupModalOpen && (
            <CreateSampleGroupModal
                open={isSampleGroupModalOpen}
                onClose={() => setIsSampleGroupModalOpen(false)}
                organization={organization}
                sampleGroups={sampleGroups}
                locations={locations}
                createSampleGroup={createSampleGroup}
                setErrorMessage={setErrorMessage}
            />
        )}

        {/* 2) Create Folder Modal */}
        {isFolderModalOpen && (
            <CreateFolderModal
                open={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                organization={organization}
                addFileNode={addFileNode}
                setErrorMessage={setErrorMessage}
            />
        )}
      </Box>
  );
};

export default LeftSidebar;
