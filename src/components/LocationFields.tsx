import React, { useState, useEffect } from 'react';
import { TextField, Box, Typography, Theme } from '@mui/material';
import type { Dispatch, SetStateAction } from 'react';
import { SampleGroup } from '../old_utils/sampleGroupUtils';
import supabase from '../old_utils/supabaseClient';
import {
  addPendingOperation,
  addOrUpdateSampleGroup, PendingOperation,
} from '../old_utils/offlineStorage';

interface LocationFieldsProps {
  sampleGroup: SampleGroup;
  theme: Theme;
  metadataItemStyles: any;
  labelStyles: any;
  valueStyles: any;
  darkFieldStyles: any;
  setSampleGroupData: Dispatch<SetStateAction<Record<string, SampleGroup>>>;
}

const LocationFields: React.FC<LocationFieldsProps> = ({
  sampleGroup,
  metadataItemStyles,
  labelStyles,
  darkFieldStyles,
  setSampleGroupData,
}) => {
  const [latitude, setLatitude] = useState<string>(
    sampleGroup.latitude_recorded?.toString() || '',
  );
  const [longitude, setLongitude] = useState<string>(
    sampleGroup.longitude_recorded?.toString() || '',
  );

  useEffect(() => {
    setLatitude(sampleGroup.latitude_recorded?.toString() || '');
    setLongitude(sampleGroup.longitude_recorded?.toString() || '');
  }, [sampleGroup.latitude_recorded, sampleGroup.longitude_recorded]);

  const validateCoordinate = (
    value: string,
    type: 'latitude' | 'longitude',
  ): boolean => {
    if (!value) return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return type === 'latitude'
      ? num >= -90 && num <= 90
      : num >= -180 && num <= 180;
  };

  const handleLatitudeUpdate = async (newLatitude: string) => {
    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      const numericValue = newLatitude ? parseFloat(newLatitude) : null;

      // Update local state immediately
      setSampleGroupData((prev) => ({
        ...prev,
        [sampleGroup.id]: {
          ...prev[sampleGroup.id],
          latitude_recorded: numericValue,
        },
      }));

      // Save to IndexedDB
      await addOrUpdateSampleGroup({
        ...sampleGroup,
        latitude_recorded: numericValue,
      });

      if (navigator.onLine) {
        // Online: Update Supabase directly
        const { error } = await supabase
          .from('sample_group_metadata')
          .update({ latitude_recorded: numericValue })
          .eq('id', sampleGroup.id);

        if (error) throw error;
      } else {
        // Offline: Queue the operation
        const pendingOperation: PendingOperation = {
          id: sampleGroup.id,
          type: "update",
          table: 'sample_group_metadata',
          data: {
            id: sampleGroup.id,
            updateData: { latitude_recorded: numericValue },
          }
        };
        await addPendingOperation(pendingOperation);
      }
    } catch (error) {
      console.error('Error updating latitude:', error);
    }
  };

  const handleLongitudeUpdate = async (newLongitude: string) => {
    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      const numericValue = newLongitude ? parseFloat(newLongitude) : null;

      // Update local state immediately
      setSampleGroupData((prev) => ({
        ...prev,
        [sampleGroup.id]: {
          ...prev[sampleGroup.id],
          longitude_recorded: numericValue,
        },
      }));

      // Save to IndexedDB
      await addOrUpdateSampleGroup({
        ...sampleGroup,
        longitude_recorded: numericValue,
      });

      if (navigator.onLine) {
        // Online: Update Supabase directly
        const { error } = await supabase
          .from('sample_group_metadata')
          .update({ longitude_recorded: numericValue })
          .eq('id', sampleGroup.id);

        if (error) throw error;
      } else {
        // Offline: Queue the operation
        const pendingOperation: PendingOperation = {
          id: sampleGroup.id,
          type: "update",
          table: 'sample_group_metadata',
          data: {
            id: sampleGroup.id,
            updateData: { longitude_recorded: numericValue },
          },
        };
        await addPendingOperation(pendingOperation);
      }
    } catch (error) {
      console.error('Error updating longitude:', error);
    }
  };

  return (
    <>
      <Box sx={metadataItemStyles}>
        <Typography sx={labelStyles}>Latitude:</Typography>
        <TextField
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          onBlur={() => {
            if (validateCoordinate(latitude, 'latitude')) {
              handleLatitudeUpdate(latitude);
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
          helperText={
            !validateCoordinate(latitude, 'latitude') ? 'Invalid latitude' : ''
          }
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
              handleLongitudeUpdate(longitude);
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
          helperText={
            !validateCoordinate(longitude, 'longitude')
              ? 'Invalid longitude'
              : ''
          }
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
