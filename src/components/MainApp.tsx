// src/lib/components/MainApp.tsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import {
  useAuth,
  useData,
  useUI,
  useNetworkStatus,
  useStorage,
} from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';

import LeftSidebar from './LeftSidebar/LeftSidebar';
import RightSidebar from './RightSidebar';
import DropBoxes from './DropBoxes/DropBoxes';
import ErrorMessage from './ErrorMessage';
import GlobeComponent from './GlobeComponent';
import ContextMenu from './ContextMenu';
import AccountActions from './Account/AccountActions';
import SampleGroupMetadataComponent from './SampleGroupMetadata';
import FilterMenu from './FilterMenu';
import OfflineWarning from './OfflineWarning';
import UploadQueueStatus from './UploadQueueStatus';
import MoveModal from "./LeftSidebar/MoveModal.tsx";
import { useProcessedData } from '../lib/hooks/useProcessedData';

const MainApp: React.FC = () => {
  // Hooks
  const { userProfile, error: authError, organization } = useAuth();
  const { sampleGroups, deleteNode, error: dataError } = useData();
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    leftSidebarContextMenu,
    closeLeftSidebarContextMenu
  } = useUI();
  const { isOnline } = useNetworkStatus();
  const storage = useStorage();

  // Determine the currently selected sample group
  const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
    if (!selectedLeftItem || selectedLeftItem.type !== 'sampleGroup') return null;
    return sampleGroups[selectedLeftItem.id];
  }, [selectedLeftItem, sampleGroups]);

  // Use processed data hook
  const processedDataHook = useProcessedData({
    sampleGroup: sampleGroup as SampleGroupMetadata, // safe even if null is passed
    orgShortId: organization?.org_short_id || '',
    orgId: organization?.id || '',
    organization,
    storage,
  });

  // Local UI state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(true);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Aggregate errors
  const displayedError = authError || dataError || errorMessage || processedDataHook.error;

  // Clear displayed errors after 5 seconds
  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        processedDataHook.setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage, processedDataHook]);

  // Update offline warning based on network status
  useEffect(() => {
    setShowOfflineWarning(!isOnline);
  }, [isOnline]);

  const handleDeleteSample = useCallback(async () => {
    if (!leftSidebarContextMenu.itemId) {
      setErrorMessage('Could not determine which item to delete.');
      return;
    }

    try {
      await deleteNode(leftSidebarContextMenu.itemId);
      closeLeftSidebarContextMenu();
    } catch (error) {
      setErrorMessage(
          error instanceof Error
              ? error.message
              : 'An error occurred while deleting the item.'
      );
    }
  }, [leftSidebarContextMenu, deleteNode, closeLeftSidebarContextMenu, setErrorMessage]);

  const handleApplyFilters = useCallback(() => {
    setIsFilterMenuOpen(false);
  }, []);

  const handleResetFilters = useCallback(() => {
    setIsFilterMenuOpen(false);
  }, []);

  const openFilterMenu = useCallback(() => {
    setIsFilterMenuOpen(true);
  }, []);

  const closeFilterMenu = useCallback(() => {
    setIsFilterMenuOpen(false);
    openButtonRef.current?.focus();
  }, []);

  // Scroll lock effect when the filter menu is open
  useEffect(() => {
    document.body.style.overflow = isFilterMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFilterMenuOpen]);

  const renderContent = useCallback(() => {
    if (selectedLeftItem?.type === 'sampleGroup') {
      return (
          <DropBoxes onError={setErrorMessage} />
      );
    }
    return <GlobeComponent />;
  }, [selectedLeftItem?.type, setErrorMessage]);

  return (
      <div id="app">
        <div className="app-container">
          <LeftSidebar userTier={userProfile?.user_tier || 'researcher'} />

          <Tooltip title="Open Filters" arrow>
            <IconButton
                color="primary"
                size="small"
                onClick={openFilterMenu}
                ref={openButtonRef}
                className="open-filters-icon-button"
                aria-label="Open Filters"
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {isFilterMenuOpen && (
              <FilterMenu
                  onApply={handleApplyFilters}
                  onReset={handleResetFilters}
                  onClose={closeFilterMenu}
              />
          )}

          <div className="main-content">
            <OfflineWarning
                isVisible={!isOnline && showOfflineWarning}
                message="You are offline"
                onClose={() => setShowOfflineWarning(false)}
            />

            {sampleGroup && <SampleGroupMetadataComponent />}

            {displayedError && (
                <ErrorMessage
                    message={displayedError.toString()}
                    onClose={() => {
                      setErrorMessage(null);
                      processedDataHook.setError(null);
                    }}
                    className="error-message"
                />
            )}

            <div className="content-body">{renderContent()}</div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}

        <ContextMenu deleteItem={handleDeleteSample} />
        <MoveModal />
        <UploadQueueStatus />
      </div>
  );
};

export default MainApp;
