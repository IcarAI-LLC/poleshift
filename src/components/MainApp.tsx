import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SampleGroupMetadata } from "@/lib/types";
import { FileNodeType } from "@/lib/powersync/DrizzleSchema.ts";
import { useAuth, useData, useNetworkStatus, useUI } from "@/lib/hooks";

import LeftSidebar from "./LeftSidebar/LeftSidebar";
import RightSidebar from "./RightSidebar";
import MergedDropBoxes from "@/components/DropBoxView/DropBoxes/MergedDropboxes";
import ErrorMessage from "./ErrorMessage";
import GlobeComponent from "./GlobeComponent";
import ContextMenu from "./ContextMenu";
import AccountActions from "./Account/AccountActions";
import SampleGroupMetadataComponent from "./DropBoxView/SampleGroupMetadataComponent/SampleGroupMetadataComponent";
import FilterMenu from "./FilterMenu";
import OfflineWarning from "./OfflineWarning";
import MoveModal from "./LeftSidebar/MoveModal";
import ContainerScreen from "@/components/Container/ContainerScreen";
import ChatWidget from "@/components/Chatbot/ChatWidget";

const MainApp: React.FC = () => {
  // ---- Hooks ----
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  const networkStatus = useNetworkStatus();

  // ---- Destructure values from hooks ----
  const { error: authError, setError: setAuthError } = auth;
  const { sampleGroups, deleteNode, error: dataError } = data;
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    leftSidebarContextMenu,
    closeLeftSidebarContextMenu,
    isLeftSidebarCollapsed, // <-- important for shifting
  } = ui;
  const { isOnline } = networkStatus;

  // ---- Local state ----
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(true);

  // ---- Refs ----
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // ---- Memoized values ----
  const sampleGroup = useMemo<SampleGroupMetadata | null>(() => {
    if (!selectedLeftItem || selectedLeftItem.type !== FileNodeType.SampleGroup) {
      return null;
    }
    return sampleGroups[selectedLeftItem.id] as SampleGroupMetadata;
  }, [selectedLeftItem, sampleGroups]);

  const displayedError = useMemo(
      () => authError || dataError || errorMessage,
      [authError, dataError, errorMessage]
  );

  /**
   * Decide how much to shift everything (metadata + dropboxes)
   * when a sample group is selected:
   */
  const sidebarOffset = useMemo(() => {
    // If the sidebar is collapsed => margin-left: 4rem (16px icon bar)
    // If expanded => margin-left: 350px
    // If no sample group selected => no offset
    if (!sampleGroup) return "";
    return isLeftSidebarCollapsed ? "ml-16" : "ml-[350px]";
  }, [isLeftSidebarCollapsed, sampleGroup]);

  /**
   * Render main content depending on what is selected:
   * - SampleGroup => show dropboxes
   * - Container => show container screen
   * - Default => globe
   */
  const renderContent = useMemo(() => {
    if (selectedLeftItem?.type === FileNodeType.SampleGroup) {
      return <MergedDropBoxes onError={setErrorMessage} />;
    }
    if (selectedLeftItem?.type === FileNodeType.Container) {
      return <ContainerScreen />;
    }
    // Otherwise, show the globe
    return <GlobeComponent />;
  }, [selectedLeftItem?.type, setErrorMessage]);

  // ---- Callbacks ----
  const handleDeleteSample = useCallback(async () => {
    if (!leftSidebarContextMenu.itemId) {
      setErrorMessage("Could not determine which item to delete.");
      return;
    }

    try {
      await deleteNode(leftSidebarContextMenu.itemId);
      closeLeftSidebarContextMenu();
    } catch (error) {
      setErrorMessage(
          error instanceof Error
              ? error.message
              : "An error occurred while deleting the item."
      );
    }
  }, [
    leftSidebarContextMenu.itemId,
    deleteNode,
    closeLeftSidebarContextMenu,
    setErrorMessage,
  ]);

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

  // ---- Effects ----
  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setAuthError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage, setAuthError]);

  useEffect(() => {
    setShowOfflineWarning(!isOnline);
  }, [isOnline]);

  useEffect(() => {
    // Prevent scrolling behind filter menu
    document.body.style.overflow = isFilterMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFilterMenuOpen]);

  // ---- Render ----
  return (
      <div className="flex h- w-full flex-col">
        {/* Filter menu, if open */}
        {isFilterMenuOpen && (
            <FilterMenu
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                onClose={closeFilterMenu}
            />
        )}

        {/* Main content area: left sidebar + center content + right sidebar */}
        <div className="flex flex-1">
          <LeftSidebar openFilterMenu={openFilterMenu} />

          {/* Offline warning on top if needed */}
          <OfflineWarning
              isVisible={!isOnline && showOfflineWarning}
              message="You are offline"
              onClose={() => setShowOfflineWarning(false)}
          />

          {/*
          Wrap BOTH the SampleGroupMetadata and main body content
          in a <div> that transitions margin-left with the sidebar.
        */}
          <div className="flex flex-col w-full">
            <div className={`transition-all duration-300 ${sidebarOffset}`}>
              {/* If there's a selected SampleGroup, show metadata */}
              {sampleGroup && <SampleGroupMetadataComponent />}

              {/* The main "body" content (dropboxes, container screen, etc.) */}
              <div className="w-full">{renderContent}</div>
            </div>
          </div>

          {/* If there's an error, show it */}
          {displayedError && (
              <ErrorMessage
                  message={String(displayedError)}
                  onClose={() => setErrorMessage(null)}
              />
          )}

          {/* Right sidebar */}
          <RightSidebar />
        </div>

        {/* Chat widget + account actions if needed */}
        <ChatWidget />
        {showAccountActions && <AccountActions />}

        {/* Context menu + Move modal */}
        <ContextMenu deleteItem={handleDeleteSample} />
        <MoveModal />
      </div>
  );
};

export default React.memo(MainApp);
