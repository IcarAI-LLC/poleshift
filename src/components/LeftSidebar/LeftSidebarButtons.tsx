// src/components/LeftSidebar/LeftSidebarButtons.tsx

import React from 'react';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

interface SidebarButtonsProps {
  isSidebarCollapsed: boolean;
  onCreateSampleGroup: () => void;
  onCreateFolder: () => void;
}

const LeftSidebarButtons: React.FC<SidebarButtonsProps> = ({
  isSidebarCollapsed,
  onCreateSampleGroup,
  onCreateFolder,
}) => {
  return (
    <div className="left-sidebar__buttons">
      <button
        className="left-sidebar__button"
        onClick={onCreateSampleGroup}
        aria-label="Create New Sampling Event"
      >
        <AddCircleIcon className="left-sidebar__button-icon" />
        {!isSidebarCollapsed && 'New Sampling Event'}
      </button>
      <button
        className="left-sidebar__button"
        onClick={onCreateFolder}
        aria-label="Create New Folder"
      >
        <CreateNewFolderIcon className="left-sidebar__button-icon" />
        {!isSidebarCollapsed && 'New Folder'}
      </button>
    </div>
  );
};

export default LeftSidebarButtons;
