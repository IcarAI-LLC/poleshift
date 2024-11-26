// src/renderer/components/ContextMenu.tsx

import React, { useEffect } from 'react';
import { useUI } from '../lib/hooks';
import { useAuth } from '../lib/hooks';
import './ContextMenu.css';

interface ContextMenuProps {
  deleteItem: (id: string) => Promise<void>;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ deleteItem }) => {
  const {
    contextMenu,
    setContextMenuState,
    selectedLeftItem,
    setSelectedLeftItem,
    closeContextMenu
  } = useUI();

  const { userProfile } = useAuth();
  const { isVisible, x, y, itemId } = contextMenu;

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (isVisible) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible, closeContextMenu]);

  const handleDelete = async () => {
    if (itemId) {
      try {
        await deleteItem(itemId);

        // If the deleted item is the currently selected left item, clear it
        if (selectedLeftItem && selectedLeftItem.id === itemId) {
          setSelectedLeftItem(null);
        }
      } catch (error: any) {
        console.error('Error deleting item from ContextMenu:', error);
        // You might want to use your UI error handling here instead of alert
        setContextMenuState({
          ...contextMenu,
          isVisible: false
        });
        throw error; // Let the parent component handle the error display
      }
      closeContextMenu();
    }
  };

  if (!isVisible) return null;

  return (
      <div
          className={`context-menu ${isVisible ? 'context-menu--visible' : ''}`}
          style={{ top: `${y}px`, left: `${x}px`, position: 'absolute' }}
      >
        <ul className="context-menu__list">
          {userProfile?.user_tier === 'admin' && (
              <li className="context-menu__item" onClick={handleDelete}>
                Delete
              </li>
          )}
          {/* Add more context menu items as needed */}
        </ul>
      </div>
  );
};

export default ContextMenu;