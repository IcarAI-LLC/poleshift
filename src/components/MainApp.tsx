// src/renderer/components/MainApp.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import useAuth from '../old_hooks/useAuth';
import useData from '../old_hooks/useData';
import useUI from '../old_hooks/useUI';
import LeftSidebar from './LeftSidebar/LeftSidebar';
import RightSidebar from './RightSidebar';
import DropBoxes from './DropBoxes/DropBoxes';
import ErrorMessage from './ErrorMessage';
import GlobeComponent from './GlobeComponent';
import ConfirmDialog from './ConfirmDialog';
import ContextMenu from './ContextMenu';
import AccountActions from './Account/AccountActions';
import SampleGroupMetadata from './SampleGroupMetadata';
import FilterMenu from './FilterMenu';
import OfflineWarning from './OfflineWarning'; // Import the new component

const MainApp: React.FC = () => {
  const {
    errorMessage,
    userTier,
    setErrorMessage: setGlobalErrorMessage,
  } = useAuth();
  const {
    sampleGroupData,
    setSampleGroupData,
    deleteItem,
    isOnline,
    fileTreeData,
    setFileTreeData,
  } = useData();
  const {
    selectedLeftItem,
    setSelectedLeftItem,
    confirmState,
    setConfirmState,
    showAccountActions,
    filters,
    setFilters,
  } = useUI();

  const [localErrorMessage, setLocalErrorMessage] = useState<string>('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);
  const [isOfflineVisible, setIsOfflineVisible] = useState<boolean>(true); // New state

  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Get sampleGroupId and sampleGroup based on the selectedLeftItem
  const sampleGroupId =
    selectedLeftItem?.type === 'sampleGroup' ? selectedLeftItem.id : null;
  const sampleGroup = sampleGroupId ? sampleGroupData[sampleGroupId] : null;

  const handleDataProcessed = useCallback(
    (_insertData: any, /* configItem: any, processedData: any */) => {
      return
    },
    [
      selectedLeftItem,
      sampleGroup,
      setSampleGroupData,
      fileTreeData,
      setFileTreeData,
    ],
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        await deleteItem(itemId);
        if (selectedLeftItem?.id === itemId) {
          setSelectedLeftItem(null);
        }
        setLocalErrorMessage('');
      } catch (error: any) {
        setLocalErrorMessage(error.message || 'Failed to delete the item.');
      }
    },
    [deleteItem, selectedLeftItem, setSelectedLeftItem],
  );

  const displayedError = errorMessage || localErrorMessage;

  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        errorMessage ? setGlobalErrorMessage('') : setLocalErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, errorMessage, setGlobalErrorMessage]);

  // Handler for applying filters
  const handleApplyFilters = () => {
    console.log('Filters applied:', filters);
    setIsFilterMenuOpen(false);
  };

  // Handler for resetting filters
  const handleResetFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      selectedLocations: [],
    });
    console.log('Filters reset.');
    setIsFilterMenuOpen(false);
  };

  // Handler to open the FilterMenu
  const openFilterMenu = () => {
    setIsFilterMenuOpen(true);
  };

  // Handler to close the FilterMenu
  const closeFilterMenu = () => {
    setIsFilterMenuOpen(false);
    openButtonRef.current?.focus();
  };

  // Prevent background scrolling when FilterMenu is open
  useEffect(() => {
    if (isFilterMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFilterMenuOpen]);

  // New useEffect to manage offline banner visibility
  useEffect(() => {
    if (isOnline) {
      setIsOfflineVisible(false); // Hide banner when back online
    } else {
      setIsOfflineVisible(true); // Show banner when offline
    }
  }, [isOnline]);

  return (
    <div id="app">
        <div className="app-container">
          <LeftSidebar userTier={userTier} />

          {/* IconButton to Open Filter Menu with Tooltip */}
          <Tooltip title="Open Filters" arrow>
            <IconButton
              color="primary"
              size="small"
              onClick={openFilterMenu}
              ref={openButtonRef}
              style={{
                position: 'fixed',
                top: 'var(--spacing-lg)',
                right: 'var(--spacing-lg)',
                zIndex: 1400,
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-white)',
              }}
              className="icon-button open-filters-icon-button"
              aria-label="Open Filters"
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Filter Menu with Conditional Rendering */}
          {isFilterMenuOpen && (
            <FilterMenu
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
              onClose={closeFilterMenu}
            />
          )}

          <div className="main-content">
            {/* Offline Warning Component */}
            <OfflineWarning
              isVisible={!isOnline && isOfflineVisible}
              message="You are offline. Some features may not be available."
              onClose={() => setIsOfflineVisible(false)}
            />

            {/* Display the SampleGroupMetadata when a sample group is selected */}
            {selectedLeftItem?.type === 'sampleGroup' && sampleGroup && (
              <SampleGroupMetadata sampleGroup={sampleGroup} />
            )}

            {displayedError && (
              <ErrorMessage
                message={displayedError}
                onClose={() =>
                  errorMessage
                    ? setGlobalErrorMessage('')
                    : setLocalErrorMessage('')
                }
                className="error-message"
              />
            )}

            <div className="content-body">
              {selectedLeftItem?.type === 'sampleGroup' ? (
                <DropBoxes
                  onDataProcessed={handleDataProcessed}
                  onError={setLocalErrorMessage}
                />
              ) : (
                <GlobeComponent />
              )}
            </div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}
        <ConfirmDialog
          confirmState={confirmState}
          setConfirmState={setConfirmState}
        />
        <ContextMenu deleteItem={handleDeleteItem} userTier={userTier} />
    </div>
  );
};

export default MainApp;
