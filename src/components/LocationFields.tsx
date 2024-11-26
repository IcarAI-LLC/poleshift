import React, { useState, useEffect, useCallback } from 'react';
import { TextField, Box, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

import { useData } from '../lib/hooks';
import type { SampleGroup } from '../lib/types';

interface LocationFieldsProps {
  sampleGroup: SampleGroup;
  theme: Theme;
  metadataItemStyles: SxProps<Theme>;
  labelStyles: SxProps<Theme>;
  darkFieldStyles: SxProps<Theme>;
}

const LocationFields: React.FC<LocationFieldsProps> = ({
                                                         sampleGroup,
                                                         metadataItemStyles,
                                                         labelStyles,
                                                         darkFieldStyles,
                                                       }) => {
  const { updateSampleGroup } = useData();

  const [latitude, setLatitude] = useState<string>(
      sampleGroup.latitude_recorded?.toString() || ''
  );
  const [longitude, setLongitude] = useState<string>(
      sampleGroup.longitude_recorded?.toString() || ''
  );

  useEffect(() => {
    setLatitude(sampleGroup.latitude_recorded?.toString() || '');
    setLongitude(sampleGroup.longitude_recorded?.toString() || '');
  }, [sampleGroup.latitude_recorded, sampleGroup.longitude_recorded]);

  const validateCoordinate = useCallback((
      value: string,
      type: 'latitude' | 'longitude',
  ): boolean => {
    if (!value) return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return type === 'latitude'
        ? num >= -90 && num <= 90
        : num >= -180 && num <= 180;
  }, []);

  const getErrorMessage = useCallback((
      value: string,
      type: 'latitude' | 'longitude'
  ): string => {
    if (!validateCoordinate(value, type)) {
      return type === 'latitude'
          ? 'Invalid latitude. Must be between -90 and 90 degrees'
          : 'Invalid longitude. Must be between -180 and 180 degrees';
    }
    return '';
  }, [validateCoordinate]);

  const handleCoordinateUpdate = useCallback(async (
      value: string,
      type: 'latitude' | 'longitude'
  ) => {
    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      const numericValue = value ? parseFloat(value) : null;
      const updateField = type === 'latitude' ? 'latitude_recorded' : 'longitude_recorded';

      await updateSampleGroup(sampleGroup.id, {
        [updateField]: numericValue
      });
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      // Reset the field to its previous value on error
      if (type === 'latitude') {
        setLatitude(sampleGroup.latitude_recorded?.toString() || '');
      } else {
        setLongitude(sampleGroup.longitude_recorded?.toString() || '');
      }
    }
  }, [sampleGroup.id, updateSampleGroup]);

  return (
      <>
        <Box sx={metadataItemStyles}>
          <Typography sx={labelStyles}>Latitude:</Typography>
          <TextField
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              onBlur={() => {
                if (validateCoordinate(latitude, 'latitude')) {
                  handleCoordinateUpdate(latitude, 'latitude');
                } else {
                  setLatitude(sampleGroup.latitude_recorded?.toString() || '');
                }
              }}
              placeholder="Enter latitude (-90 to 90)"
              type="number"
              inputProps={{
                step: 'any',
                min: -90,
                max: 90,
              }}
              fullWidth
              variant="outlined"
              size="small"
              error={!validateCoordinate(latitude, 'latitude')}
              helperText={getErrorMessage(latitude, 'latitude')}
              sx={{
                ...darkFieldStyles,
                flex: 1,
              }}
          />
        </Box>

        <Box sx={metadataItemStyles}>
          <Typography sx={labelStyles}>Longitude:</Typography>
          <TextField
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              onBlur={() => {
                if (validateCoordinate(longitude, 'longitude')) {
                  handleCoordinateUpdate(longitude, 'longitude');
                } else {
                  setLongitude(sampleGroup.longitude_recorded?.toString() || '');
                }
              }}
              placeholder="Enter longitude (-180 to 180)"
              type="number"
              inputProps={{
                step: 'any',
                min: -180,
                max: 180,
              }}
              fullWidth
              variant="outlined"
              size="small"
              error={!validateCoordinate(longitude, 'longitude')}
              helperText={getErrorMessage(longitude, 'longitude')}
              sx={{
                ...darkFieldStyles,
                flex: 1,
              }}
          />
        </Box>
      </>
  );
};

export default LocationFields;