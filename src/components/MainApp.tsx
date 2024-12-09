// src/lib/components/MainApp.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { SampleGroupMetadata } from '../lib/types';

import {
  useAuth,
  useData,
  useUI,
  useNetworkStatus,
  useStorage,
} from '../lib/hooks';
import { useProcessedData } from '../lib/hooks/useProcessedData';

import TopControls from './TopControls/TopControls';
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
import MoveModal from "./LeftSidebar/MoveModal";
import UploadQueueStatus from "./UploadQueueStatus";
import { getAllQueuedUploads, removeFromQueue, UploadTask } from "../lib/utils/uploadQueue";

const MainApp: React.FC = () => {
  // All hooks at the top level
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  const networkStatus = useNetworkStatus();
  const storage = useStorage();

  // Destructure values from hooks
  const { userProfile, error: authError, organization } = auth;
  const { sampleGroups, deleteNode, error: dataError } = data;
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    leftSidebarContextMenu,
    closeLeftSidebarContextMenu,
    toggleLeftSidebar,
    setShowAccountActions,
  } = ui;
  const { isOnline, isSyncing } = networkStatus;

  // Local state
  const [isUploadQueueOpen, setIsUploadQueueOpen] = useState(false);
  const [queuedUploads, setQueuedUploads] = useState<UploadTask[]>([]);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(true);

  // Refs
  const previousQueueRef = useRef<UploadTask[]>([]);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Memoized values
  const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
    if (!selectedLeftItem || selectedLeftItem.type !== 'sampleGroup') return null;
    return sampleGroups[selectedLeftItem.id];
  }, [selectedLeftItem, sampleGroups]);

  // Move hook to top level instead of inside useMemo
  const processedDataHook = useProcessedData({
    sampleGroup: sampleGroup as SampleGroupMetadata,
    orgShortId: organization?.org_short_id || '',
    orgId: organization?.id || '',
    organization,
    storage,
  });

  const displayedError = useMemo(() =>
          authError || dataError || errorMessage || processedDataHook.error,
      [authError, dataError, errorMessage, processedDataHook.error]
  );

  // Event handlers
  const handleToggleLeftSidebar = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    toggleLeftSidebar();
  }, [toggleLeftSidebar]);

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
  }, [leftSidebarContextMenu.itemId, deleteNode, closeLeftSidebarContextMenu, setErrorMessage]);

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

  const toggleUploadQueue = useCallback(() => {
    setIsUploadQueueOpen(prev => !prev);
  }, []);

  const handleCloseUploadQueue = useCallback(() => {
    setIsUploadQueueOpen(false);
  }, []);

  const renderContent = useMemo(() => {
    if (selectedLeftItem?.type === 'sampleGroup') {
      return <DropBoxes onError={setErrorMessage} />;
    }
    return <GlobeComponent />;
  }, [selectedLeftItem?.type, setErrorMessage]);

  // Effects
  useEffect(() => {
    const fetchQueuedUploads = async () => {
      const uploads = await getAllQueuedUploads();
      const updatedUploads: UploadTask[] = [];

      for (const upload of uploads) {
        const exists = await storage.fileExists(upload.path);
        if (exists) {
          await removeFromQueue(upload.id);
        } else {
          updatedUploads.push(upload);
        }
      }

      if (JSON.stringify(previousQueueRef.current) !== JSON.stringify(updatedUploads)) {
        previousQueueRef.current = updatedUploads;
        setQueuedUploads(updatedUploads);
      }
    };

    fetchQueuedUploads();
    const interval = setInterval(fetchQueuedUploads, 5000);
    return () => clearInterval(interval);
  }, [storage.fileExists]);

  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        processedDataHook.setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage, processedDataHook]);

  useEffect(() => {
    setShowOfflineWarning(!isOnline);
  }, [isOnline]);

  useEffect(() => {
    document.body.style.overflow = isFilterMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFilterMenuOpen]);

  return (
      <div id="app">
        <div className="app-container">
          <TopControls
              isSyncing={isSyncing}
              onToggleSidebar={handleToggleLeftSidebar}
              setShowAccountActions={setShowAccountActions}
              onOpenFilters={openFilterMenu}
              filterButtonRef={openButtonRef}
              queuedUploadsCount={queuedUploads.length}
              onToggleUploadQueue={toggleUploadQueue}
          />

          <LeftSidebar userTier={userProfile?.user_tier || 'researcher'} />

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

            <div className="content-body">{renderContent}</div>
          </div>

          <RightSidebar />
        </div>

        {showAccountActions && <AccountActions />}

        <ContextMenu deleteItem={handleDeleteSample} />

        <UploadQueueStatus
            isExpanded={isUploadQueueOpen}
            onClose={handleCloseUploadQueue}
            queuedUploads={queuedUploads}
            setQueuedUploads={setQueuedUploads}
        />

        <MoveModal />
      </div>
  );
};

export default React.memo(MainApp);