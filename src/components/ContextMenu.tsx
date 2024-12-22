// src/components/ContextMenu.tsx

import React, { useEffect, useCallback, useMemo } from 'react';
import { useUI, useAuth } from '../lib/hooks';
import type { SxProps, Theme } from '@mui/material/styles';
import { Box, List, ListItem } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';

interface ContextMenuProps {
  deleteItem: (id: string) => Promise<void>;
}

interface StyleProps {
  menu: SxProps<Theme>;
  list: SxProps<Theme>;
  listItem: SxProps<Theme>;
  icon: SxProps<Theme>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ deleteItem }) => {
  const {
    leftSidebarContextMenu,
    selectedLeftItem,
    setSelectedLeftItem,
    closeLeftSidebarContextMenu,
    setErrorMessage,
    setShowMoveModal, // We'll add this to manage showing the move modal
  } = useUI();

  const { userProfile } = useAuth();
  const { isVisible, x, y, itemId } = leftSidebarContextMenu;
  console.debug('Left sidebar context menu:', leftSidebarContextMenu);
  // Memoized styles
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
        },
        list: {
          p: 0.5,
        },
        listItem: {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 2,
          cursor: 'pointer',
          color: 'text.primary',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        },
        icon: {
          color: 'text.primary',
          fontSize: '1.25rem',
        },
      }),
      [x, y, isVisible]
  );

  // Click outside handler
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

  // Handle delete action
  const handleDelete = useCallback(async () => {
    if (!itemId) return;

    try {
      await deleteItem(itemId);

      // Clear selected item if it was deleted
      if (selectedLeftItem?.id === itemId) {
        setSelectedLeftItem(undefined);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage(
          error instanceof Error ? error.message : 'Failed to delete item'
      );
      //@ts-ignore
      setLeftSidebarContextMenuState((prev) => ({
        ...prev,
        isVisible: false,
      }));
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
  ]);

  // Handle "Move to Folder" action
  const handleMoveToFolder = useCallback(() => {
    if (!itemId) return;
    // Show a modal that allows the user to select a folder
    setShowMoveModal(itemId);
    closeLeftSidebarContextMenu();
  }, [itemId, closeLeftSidebarContextMenu, setShowMoveModal]);

  // Handle keyboard navigation
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

  if (!isVisible) return null;

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
          {userProfile?.user_tier === 'admin' && (
              <>
                <ListItem role="menuitem" onClick={handleDelete} sx={styles.listItem}>
                  <DeleteIcon sx={{ ...styles.icon, color: 'error.main' }} />
                  Delete
                </ListItem>
                <ListItem role="menuitem" onClick={handleMoveToFolder} sx={styles.listItem}>
                  <DriveFileMoveIcon sx={styles.icon} />
                  Move to Folder
                </ListItem>
              </>
          )}
        </List>
      </Box>
  );
};

ContextMenu.displayName = 'ContextMenu';

export default React.memo(ContextMenu);
