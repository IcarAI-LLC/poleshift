import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import { useAuth, useData, useUI, useOffline } from '../lib/hooks';

import LeftSidebar from './LeftSidebar/LeftSidebar';
import RightSidebar from './RightSidebar';
import DropBoxes from './DropBoxes/DropBoxes';
import ErrorMessage from './ErrorMessage';
import GlobeComponent from './GlobeComponent';
import ContextMenu from './ContextMenu';
import AccountActions from './Account/AccountActions';
import SampleGroupMetadata from './SampleGroupMetadata';
import FilterMenu from './FilterMenu';
import OfflineWarning from './OfflineWarning';
// Remove the incorrect import
// import contextMenu from "./ContextMenu";

const MainApp: React.FC = () => {
  // Hooks
  const { userProfile, error: authError } = useAuth();
  const {
    sampleGroups,
    deleteSampleGroup,
    error: dataError
  } = useData();
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    setFilters,
    setContextMenuState,
    contextMenu, // Add this line
  } = useUI();
  const { isOnline, hasPendingChanges } = useOffline();

  // Local state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isOfflineVisible, setIsOfflineVisible] = useState(true);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Get current sample group based on selection
  const sampleGroup = useMemo(() => {
    if (selectedLeftItem?.type !== 'sampleGroup') return null;
    return sampleGroups[selectedLeftItem.id];
  }, [selectedLeftItem, sampleGroups]);

  // Error handling
  const displayedError = authError || dataError || errorMessage;

  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage]);

  // Offline status management
  useEffect(() => {
    setIsOfflineVisible(!isOnline);
  }, [isOnline]);

  // Handlers
  const handleDataProcessed = useCallback((insertData: any) => {
    // Handle processed data
    console.log('Data processed:', insertData);
  }, []);

  const handleDeleteSample = useCallback(
      async () => {
        if (!contextMenu.itemId) {
          setErrorMessage('Could not determine which item to delete.');
          return;
        }
        try {
          await deleteSampleGroup(contextMenu.itemId); // Use deleteSampleGroup from useData
          setContextMenuState({ ...contextMenu, isVisible: false });
        } catch (error: any) {
          setErrorMessage(error.message || 'An error occurred while deleting the item.');
        }
      },
      [contextMenu, setContextMenuState, setErrorMessage, deleteSampleGroup]
  );

  const handleApplyFilters = useCallback(() => {
    setIsFilterMenuOpen(false);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      startDate: null,
      endDate: null,
      selectedLocations: [],
    });
    setIsFilterMenuOpen(false);
  }, [setFilters]);

  // Modal handlers
  const openFilterMenu = useCallback(() => {
    setIsFilterMenuOpen(true);
  }, []);

  const closeFilterMenu = useCallback(() => {
    setIsFilterMenuOpen(false);
    openButtonRef.current?.focus();
  }, []);

  // Scroll lock effect
  useEffect(() => {
    document.body.style.overflow = isFilterMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFilterMenuOpen]);

  return (
      <div id="app">
        <div className="app-container">
          <LeftSidebar userTier={userProfile?.user_tier || "researcher"}/>

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
                isVisible={!isOnline && isOfflineVisible}
                message="You are offline. Some features may not be available."
                onClose={() => setIsOfflineVisible(false)}
            />

            {hasPendingChanges && (
                <OfflineWarning
                    isVisible={true}
                    message="You have pending changes that will sync when you're back online."
                    onClose={() => null}
                />
            )}

            {sampleGroup && <SampleGroupMetadata sampleGroup={sampleGroup} />}

            {displayedError && (
                <ErrorMessage
                    message={displayedError}
                    onClose={() => setErrorMessage('')}
                    className="error-message"
                />
            )}

            <div className="content-body">
              {selectedLeftItem?.type === 'sampleGroup' ? (
                  <DropBoxes
                      onDataProcessed={handleDataProcessed}
                      onError={setErrorMessage}
                  />
              ) : (
                  <GlobeComponent />
              )}
            </div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}

        <ContextMenu
            deleteItem={handleDeleteSample}
        />
      </div>
  );
};

export default MainApp;