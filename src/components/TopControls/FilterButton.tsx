// src/components/TopControls/FilterButton.tsx
import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

interface FilterButtonProps {
    onClick: () => void;
    buttonRef: React.RefObject<HTMLButtonElement>;
}

const FilterButton: React.FC<FilterButtonProps> = ({ onClick, buttonRef }) => {
    return (
        <Tooltip title="Open Filters" arrow>
            <IconButton
                onClick={onClick}
                ref={buttonRef}
                aria-label="Open Filters"
                sx={{
                    color: 'var(--color-white)',
                    padding: '8px',
                    '&:hover': {
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                    },
                }}
            >
                <FilterListIcon />
            </IconButton>
        </Tooltip>
    );
};

export default FilterButton;