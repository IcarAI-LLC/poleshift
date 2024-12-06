// src/lib/components/MainApp.tsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import {
  useAuth,
  useData,
  useUI,
  useNetworkStatus,
  useProcessedData,
  useStorage,
} from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';
import type { DropboxConfigItem } from '../config/dropboxConfig';

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
import UploadQueueStatus from './UploadQueueStatus'; // Import the new component

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
  // Hooks
  const { userProfile, error: authError, organization } = useAuth();
  const { sampleGroups, deleteNode, error: dataError } = useData();
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    leftSidebarContextMenu,
    closeLeftSidebarContextMenu  // Changed from setLeftSidebarContextMenuState
  } = useUI();
  const { isOnline } = useNetworkStatus();
  const { fetchProcessedData } = useProcessedData();
  const storage = useStorage();

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

  // Clear error message after timeout
  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage]);

  // Reset offline warning visibility when online status changes
  useEffect(() => {
    setShowOfflineWarning(!isOnline);
  }, [isOnline]);

  const handleDataProcessed = useCallback(
      async ({ insertData, processedData }: DataProcessedParams) => {
        console.log("Handling data processed");
        try {
          // If there are any processed files to upload
          if (processedData.files) {
            const basePath = `${organization?.org_short_id}/${insertData.sampleId}`;
            const uploadedProcessedPaths = await storage.uploadFiles(
                processedData.files,
                basePath,
                'processed-data',
                (progress) => {
                  console.log('Processed files upload progress:', progress);
                }
            );

            // Update processedData with uploaded processed paths
            processedData.uploadedProcessedPaths = uploadedProcessedPaths;
          }

          if (sampleGroup) {
            await fetchProcessedData(sampleGroup);
          }
        } catch (error) {
          setErrorMessage(
              error instanceof Error ? error.message : 'Failed to process data'
          );
        }
      },
      [sampleGroup, fetchProcessedData, storage, setErrorMessage, organization]
  );

// Then update handleDeleteSample to use leftSidebarContextMenu instead of contextMenu:
  const handleDeleteSample = useCallback(async () => {
    if (!leftSidebarContextMenu.itemId) {
      setErrorMessage('Could not determine which item to delete.');
      return;
    }

    try {
      await deleteNode(leftSidebarContextMenu.itemId);
      closeLeftSidebarContextMenu();  // Changed from setLeftSidebarContextMenuState
    } catch (error) {
      setErrorMessage(
          error instanceof Error
              ? error.message
              : 'An error occurred while deleting the item.'
      );
    }
  }, [leftSidebarContextMenu, deleteNode, closeLeftSidebarContextMenu, setErrorMessage]);

  const handleApplyFilters = useCallback(() => {
    // Filters have already been applied via setFilters in FilterMenu
    setIsFilterMenuOpen(false);
  }, []);

  const handleResetFilters = useCallback(() => {
    // Reset is handled in FilterMenu component
    setIsFilterMenuOpen(false);
  }, []);

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
                    message={displayedError}
                    onClose={() => setErrorMessage(null)}
                    className="error-message"
                />
            )}

            <div className="content-body">{renderContent()}</div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}

        <ContextMenu deleteItem={handleDeleteSample} />

        <UploadQueueStatus /> {/* Add the Upload Queue Status component */}
      </div>
  );
};

export default MainApp;
