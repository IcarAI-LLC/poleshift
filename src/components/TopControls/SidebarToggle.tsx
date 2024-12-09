// src/components/TopControls/SidebarToggle.tsx
import React from 'react';
import { IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import type { SxProps, Theme } from '@mui/material/styles';

interface SidebarToggleProps {
    onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const SidebarToggle: React.FC<SidebarToggleProps> = ({ onToggle }) => {
    const styles: SxProps<Theme> = {
        color: 'var(--color-text)',
        padding: '8px',
        '&:hover': {
            color: 'var(--color-primary)',
            backgroundColor: 'transparent',
        },
    };

    return (
        <IconButton
            onClick={onToggle}
            aria-label="Toggle Sidebar"
            sx={styles}
        >
            <MenuIcon />
        </IconButton>
    );
};

export default SidebarToggle;