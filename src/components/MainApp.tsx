// src/lib/components/MainApp.tsx

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import {
  useAuth,
  useData,
  useUI,
  useNetworkStatus,
  useProcessedData,
  useStorage, // Import the useStorage hook
} from '../lib/hooks';
import type { FileNode, SampleGroupMetadata } from '../lib/types';
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
    setFilters,
    setContextMenuState,
    contextMenu,
  } = useUI();
  const { isOnline } = useNetworkStatus();
  const { fetchProcessedData } = useProcessedData();
  const storage = useStorage(); // Use the storage hook

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
      async ({ insertData, configItem, processedData }: DataProcessedParams) => {
        try {
          // If there are any processed files to upload
          if (processedData.files) {
            const basePath = `${organization.org_short_id}/${insertData.sampleId}`;
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

  const handleDeleteSample = useCallback(async () => {
    if (!contextMenu.itemId) {
      setErrorMessage('Could not determine which item to delete.');
      return;
    }

    try {
      await deleteNode(contextMenu.itemId);
      setContextMenuState({ isVisible: false, x: 0, y: 0, itemId: null });
    } catch (error) {
      setErrorMessage(
          error instanceof Error
              ? error.message
              : 'An error occurred while deleting the item.'
      );
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
      </div>
  );
};

export default MainApp;
