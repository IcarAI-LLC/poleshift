import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SampleGroupMetadata } from "src/types";
import { FileNodeType } from "@/lib/powersync/DrizzleSchema.ts";
import { useAuth, useData, useUI } from "@/hooks";

import LeftSidebar from "./LeftSidebar/LeftSidebar";
import RightSidebar from "./RightSidebar";
import MergedDropBoxes from "@/components/SampleGroupView/MergedDropboxes.tsx";
import ErrorMessage from "./ErrorMessage";
import GlobeComponent from "./GlobeComponent";
import ContextMenu from "./ContextMenu";
import AccountModal from "./LeftSidebar/Modals/AccountModal.tsx";
import SampleGroupMetadataComponent from "@/components/SampleGroupView/SampleGroupMetadataComponent.tsx";
import FilterMenu from "./FilterMenu";
import MoveModal from "./LeftSidebar/Modals/MoveModal";
import ContainerScreen from "@/components/Container/ContainerScreen";
import ChatWidget from "@/components/Chatbot/ChatWidget";
import CheckResourceFiles from "@/components/CheckResourceFiles.tsx";

const MainApp: React.FC = () => {
  // ---- Hooks ----
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  CheckResourceFiles({});

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
    isLeftSidebarCollapsed,
  } = ui;
  // ---- Local state ----
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // ---- Refs ----
  const openButtonRef = useRef<HTMLButtonElement>(null);

  // ---- Derived values ----
  const sampleGroup =
      selectedLeftItem?.type === FileNodeType.SampleGroup
          ? (sampleGroups[selectedLeftItem.id] as SampleGroupMetadata)
          : null;

  const displayedError = authError || dataError || errorMessage;

  /**
   * Decide how much to shift everything (metadata + dropboxes)
   * when a sample group is selected.
   */
  const sidebarOffset =
      !sampleGroup && selectedLeftItem?.type !== FileNodeType.Container
          ? ""
          : isLeftSidebarCollapsed
              ? "ml-16"
              : "ml-[350px]";

  /**
   * Render main content depending on what is selected:
   * - SampleGroup => show dropboxes
   * - Container => show container screen
   * - Default => globe
   */
  const renderContent = (() => {
    if (selectedLeftItem?.type === FileNodeType.SampleGroup) {
      return <MergedDropBoxes onError={setErrorMessage} />;
    }
    if (selectedLeftItem?.type === FileNodeType.Container) {
      return <ContainerScreen />;
    }
    // Otherwise, show the globe
    return <GlobeComponent />;
  })();

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
  // Auto-dismiss errors after 5s
  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setAuthError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage, setAuthError]);

  // Prevent scrolling behind filter menu
  useEffect(() => {
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
        {showAccountActions && <AccountModal />}

        {/* Context menu + Move modal */}
        <ContextMenu deleteItem={handleDeleteSample} />
        <MoveModal />
      </div>
  );
};

export default React.memo(MainApp);
