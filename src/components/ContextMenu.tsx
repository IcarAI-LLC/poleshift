// src/components/ContextMenu.tsx

import React, { useCallback, useEffect, useMemo } from 'react';
import { useUI } from '../lib/hooks';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { useAuthStore } from "../lib/stores/authStore.ts";
import { PoleshiftPermissions } from "../lib/types";

/**
 * Props for the ContextMenu component.
 * - `deleteItem`: Function to handle the deletion of an item by its ID.
 */
interface ContextMenuProps {
  deleteItem: (id: string) => Promise<void>;
}

/**
 * Styles for various parts of the ContextMenu.
 */
interface StyleProps {
  menu: SxProps<Theme>;
  list: SxProps<Theme>;
  listItemButton: SxProps<Theme>;
  icon: SxProps<Theme>;
}

/**
 * The ContextMenu component displays a contextual menu with actions like
 * "Delete" and "Move to Folder". These actions are enabled or disabled
 * based on the user's permissions.
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ deleteItem }) => {
  const {
    leftSidebarContextMenu,
    selectedLeftItem,
    setSelectedLeftItem,
    closeLeftSidebarContextMenu,
    setErrorMessage,
    setShowMoveModal, // Function to show the move modal
  } = useUI();

  // Extract user permissions from the auth store
  const { userPermissions } = useAuthStore.getState();

  const { isVisible, x, y, itemId } = leftSidebarContextMenu;
  console.debug('Left sidebar context menu:', leftSidebarContextMenu);
  /**
   * 1. **Define User Permissions**
   *    - `canDeleteSampleGroup`: True if the user has permission to delete sample groups.
   *    - `canModifySampleGroup`: True if the user has permission to modify sample groups.
   */
  const canDeleteSampleGroup =
      userPermissions?.includes(PoleshiftPermissions.DeleteSampleGroup) ?? false;
  const canModifySampleGroup =
      userPermissions?.includes(PoleshiftPermissions.ModifySampleGroup) ?? false;

  /**
   * 2. **Memoize Styles**
   */
  const styles = useMemo<StyleProps>(
      () => ({
        menu: {
          position: 'absolute',
          top: y,
          left: x,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 3,
          minWidth: 150,
          zIndex: 1000,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 0.2s, transform 0.2s',
          // Maintain original padding if any
        },
        list: {
          p: 0, // Ensure no extra padding
        },
        listItemButton: {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1, // Original vertical padding
          px: 2, // Original horizontal padding
          cursor: 'pointer',
          color: 'text.primary',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          // Maintain consistent padding and spacing
        },
        icon: {
          color: 'text.primary',
          fontSize: '1.25rem',
        },
      }),
      [x, y, isVisible]
  );

  /**
   * 3. **Handle Clicks Outside the Context Menu**
   *    - Closes the context menu if a click is detected outside of it.
   */
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Ensure we're not clicking inside the menu
      const menu = document.getElementById('context-menu');
      if (menu && !menu.contains(event.target as Node)) {
        closeLeftSidebarContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isVisible, closeLeftSidebarContextMenu]);

  /**
   * 4. **Handle Delete Action**
   *    - Deletes the selected item if the user has the necessary permission.
   *    - Shows an error message if the user lacks permission or if deletion fails.
   */
  const handleDelete = useCallback(async () => {
    if (!itemId) return;

    if (!canDeleteSampleGroup) {
      setErrorMessage('You do not have permission to delete this sample group.');
      return;
    }

    try {
      await deleteItem(itemId);

      // Clear selected item if it was deleted
      if (selectedLeftItem?.id === itemId) {
        setSelectedLeftItem(undefined);
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      setErrorMessage(
          error instanceof Error ? error.message : 'Failed to delete item'
      );
    } finally {
      closeLeftSidebarContextMenu();
    }
  }, [
    itemId,
    deleteItem,
    selectedLeftItem,
    setSelectedLeftItem,
    setErrorMessage,
    closeLeftSidebarContextMenu,
    canDeleteSampleGroup,
  ]);

  /**
   * 5. **Handle "Move to Folder" Action**
   *    - Opens a modal to move the selected item to another folder if the user has permission.
   *    - Shows an error message if the user lacks permission.
   */
  const handleMoveToFolder = useCallback(() => {
    if (!itemId) return;

    if (!canModifySampleGroup) {
      setErrorMessage('You do not have permission to modify this sample group.');
      return;
    }

    // Show a modal that allows the user to select a folder
    setShowMoveModal(itemId);
    closeLeftSidebarContextMenu();
  }, [
    itemId,
    closeLeftSidebarContextMenu,
    setShowMoveModal,
    canModifySampleGroup,
    setErrorMessage,
  ]);

  /**
   * 6. **Handle Keyboard Navigation**
   *    - Allows users to navigate the context menu using the keyboard.
   */
  const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
          closeLeftSidebarContextMenu();
        } else if (event.key === 'Enter' || event.key === ' ') {
          handleDelete();
        }
      },
      [closeLeftSidebarContextMenu, handleDelete]
  );

  /**
   * 7. **Early Return if Context Menu is Not Visible**
   */
  if (!isVisible) return null;

  /**
   * 8. **Render the Context Menu**
   *    - Uses `ListItemButton` with the `disabled` prop to handle disabled states.
   *    - Wraps disabled items in a `span` to allow `Tooltip` to function correctly.
   */
  return (
      <Box
          id="context-menu"
          role="menu"
          aria-label="Context Menu"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          sx={styles.menu}
      >
        <List sx={styles.list}>
          {/* Delete Menu Item */}
          <Tooltip
              title={
                canDeleteSampleGroup
                    ? 'Delete'
                    : 'You do not have permission to delete this sample group.'
              }
              placement="left"
              disableHoverListener={canDeleteSampleGroup}
          >
            {/*
            Wrapping ListItemButton in a span is necessary because disabled elements
            do not trigger Tooltip. The span allows Tooltip to work correctly.
          */}
            <span>
            <ListItemButton
                role="menuitem"
                onClick={handleDelete}
                sx={styles.listItemButton}
                disabled={!canDeleteSampleGroup}
            >
              <ListItemIcon>
                <DeleteIcon sx={{ ...styles.icon, color: 'error.main' }} />
              </ListItemIcon>
              <ListItemText primary="Delete" />
            </ListItemButton>
          </span>
          </Tooltip>

          {/* Move to Folder Menu Item */}
          <Tooltip
              title={
                canModifySampleGroup
                    ? 'Move to Folder'
                    : 'You do not have permission to modify this sample group.'
              }
              placement="left"
              disableHoverListener={canModifySampleGroup}
          >
          <span>
            <ListItemButton
                role="menuitem"
                onClick={handleMoveToFolder}
                sx={styles.listItemButton}
                disabled={!canModifySampleGroup}
            >
              <ListItemIcon>
                <DriveFileMoveIcon sx={styles.icon} />
              </ListItemIcon>
              <ListItemText primary="Move to Folder" />
            </ListItemButton>
          </span>
          </Tooltip>
        </List>
      </Box>
  );
};

ContextMenu.displayName = 'ContextMenu';

export default React.memo(ContextMenu);
