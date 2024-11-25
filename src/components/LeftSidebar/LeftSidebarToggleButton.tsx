// src/components/LeftSidebar/LeftSidebarToggleButton.tsx

import React from 'react';
import MenuIcon from '@mui/icons-material/Menu';

interface SidebarToggleButtonProps {
  toggleSidebar: () => void;
}

const LeftSidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({
  toggleSidebar,
}) => {
  return (
    <button
      className="left-sidebar-toggle-button"
      onClick={toggleSidebar}
      aria-label="Toggle Sidebar"
    >
      <MenuIcon className="left-sidebar-toggle-button__icon" />
    </button>
  );
};

export default LeftSidebarToggleButton;
