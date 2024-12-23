// src/components/TopControls/SettingsButton.tsx
import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

interface SettingsButtonProps {
    onClick: () => void;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick }) => {
    return (
        <Tooltip title="Settings" arrow>
            <IconButton
                onClick={onClick}
                aria-label="Settings"
                sx={{
                    color: 'var(--color-white)',
                    padding: '8px',
                    '&:hover': {
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                    },
                }}
            >
                <SettingsIcon />
            </IconButton>
        </Tooltip>
    );
};

export default SettingsButton;
