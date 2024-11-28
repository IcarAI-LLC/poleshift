import React, { useEffect, useRef, useCallback } from 'react';
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

import { useUI } from '../lib/hooks';
import { useLocations } from '../lib/hooks';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import {SampleLocation} from "../lib/types";

interface FilterMenuProps {
    onApply: () => void;
    onReset: () => void;
    onClose: () => void;
}

const FilterMenu: React.FC<FilterMenuProps> = ({
                                                   onApply,
                                                   onReset,
                                                   onClose,
                                               }) => {
    const theme = useTheme();
    const firstInputRef = useRef<HTMLInputElement>(null);
    const { filters, setFilters } = useUI();
    const { allLocations: locations } = useLocations();
    console.log("Locations: ", locations);
    // Memoize style objects
    const styles = {
        container: {
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(3),
            borderRadius: '8px',
            width: '300px',
            color: theme.palette.text.primary,
            position: 'fixed',
            top: '20%',
            right: '20px',
            zIndex: theme.zIndex.modal,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        } as SxProps<Theme>,

        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing(3),
        } as SxProps<Theme>,

        closeButton: {
            color: theme.palette.text.primary,
            '&:hover': {
                backgroundColor: theme.palette.action.hover,
            },
        } as SxProps<Theme>,

        inputField: {
            '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(18, 18, 18, 0.7)',
                '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                    borderColor: theme.palette.primary.main,
                },
                '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                },
            },
            '& .MuiInputLabel-root': {
                color: theme.palette.text.primary,
            },
            '& .MuiInputBase-input': {
                color: theme.palette.text.primary,
            },
            '& .MuiSvgIcon-root': {
                color: theme.palette.text.primary,
            },
        } as SxProps<Theme>,

        buttonContainer: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing(1),
            marginTop: theme.spacing(3),
        } as SxProps<Theme>,
    };

    // Updated handlers to directly set the state object
    const handleStartDateChange = useCallback((date: DateTime | null) => {
        const newStartDate = date ? date.toISODate() : null;
        setFilters({
            ...filters,
            startDate: newStartDate,
        });
    }, [filters, setFilters]);

    const handleEndDateChange = useCallback((date: DateTime | null) => {
        const newEndDate = date ? date.toISODate() : null;
        setFilters({
            ...filters,
            endDate: newEndDate,
        });
    }, [filters, setFilters]);

    const handleLocationChange = useCallback((event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setFilters({
            ...filters,
            selectedLocations: typeof value === 'string' ? value.split(',') : value,
        });
    }, [filters, setFilters]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
            <Box
                className="filter-menu visible"
                onClick={(e) => e.stopPropagation()}
                sx={styles.container}
            >
                <Box sx={styles.header}>
                    <Typography variant="h6" color="textPrimary">
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

                <Box sx={{ marginBottom: theme.spacing(2) }}>
                    <DatePicker
                        label="Start Date"
                        value={filters.startDate ? DateTime.fromISO(filters.startDate) : null}
                        onChange={handleStartDateChange}
                        slotProps={{
                            textField: {
                                variant: 'outlined',
                                size: 'small',
                                inputRef: firstInputRef,
                                fullWidth: true,
                                sx: styles.inputField,
                            },
                        }}
                    />
                </Box>

                <Box sx={{ marginBottom: theme.spacing(2) }}>
                    <DatePicker
                        label="End Date"
                        value={filters.endDate ? DateTime.fromISO(filters.endDate) : null}
                        onChange={handleEndDateChange}
                        slotProps={{
                            textField: {
                                variant: 'outlined',
                                size: 'small',
                                fullWidth: true,
                                sx: styles.inputField,
                            },
                        }}
                    />
                </Box>

                <FormControl
                    variant="outlined"
                    fullWidth
                    sx={{ marginBottom: theme.spacing(2) }}
                >
                    <InputLabel id="location-select-label">Locations</InputLabel>
                    <Select
                        labelId="location-select-label"
                        multiple
                        value={filters.selectedLocations}
                        onChange={handleLocationChange}
                        label="Locations"
                        renderValue={(selected) =>
                            (selected as string[])
                                .map((locId) => locations.find((loc: SampleLocation) => loc.id === locId)?.label || locId)
                                .join(', ')
                        }
                        sx={styles.inputField}
                    >
                        {locations.map((location: SampleLocation) => (
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
                            color: theme.palette.text.primary,
                            borderColor: theme.palette.divider,
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                                borderColor: theme.palette.text.primary,
                            },
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onApply}
                        sx={{
                            backgroundColor: theme.palette.primary.main,
                            '&:hover': {
                                backgroundColor: theme.palette.primary.dark,
                            },
                        }}
                    >
                        Apply
                    </Button>
                </Box>
            </Box>
        </LocalizationProvider>
    );
};

export default FilterMenu;