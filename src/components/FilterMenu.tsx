import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Typography,
    IconButton,
    useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import type { SxProps, Theme } from '@mui/material/styles';

import { useUI, useData } from '../lib/hooks';
import type { SampleLocation } from '../lib/types';

interface FilterMenuProps {
    onApply: () => void;
    onReset: () => void;
    onClose: () => void;
}

interface StyleProps {
    container: SxProps<Theme>;
    header: SxProps<Theme>;
    closeButton: SxProps<Theme>;
    inputField: SxProps<Theme>;
    buttonContainer: SxProps<Theme>;
    fieldContainer: SxProps<Theme>;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({
                                                          onApply,
                                                          onReset,
                                                          onClose,
                                                      }) => {
    const theme = useTheme();
    const firstInputRef = useRef<HTMLInputElement>(null);
    const { filters, setFilters } = useUI();
    const { enabledLocations } = useData();

    // Memoized styles
    const styles = useMemo<StyleProps>(() => ({
        container: {
            backgroundColor: 'background.paper',
            p: 3,
            borderRadius: 2,
            width: '300px',
            color: 'text.primary',
            position: 'fixed',
            top: '20%',
            right: '20px',
            zIndex: theme.zIndex.modal,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
        },
        closeButton: {
            color: 'text.primary',
            '&:hover': {
                backgroundColor: 'action.hover',
            },
        },
        inputField: {
            '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(18, 18, 18, 0.7)',
                '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                    borderColor: 'primary.main',
                },
                '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                },
            },
            '& .MuiInputLabel-root': {
                color: 'text.primary',
            },
            '& .MuiInputBase-input': {
                color: 'text.primary',
            },
            '& .MuiSvgIcon-root': {
                color: 'text.primary',
            },
        },
        fieldContainer: {
            mb: 2,
        },
        buttonContainer: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            mt: 3,
        },
    }), [theme.zIndex.modal]);

    // Handler for date changes
    const handleDateChange = useCallback((
        type: 'startDate' | 'endDate',
        date: DateTime | null
    ) => {
        setFilters(prev => ({
            ...prev,
            [type]: date?.toISODate() || null,
        }));
    }, [setFilters]);

    // Handler for location changes
    const handleLocationChange = useCallback((event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setFilters(prev => ({
            ...prev,
            selectedLocations: Array.isArray(value) ? value : value.split(','),
        }));
    }, [setFilters]);

    // Location label renderer
    const renderLocationValue = useCallback((selected: string[]) => {
        return selected
            .map(locId => enabledLocations.find(loc => loc.id === locId)?.label || locId)
            .join(', ');
    }, [enabledLocations]);

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Initial focus
    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={styles.container}
            >
                <Box sx={styles.header}>
                    <Typography variant="h6">
                        Filters
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        aria-label="close"
                        size="small"
                        sx={styles.closeButton}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box sx={styles.fieldContainer}>
                    <DatePicker
                        label="Start Date"
                        value={filters.startDate ? DateTime.fromISO(filters.startDate) : null}
                        onChange={(date) => handleDateChange('startDate', date)}
                        slotProps={{
                            textField: {
                                inputRef: firstInputRef,
                                size: 'small',
                                fullWidth: true,
                                sx: styles.inputField,
                            },
                        }}
                    />
                </Box>

                <Box sx={styles.fieldContainer}>
                    <DatePicker
                        label="End Date"
                        value={filters.endDate ? DateTime.fromISO(filters.endDate) : null}
                        onChange={(date) => handleDateChange('endDate', date)}
                        slotProps={{
                            textField: {
                                size: 'small',
                                fullWidth: true,
                                sx: styles.inputField,
                            },
                        }}
                    />
                </Box>

                <FormControl
                    fullWidth
                    variant="outlined"
                    sx={styles.fieldContainer}
                >
                    <InputLabel id="location-select-label">Locations</InputLabel>
                    <Select
                        labelId="location-select-label"
                        multiple
                        value={filters.selectedLocations}
                        onChange={handleLocationChange}
                        label="Locations"
                        renderValue={renderLocationValue}
                        sx={styles.inputField}
                    >
                        {enabledLocations.map((location: SampleLocation) => (
                            <MenuItem key={location.id} value={location.id}>
                                {location.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={styles.buttonContainer}>
                    <Button
                        variant="outlined"
                        onClick={onReset}
                        sx={{
                            color: 'text.primary',
                            borderColor: 'divider',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                                borderColor: 'text.primary',
                            },
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onApply}
                    >
                        Apply
                    </Button>
                </Box>
            </Box>
        </LocalizationProvider>
    );
};

export default React.memo(FilterMenu);