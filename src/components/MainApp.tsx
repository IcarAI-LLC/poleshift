// src/lib/components/MainApp.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {SampleGroupMetadata} from '@/lib/types';

import {useAuth, useData, useNetworkStatus, useUI,} from '@/lib/hooks';

import TopControls from './TopControls/TopControls';
import LeftSidebar from './LeftSidebar/LeftSidebar';
import RightSidebar from './RightSidebar';
import MergedDropBoxes from './DropBoxes/MergedDropboxes.tsx';
import ErrorMessage from './ErrorMessage';
import GlobeComponent from './GlobeComponent';
import ContextMenu from './ContextMenu';
import AccountActions from './Account/AccountActions';
import SampleGroupMetadataComponent from './SampleGroupMetadataComponent.tsx';
import FilterMenu from './FilterMenu';
import OfflineWarning from './OfflineWarning';
import MoveModal from "./LeftSidebar/MoveModal";
import {FileNodeType} from "@/lib/powersync/DrizzleSchema.ts";
import ContainerScreen from "@/components/Container/ContainerScreen.tsx";

const MainApp: React.FC = () => {
  // All hooks at the top level
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  const networkStatus = useNetworkStatus();

  // Destructure values from hooks
  const { error: authError, setError } = auth;
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
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(true);

  // Refs
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // Memoized values
  const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
    if (!selectedLeftItem || selectedLeftItem.type !== FileNodeType.SampleGroup) return null;
    return sampleGroups[selectedLeftItem.id] as SampleGroupMetadata;
  }, [selectedLeftItem, sampleGroups]);

  const displayedError = useMemo(() =>
          authError || dataError || errorMessage,
      [authError, dataError, errorMessage]
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

  const renderContent = useMemo(() => {
    if (selectedLeftItem?.type === FileNodeType.SampleGroup) {
      return <MergedDropBoxes onError={setErrorMessage} />;
    }
    if (selectedLeftItem?.type === FileNodeType.Container) {
      return <ContainerScreen />;
    }
    return <GlobeComponent />;
  }, [selectedLeftItem?.type, setErrorMessage]);

  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage]);

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
          />

          {isFilterMenuOpen && (
              <FilterMenu
                  onApply={handleApplyFilters}
                  onReset={handleResetFilters}
                  onClose={closeFilterMenu}
              />
          )}

          <div className="main-content">
            <LeftSidebar />

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

        <MoveModal />
      </div>
  );
};

export default React.memo(MainApp);