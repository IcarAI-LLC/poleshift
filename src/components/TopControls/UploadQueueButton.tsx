// src/components/TopControls/UploadQueueButton.tsx
import React from 'react';
import { IconButton, Tooltip, Badge } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadQueueButtonProps {
    queueCount: number;
    onClick: () => void;
}

const UploadQueueButton: React.FC<UploadQueueButtonProps> = ({ queueCount, onClick }) => {
    return (
        <Tooltip title="Upload Queue">
            <IconButton
                onClick={onClick}
                aria-label="Upload Queue"
                sx={{
                    color: 'var(--color-white)',
                    padding: '8px',
                    '&:hover': {
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                    },
                }}
            >
                <Badge
                    badgeContent={queueCount}
                    color="secondary"
                    sx={{
                        '& .MuiBadge-badge': {
                            right: -3,
                            top: 3,
                        },
                    }}
                >
                    <CloudUploadIcon />
                </Badge>
            </IconButton>
        </Tooltip>
    );
};

export default UploadQueueButton;