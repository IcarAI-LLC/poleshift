// src/lib/hooks/useUI.ts

import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore.ts';
import type { FileNodes, SampleLocations } from '@/types';

export const useUI = () => {
  const {
    isLeftSidebarCollapsed,
    isRightSidebarCollapsed,
    selectedLeftItem,
    selectedRightItem,
    leftSidebarContextMenu,
    showAccountActions,
    errorMessage,
    filters,
    toggleLeftSidebar,
    toggleRightSidebar,
    setSelectedLeftItem,
    setSelectedRightItem,
    setLeftSidebarContextMenuState,
    closeLeftSidebarContextMenu,
    setShowAccountActions,
    setErrorMessage,
    setFilters,
    resetFilters,
    moveModalItemId,
    showMoveModal,
    hideMoveModal,
  } = useUIStore();

  // Enhanced sidebar handlers
  const handleToggleLeftSidebar = useCallback(() => {
    toggleLeftSidebar();
  }, [toggleLeftSidebar]);

  const handleToggleRightSidebar = useCallback(() => {
    toggleRightSidebar();
  }, [toggleRightSidebar]);

  // Selection handlers with type safety
  const handleSelectLeftItem = useCallback(
    (item: FileNodes | undefined) => {
      setSelectedLeftItem(item);
    },
    [setSelectedLeftItem]
  );

  const handleSelectRightItem = useCallback(
    (item: SampleLocations | null) => {
      setSelectedRightItem(item);
      if (item) {
        toggleRightSidebar(false); // Open sidebar when item is selected
      }
    },
    [setSelectedRightItem, toggleRightSidebar]
  );

  // Context menu handlers for left sidebar
  const handleLeftSidebarContextMenu = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.preventDefault();
      setLeftSidebarContextMenuState({
        isVisible: true,
        x: e.clientX,
        y: e.clientY,
        itemId,
      });
    },
    [setLeftSidebarContextMenuState]
  );

  const handleCloseLeftSidebarContextMenu = useCallback(() => {
    closeLeftSidebarContextMenu();
  }, [closeLeftSidebarContextMenu]);

  // Error message handlers with timeout
  const handleSetErrorMessage = useCallback(
    (message: string | null) => {
      setErrorMessage(message);
      if (message) {
        setTimeout(() => {
          setErrorMessage(null);
        }, 5000); // Clear error after 5 seconds
      }
    },
    [setErrorMessage]
  );

  // Filter handlers with validation
  const handleSetFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      // Validate date ranges if both are provided
      if (newFilters.startDate && newFilters.endDate) {
        if (new Date(newFilters.startDate) > new Date(newFilters.endDate)) {
          handleSetErrorMessage('Start date cannot be after end date');
          return;
        }
      }
      setFilters(newFilters);
    },
    [setFilters, handleSetErrorMessage]
  );

  return {
    // State
    isLeftSidebarCollapsed,
    isRightSidebarCollapsed,
    selectedLeftItem,
    selectedRightItem,
    leftSidebarContextMenu,
    showAccountActions,
    errorMessage,
    filters,

    // Enhanced actions
    toggleLeftSidebar: handleToggleLeftSidebar,
    toggleRightSidebar: handleToggleRightSidebar,
    setSelectedLeftItem: handleSelectLeftItem,
    setSelectedRightItem: handleSelectRightItem,
    handleLeftSidebarContextMenu,
    closeLeftSidebarContextMenu: handleCloseLeftSidebarContextMenu,
    setShowAccountActions,
    setErrorMessage: handleSetErrorMessage,
    setFilters: handleSetFilters,
    resetFilters,

    // Utility getters
    hasSelectedItem: Boolean(selectedLeftItem || selectedRightItem),
    isLeftSidebarContextMenuOpen: leftSidebarContextMenu.isVisible,

    moveModalItemId,
    setShowMoveModal: showMoveModal,
    setHideMoveModal: hideMoveModal,
  };
};

export default useUI;
