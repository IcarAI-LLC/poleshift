// src/renderer/components/ContextMenu.tsx

import React, { useEffect } from 'react';
import useUI from '../hooks/useUI';
import './ContextMenu.css';

interface ContextMenuProps {
  deleteItem: (id: string) => Promise<void>; // Updated to return a Promise
  userTier: string; // Assuming you pass userTier as a prop
}

const ContextMenu: React.FC<ContextMenuProps> = ({ deleteItem, userTier }) => {
  const {
    contextMenuState,
    setContextMenuState,
    selectedLeftItem,
    setSelectedLeftItem,
  } = useUI();
  const { isVisible, x, y, itemId } = contextMenuState;

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuState((prevState) => ({ ...prevState, isVisible: false }));
    };

    if (isVisible) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible, setContextMenuState]);

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
        // Optionally, display an error message to the user
        alert(error.message || 'Failed to delete the item.');
      }
      setContextMenuState((prevState) => ({ ...prevState, isVisible: false }));
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`context-menu ${isVisible ? 'context-menu--visible' : ''}`}
      style={{ top: `${y}px`, left: `${x}px`, position: 'absolute' }}
    >
      <ul className="context-menu__list">
        {userTier === 'admin' && (
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
