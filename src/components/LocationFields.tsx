import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TextField, Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useData } from '../lib/hooks';
import type { SampleGroupMetadata } from '../lib/types';

interface Coordinate {
    value: string;
    error: string;
}

interface LocationFieldsProps {
    sampleGroup: SampleGroupMetadata;
    metadataItemStyles: SxProps<Theme>;
    labelStyles: SxProps<Theme>;
    darkFieldStyles: SxProps<Theme>;
    /** New disabled prop */
    disabled?: boolean;
}

const COORDINATE_LIMITS = {
    latitude: { min: -90, max: 90 },
    longitude: { min: -180, max: 180 },
} as const;

export const LocationFields: React.FC<LocationFieldsProps> = ({
                                                                  sampleGroup,
                                                                  metadataItemStyles,
                                                                  labelStyles,
                                                                  darkFieldStyles,
                                                                  disabled = false, // default to false if not provided
                                                              }) => {
    const { updateSampleGroup } = useData();

    // Local state with proper typing
    const [coordinates, setCoordinates] = useState<
        Record<'latitude' | 'longitude', Coordinate>
    >({
        latitude: { value: '', error: '' },
        longitude: { value: '', error: '' },
    });

    // Update local state when sample group changes
    useEffect(() => {
        setCoordinates({
            latitude: {
                value: sampleGroup.latitude_recorded?.toString() || '',
                error: '',
            },
            longitude: {
                value: sampleGroup.longitude_recorded?.toString() || '',
                error: '',
            },
        });
    }, [sampleGroup.latitude_recorded, sampleGroup.longitude_recorded]);

    // Memoized field configurations
    const fieldConfigs = useMemo(
        () => ({
            latitude: {
                label: 'Latitude:',
                placeholder: 'Enter latitude (-90 to 90)',
                min: COORDINATE_LIMITS.latitude.min,
                max: COORDINATE_LIMITS.latitude.max,
                errorMessage: 'Invalid latitude. Must be between -90 and 90 degrees',
            },
            longitude: {
                label: 'Longitude:',
                placeholder: 'Enter longitude (-180 to 180)',
                min: COORDINATE_LIMITS.longitude.min,
                max: COORDINATE_LIMITS.longitude.max,
                errorMessage: 'Invalid longitude. Must be between -180 and 180 degrees',
            },
        }),
        []
    );

    // Validation function
    const validateCoordinate = useCallback((value: string, type: 'latitude' | 'longitude'): boolean => {
        if (!value) return true; // empty string is acceptable (clears the value)
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        const limits = COORDINATE_LIMITS[type];
        return num >= limits.min && num <= limits.max;
    }, []);

    // Handle coordinate changes
    const handleCoordinateChange = useCallback(
        (value: string, type: 'latitude' | 'longitude') => {
            // If disabled, do not allow local state updates
            if (disabled) return;

            setCoordinates((prev) => ({
                ...prev,
                [type]: {
                    value,
                    error: !validateCoordinate(value, type) ? fieldConfigs[type].errorMessage : '',
                },
            }));
        },
        [validateCoordinate, fieldConfigs, disabled]
    );

    // Handle coordinate updates
    const handleCoordinateUpdate = useCallback(
        async (type: 'latitude' | 'longitude') => {
            if (disabled || !sampleGroup.id) return;

            const value = coordinates[type].value;
            if (!validateCoordinate(value, type)) {
                // Revert to previous value if invalid
                handleCoordinateChange(sampleGroup[`${type}_recorded`]?.toString() || '', type);
                return;
            }

            try {
                const numericValue = value ? parseFloat(value) : null;
                await updateSampleGroup(sampleGroup.id, {
                    [`${type}_recorded`]: numericValue,
                });
            } catch (error) {
                console.error(`Error updating ${type}:`, error);
                // Reset to previous value on error
                handleCoordinateChange(sampleGroup[`${type}_recorded`]?.toString() || '', type);
            }
        },
        [sampleGroup, coordinates, validateCoordinate, handleCoordinateChange, updateSampleGroup, disabled]
    );

    // Render coordinate field
    const renderCoordinateField = useCallback(
        (type: 'latitude' | 'longitude') => {
            const config = fieldConfigs[type];
            const coordinate = coordinates[type];

            return (
                <Box sx={metadataItemStyles} key={type}>
                    <Typography sx={labelStyles}>{config.label}</Typography>
                    <TextField
                        value={coordinate.value}
                        onChange={(e) => handleCoordinateChange(e.target.value, type)}
                        onBlur={() => handleCoordinateUpdate(type)}
                        placeholder={config.placeholder}
                        type="number"
                        fullWidth
                        variant="outlined"
                        size="small"
                        error={!!coordinate.error}
                        helperText={coordinate.error}
                        sx={{
                            ...darkFieldStyles,
                            flex: 1,
                        }}
                        slotProps={{
                            htmlInput: {
                                step: 'any',
                                min: config.min,
                                max: config.max,
                            },
                        }}
                        /** Apply the disabled prop here */
                        disabled={disabled}
                    />
                </Box>
            );
        },
        [
            coordinates,
            fieldConfigs,
            metadataItemStyles,
            labelStyles,
            darkFieldStyles,
            handleCoordinateChange,
            handleCoordinateUpdate,
            disabled
        ]
    );

    return (
        <>
            {renderCoordinateField('latitude')}
            {renderCoordinateField('longitude')}
        </>
    );
};

export default LocationFields;
