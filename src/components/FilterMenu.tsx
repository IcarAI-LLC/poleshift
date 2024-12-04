import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    Autocomplete,
    TextField,
    Chip,
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

interface FilterState {
    startDate: string | null;
    endDate: string | null;
    selectedLocations: string[];
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

    // Local state for filter values
    const [localFilters, setLocalFilters] = useState<FilterState>({
        startDate: filters.startDate,
        endDate: filters.endDate,
        selectedLocations: filters.selectedLocations,
    });

    const styles = useMemo<StyleProps>(() => ({
        container: {
            backgroundColor: 'background.paper',
            p: 3,
            borderRadius: 2,
            width: '350px',
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
            '& .MuiAutocomplete-paper': {
                backgroundColor: 'background.paper',
                color: 'text.primary',
            },
            '& .MuiAutocomplete-listbox': {
                backgroundColor: 'background.paper',
                '& .MuiAutocomplete-option': {
                    color: 'text.primary',
                },
                '& .MuiAutocomplete-option[aria-selected="true"]': {
                    backgroundColor: 'primary.dark',
                },
                '& .MuiAutocomplete-option:hover': {
                    backgroundColor: 'action.hover',
                },
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
        setLocalFilters(prev => ({
            ...prev,
            [type]: date?.toISODate() || null,
        }));
    }, []);

    // Location selection handler
    const handleLocationChange = useCallback((_: any, newValue: SampleLocation[]) => {
        setLocalFilters(prev => ({
            ...prev,
            selectedLocations: newValue.map(loc => loc.id)
        }));
    }, []);

    // Handle apply filters
    const handleApply = useCallback(() => {
        setFilters(localFilters);
        onApply();
    }, [localFilters, setFilters, onApply]);

    // Handle reset filters
    const handleReset = useCallback(() => {
        const resetFilters = {
            startDate: null,
            endDate: null,
            selectedLocations: [],
        };
        setLocalFilters(resetFilters);
        setFilters(resetFilters);
        onReset();
    }, [setFilters, onReset]);

    // Prepare selected locations for Autocomplete
    const selectedLocations = useMemo(() =>
            enabledLocations.filter(loc => localFilters.selectedLocations.includes(loc.id)),
        [enabledLocations, localFilters.selectedLocations]
    );

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
                        value={localFilters.startDate ? DateTime.fromISO(localFilters.startDate) : null}
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
                        value={localFilters.endDate ? DateTime.fromISO(localFilters.endDate) : null}
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
                    <Autocomplete
                        multiple
                        options={enabledLocations.sort((a, b) => a.label.localeCompare(b.label))}
                        getOptionLabel={(option) => option.label}
                        value={selectedLocations}
                        onChange={handleLocationChange}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Locations"
                                placeholder="Search locations..."
                                sx={styles.inputField}
                            />
                        )}
                        renderTags={(tagValue, getTagProps) =>
                            tagValue.map((option, index) => (
                                <Chip
                                    key={option.id}
                                    label={option.label}
                                    {...getTagProps({ index })}
                                    sx={{
                                        backgroundColor: 'primary.main',
                                        color: 'white',
                                    }}
                                />
                            ))
                        }
                        renderOption={(props, option) => (
                            <li {...props} key={option.id}>
                                {option.label}
                            </li>
                        )}
                        ListboxProps={{
                            style: {
                                maxHeight: '200px',
                            },
                        }}
                    />
                </FormControl>

                <Box sx={styles.buttonContainer}>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
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
                        onClick={handleApply}
                    >
                        Apply
                    </Button>
                </Box>
            </Box>
        </LocalizationProvider>
    );
};

export default React.memo(FilterMenu);