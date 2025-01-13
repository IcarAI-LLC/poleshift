import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FileNodeType } from "@/lib/powersync/DrizzleSchema.ts";
import { useAuth, useData, useUI } from "@/hooks";

import LeftSidebar from "./LeftSidebar/LeftSidebar";
import RightSidebar from "./RightSidebar";
import MergedDropBoxes from "@/components/SampleGroupView/MergedDropboxes.tsx";
import ErrorMessage from "./ErrorMessage";
import { Suspense, lazy } from 'react';
const GlobeComponent = lazy(() => import('./GlobeComponent.tsx'));
import ContextMenu from "./ContextMenu";
import AccountModal from "./LeftSidebar/Modals/AccountModal.tsx";
import SampleGroupMetadataComponent from "@/components/SampleGroupView/SampleGroupMetadataComponent.tsx";
import FilterMenu from "./FilterMenu";
import MoveModal from "./LeftSidebar/Modals/MoveModal";
import ContainerScreen from "@/components/Container/ContainerScreen";
import ChatWidget from "@/components/Chatbot/ChatWidget";
import CheckResourceFiles from "@/components/CheckResourceFiles.tsx";
import DnaLoadingIcon from "@/components/DnaLoadingIcon.tsx";

const MainApp: React.FC = () => {
  // ---- Hooks ----
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  CheckResourceFiles({});

  // ---- Destructure values from hooks ----
  const { error: authError, setError: setAuthError } = auth;
  const { deleteNode, error: dataError } = data;
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
    leftSidebarContextMenu,
    closeLeftSidebarContextMenu,
  } = ui;
  // ---- Local state ----
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // ---- Refs ----
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const displayedError = authError || dataError || errorMessage;

  /**
   * Render main content depending on what is selected:
   * - SampleGroup => show dropboxes
   * - Container => show container screen
   * - Default => globe
   */
  const renderContent = (() => {
    switch (selectedLeftItem?.type){
      case FileNodeType.SampleGroup:
        return(
            <div>
              <SampleGroupMetadataComponent />
              <MergedDropBoxes onError={setErrorMessage} />
            </div>);
        case FileNodeType.Container:
          return <ContainerScreen />;
      case FileNodeType.Folder:
        return null;
      default:
        return(
          <Suspense fallback={<DnaLoadingIcon/>}>
            <div className={"w-screen"}>
            <GlobeComponent/>
            <RightSidebar />
            </div>
          </Suspense>)
    }
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
      <div>
        {/* Filter menu, if open */}
        {isFilterMenuOpen && (
            <FilterMenu
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                onClose={closeFilterMenu}
            />
        )}

        {/* Main content area: left sidebar + center content + right sidebar */}
        <div className="flex justify-center items-center h-screen w-screen">
          <LeftSidebar openFilterMenu={openFilterMenu} />
          <div className="flex flex-col grow h-screen">
            <div className={`transition-all duration-300`}>
              {renderContent}
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
