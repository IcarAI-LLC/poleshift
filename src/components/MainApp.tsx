import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import {
  useAuth,
  useData,
  useUI,
  useNetworkStatus,
  useProcessedData,
  services,
  SyncService // Add this import
} from '../lib';
import type { FileNode, SampleGroupMetadata } from '../lib/types';
import type { DropboxConfigItem } from '../config/dropboxConfig';
import { initializeSync } from '../lib/index.ts';  // Update this import path

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

interface DataProcessedParams {
  insertData: {
    sampleId: string;
    configId: string;
    timestamp: number;
    status: string;
  };
  configItem: DropboxConfigItem;
  processedData: any;
}

const MainApp: React.FC = () => {
  const { userProfile, error: authError } = useAuth();
  const { sampleGroups, deleteNode, error: dataError } = useData();
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    setFilters,
    setContextMenuState,
    contextMenu
  } = useUI();
  const { isOnline } = useNetworkStatus();
  const { fetchProcessedData } = useProcessedData();

// In the useEffect:
  useEffect(() => {
    const syncService = initializeSync(services.api, services.storage);
    const cleanup = syncService.initialize();

    return () => {
      cleanup();
    };
  }, []);

  // Local state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(true);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Get current sample group based on selection
  const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
    if (!selectedLeftItem || selectedLeftItem.type !== 'sampleGroup') return null;
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

  // Reset offline warning visibility when online status changes
  useEffect(() => {
    setShowOfflineWarning(!isOnline);
  }, [isOnline]);

  const handleDataProcessed = useCallback(
      ({ insertData, configItem, processedData }: DataProcessedParams) => {
        console.log('Data processed:', {
          insertData,
          configId: configItem.id,
          processedData
        });

        if (sampleGroup) {
          fetchProcessedData(sampleGroup);
        }
      },
      [sampleGroup, fetchProcessedData]
  );

  const handleDeleteSample = useCallback(async () => {
    if (!contextMenu.itemId) {
      setErrorMessage('Could not determine which item to delete.');
      return;
    }

    try {
      await deleteNode(contextMenu.itemId);
      setContextMenuState({ ...contextMenu, isVisible: false });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred while deleting the item.');
    }
  }, [contextMenu, deleteNode, setContextMenuState, setErrorMessage]);

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

  const renderContent = useCallback(() => {
    if (selectedLeftItem?.type === 'sampleGroup') {
      return (
          <DropBoxes
              onDataProcessed={handleDataProcessed}
              onError={setErrorMessage}
          />
      );
    }
    return <GlobeComponent />;
  }, [selectedLeftItem?.type, handleDataProcessed, setErrorMessage]);

  return (
      <div id="app">
        <div className="app-container">
          <LeftSidebar userTier={userProfile?.user_tier || "researcher"} />

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
                    message={displayedError}
                    onClose={() => setErrorMessage('')}
                    className="error-message"
                />
            )}

            <div className="content-body">
              {renderContent()}
            </div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}

        <ContextMenu deleteItem={handleDeleteSample} />
      </div>
  );
};

export default MainApp;