import React, {
  Suspense,
  useCallback,
  useEffect,
} from "react";
import { FileNodeType } from "@/lib/powersync/DrizzleSchema.ts";
import { useAuth, useData, useUI } from "@/hooks";

import LeftSidebar from "./LeftSidebar/LeftSidebar";
import RightSidebar from "./RightSidebar";

import MergedDropBoxes from "@/components/SampleGroupView/MergedDropboxes.tsx";
import SampleGroupMetadataComponent from "@/components/SampleGroupView/SampleGroupMetadataComponent.tsx";
import ContainerScreen from "@/components/Container/ContainerScreen";
import GlobeComponent from "@/components/GlobeComponent.tsx";

import ContextMenu from "./ContextMenu";
import MoveModal from "./LeftSidebar/Modals/MoveModal";
import AccountModal from "./LeftSidebar/Modals/AccountModal.tsx";

import ErrorMessage from "./ErrorMessage";
import ChatWidget from "@/components/Chatbot/ChatWidget";
import CheckResourceFiles from "@/components/CheckResourceFiles.tsx";
import {Loader2} from "lucide-react";

const MainApp: React.FC = () => {
  // ---- Hooks & Setup ----
  const auth = useAuth();
  const data = useData();
  const ui = useUI();
  CheckResourceFiles({});

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
  const displayedError = authError || dataError || errorMessage;

  // ---- Effects ----
  // Auto-dismiss errors
  useEffect(() => {
    if (displayedError) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setAuthError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, setErrorMessage, setAuthError]);

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

  // ---- Determine which content to show (Globe vs. Non-Globe) ----
  const isGlobe =
      !selectedLeftItem ||
      (selectedLeftItem.type !== FileNodeType.SampleGroup &&
          selectedLeftItem.type !== FileNodeType.Container);

  /**
   * For non-globe content (SampleGroup or Container),
   * no extra padding around the content.
   */
  function renderNonGlobeContent() {
    switch (selectedLeftItem?.type) {
      case FileNodeType.SampleGroup:
        return (
            <div className="w-full h-full overflow-auto">
              <SampleGroupMetadataComponent />
              <MergedDropBoxes onError={setErrorMessage} />
            </div>
        );
      case FileNodeType.Container:
        return (
            <div className="w-full h-full overflow-auto">
              <ContainerScreen />
            </div>
        );
      default:
        return null;
    }
  }

  // ---- Render ----
  return (
      <div className="w-screen h-screen">
        {/* (1) GLOBE: absolutely positioned to fill the screen, pointer-events on */}
        {isGlobe && (
            <div className="absolute">
                <Suspense fallback={
                <div style={{marginBottom: "1rem"}}>
                  <Loader2
                      className="animate-spin"
                  />
                </div>}>
                <GlobeComponent />
              </Suspense>
            </div>
        )}

        {/* (2) FOREGROUND LAYOUT: sidebars + content over the globe */}
        <div className="z-10 w-full h-full flex">
          {/* Left Sidebar: pointer-events-auto so it’s clickable */}
          <div className="overflow-auto pointer-events-auto">
            <LeftSidebar/>
          </div>

          {/* Main content area */}
          {isGlobe ? (
                <div className={"pointer-events-auto"}>
                  <RightSidebar/>
                </div>
          ) : (
              /* (B) Non-Globe content (SampleGroup or Container).
                 * This content can fully intercept clicks.
                 */
              <div className="flex-1 pointer-events-auto">
                {renderNonGlobeContent()}
              </div>
          )}
        </div>
        {/* (4) ERROR MESSAGE TOAST */}
        {displayedError && (
            <ErrorMessage
                message={String(displayedError)}
                onClose={() => setErrorMessage(null)}
            />
        )}

        {/* (5) CHAT WIDGET */}
        <ChatWidget />

        {/* (6) ACCOUNT MODAL / CONTEXT MENU / MOVE MODAL */}
        {showAccountActions && <AccountModal />}
        <ContextMenu deleteItem={handleDeleteSample} />
        <MoveModal />
      </div>
  );
};

export default React.memo(MainApp);
