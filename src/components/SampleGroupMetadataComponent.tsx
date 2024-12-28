import React, { useState, useEffect, useCallback } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { TimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { format, parse } from 'date-fns';
import {
  Box,
  Typography,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Card,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type { SxProps, Theme } from '@mui/material/styles';

import { useData, useUI } from '../lib/hooks';
import { useAuthStore } from '../lib/stores/authStore.ts';
import LocationFields from './LocationFields';

import type { SampleGroupMetadata as TSampleGroupMetadata } from '../lib/types';
import { ProximityCategory, PoleshiftPermissions } from '../lib/types';

// Styles interface for better type safety
interface StyleProps {
  metadataItemStyles: SxProps<Theme>;
  labelStyles: SxProps<Theme>;
  valueStyles: SxProps<Theme>;
  darkFieldStyles: SxProps<Theme>;
  accordionStyles: SxProps<Theme>;
  containerStyles: SxProps<Theme>;
  summaryStyles: SxProps<Theme>;
}

export const SampleGroupMetadataComponent: React.FC = () => {
  const theme = useTheme();
  const { locations, updateSampleGroup, sampleGroups } = useData();
  const { selectedLeftItem } = useUI();
  const { userPermissions } = useAuthStore.getState();

  // Check if the user has ModifySampleGroup permission
  const hasModifyPermission = userPermissions?.includes(PoleshiftPermissions.ModifySampleGroup);

  // Local state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [localState, setLocalState] = useState<{
    collectionTimeUTC: string;
    notes: string;
    proximityCategory: ProximityCategory | null;
    excluded: number; // 0 or 1
    penguinCount: number | null; // ALLOW NULL
    penguinPresent: number; // 0 or 1
  }>({
    collectionTimeUTC: '',
    notes: '',
    proximityCategory: null,
    excluded: 0,
    penguinCount: null, // DEFAULT TO NULL
    penguinPresent: 0,
  });

  // Get current sample group
  const sampleGroup = selectedLeftItem ? sampleGroups[selectedLeftItem.id] : null;
  const location = sampleGroup?.loc_id
      ? locations.find((loc) => loc.id === sampleGroup.loc_id)
      : null;

  // Styles with enhanced overflow handling
  const styles: StyleProps = {
    containerStyles: {
      backgroundColor: 'background.paper',
      borderRadius: 2,
      boxShadow: 'var(--shadow-sm)',
      m: 2,
      maxHeight: 'calc(100vh - 180px)', // Increased space for container
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative', // Added for proper positioning
      marginTop: 'var(--header-height)',
    },
    accordionStyles: {
      '&:before': {
        display: 'none',
      },
      boxShadow: 'none',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden', // Prevent accordion overflow
    },
    summaryStyles: {
      borderBottom: `1px solid ${theme.palette.divider}`,
      '&.Mui-expanded': {
        minHeight: '48px',
      },
      flexShrink: 0, // Prevent summary from shrinking
    },
    metadataItemStyles: {
      display: 'flex',
      alignItems: 'flex-start',
      p: 1.5,
      borderBottom: `1px solid ${theme.palette.divider}`,
      '&:last-child': {
        borderBottom: 'none',
      },
    },
    labelStyles: {
      width: '180px',
      flexShrink: 0,
      color: 'text.secondary',
      fontSize: 'var(--font-size-medium)',
    },
    valueStyles: {
      flex: 1,
      color: 'text.primary',
      fontSize: 'var(--font-size-medium)',
    },
    darkFieldStyles: {
      '& .MuiOutlinedInput-root': {
        backgroundColor: 'rgba(18, 18, 18, 0.7)',
        '& fieldset': {
          borderColor: 'divider',
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
        fontSize: 'var(--font-size-medium)',
      },
      '& .MuiSvgIcon-root': {
        color: 'text.primary',
      },
    },
  };

  // Update local state when sample group changes
  useEffect(() => {
    if (sampleGroup) {
      setLocalState({
        collectionTimeUTC: sampleGroup.collection_datetime_utc
            ? new Date(sampleGroup.collection_datetime_utc)
                .toISOString()
                .split('T')[1]
                .substring(0, 8)
            : '',
        notes: sampleGroup.notes || '',
        proximityCategory: (sampleGroup.proximity_category as ProximityCategory) || null,
        excluded: sampleGroup.excluded,
        // If penguin_count is undefined or null, store null in local state
        penguinCount: sampleGroup.penguin_count ?? null,
        penguinPresent: sampleGroup.penguin_present ?? 0,
      });
    }
  }, [sampleGroup]);

  // Handlers
  const handleCollectionTimeUpdate = useCallback(
      async (timeString: string) => {
        if (!sampleGroup?.id) return;

        try {
          let collection_datetime_utc: string | undefined;

          if (timeString) {
            const utcDateTimeString = `${sampleGroup.collection_date}T${timeString}Z`;
            const utcDateTime = new Date(utcDateTimeString);
            collection_datetime_utc = utcDateTime.toISOString();
          }

          setLocalState((prev) => ({
            ...prev,
            collectionTimeUTC: timeString,
          }));

          await updateSampleGroup(sampleGroup.id, { collection_datetime_utc });
        } catch (error) {
          console.error('Error updating collection time:', error);
          // Reset to previous value on error
          setLocalState((prev) => ({
            ...prev,
            collectionTimeUTC: sampleGroup.collection_datetime_utc
                ? new Date(sampleGroup.collection_datetime_utc)
                    .toISOString()
                    .split('T')[1]
                    .substring(0, 8)
                : '',
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  const handleNotesUpdate = useCallback(
      async (newNotes: string) => {
        if (!sampleGroup?.id) return;

        try {
          setLocalState((prev) => ({
            ...prev,
            notes: newNotes,
          }));

          await updateSampleGroup(sampleGroup.id, { notes: newNotes });
        } catch (error) {
          console.error('Error updating notes:', error);
          setLocalState((prev) => ({
            ...prev,
            notes: sampleGroup.notes || '',
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  // Handle Excluded (0 or 1)
  const handleExcludedUpdate = useCallback(
      async (isExcluded: boolean) => {
        if (!sampleGroup?.id) return;

        const newValue = isExcluded ? 1 : 0;
        try {
          setLocalState((prev) => ({
            ...prev,
            excluded: newValue,
          }));

          await updateSampleGroup(sampleGroup.id, { excluded: newValue });
        } catch (error) {
          console.error('Error updating excluded:', error);
          setLocalState((prev) => ({
            ...prev,
            excluded: sampleGroup.excluded,
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  // Handle Proximity Category
  const handleProximityUpdate = useCallback(
      async (newProximity: ProximityCategory | null) => {
        if (!sampleGroup?.id) return;

        try {
          setLocalState((prev) => ({
            ...prev,
            proximityCategory: newProximity,
          }));

          await updateSampleGroup(sampleGroup.id, {
            proximity_category: newProximity,
          });
        } catch (error) {
          console.error('Error updating proximity category:', error);
          setLocalState((prev) => ({
            ...prev,
            proximityCategory: (sampleGroup.proximity_category as ProximityCategory) || null,
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  // Allow null in addition to number
  const handlePenguinCountUpdate = useCallback(
      async (count: number | null) => {
        if (!sampleGroup?.id) return;

        try {
          setLocalState((prev) => ({
            ...prev,
            penguinCount: count,
          }));

          await updateSampleGroup(sampleGroup.id, { penguin_count: count });
        } catch (error) {
          console.error('Error updating penguin count:', error);
          // Reset on error
          setLocalState((prev) => ({
            ...prev,
            penguinCount: sampleGroup.penguin_count ?? null,
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  // Handle Penguin Present (0 or 1)
  const handlePenguinPresentUpdate = useCallback(
      async (isPresent: boolean) => {
        if (!sampleGroup?.id) return;

        const newValue = isPresent ? 1 : 0;
        try {
          setLocalState((prev) => ({
            ...prev,
            penguinPresent: newValue,
          }));

          await updateSampleGroup(sampleGroup.id, { penguin_present: newValue });
        } catch (error) {
          console.error('Error updating penguin present:', error);
          // Reset on error
          setLocalState((prev) => ({
            ...prev,
            penguinPresent: sampleGroup.penguin_present ?? 0,
          }));
        }
      },
      [sampleGroup, updateSampleGroup]
  );

  if (!sampleGroup) return null;

  return (
      <Card sx={styles.containerStyles}>
        <Accordion
            expanded={isExpanded}
            onChange={() => setIsExpanded(!isExpanded)}
            sx={styles.accordionStyles}
            disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={styles.summaryStyles}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {sampleGroup.human_readable_sample_id || 'Unnamed Sample'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sampleGroup.collection_date || 'Unknown Date'} •{' '}
                {location?.label || 'Unknown Location'}
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails
              sx={{
                p: 0,
                overflowY: 'auto',
                overflowX: 'hidden', // Prevent horizontal scroll
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                maxHeight: 'calc(100vh - 240px)', // Adjusted for header and margins
              }}
          >
            <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 'min-content',
                  pb: 2, // Add bottom padding for last item
                }}
            >
              {/* Basic Info Fields */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Sample ID:</Typography>
                <Typography sx={styles.valueStyles}>
                  {sampleGroup.human_readable_sample_id || 'N/A'}
                </Typography>
              </Box>

              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Date:</Typography>
                <Typography sx={styles.valueStyles}>
                  {sampleGroup.collection_date || 'N/A'}
                </Typography>
              </Box>

              {/* Time Picker */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Time (UTC):</Typography>
                <Box sx={styles.valueStyles}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <TimePicker
                        value={
                          localState.collectionTimeUTC
                              ? parse(localState.collectionTimeUTC, 'HH:mm:ss', new Date())
                              : null
                        }
                        onChange={(newValue) => {
                          if (newValue && !isNaN(newValue.getTime()) && hasModifyPermission) {
                            const timeString = format(newValue, 'HH:mm:ss');
                            handleCollectionTimeUpdate(timeString);
                          }
                        }}
                        ampm={false}
                        views={['hours', 'minutes', 'seconds']}
                        slots={{ openPickerIcon: AccessTimeIcon }}
                        slotProps={{
                          textField: {
                            variant: 'outlined',
                            placeholder: 'HH:MM:SS',
                            fullWidth: true,
                            size: 'small',
                            sx: styles.darkFieldStyles,
                            disabled: !hasModifyPermission,
                          },
                        }}
                        disabled={!hasModifyPermission}
                    />
                  </LocalizationProvider>
                </Box>
              </Box>

              {/* Location Info */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Location:</Typography>
                <Typography sx={styles.valueStyles}>
                  {location?.label || 'Unknown Location'}
                </Typography>
              </Box>

              {/* Notes Field */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Notes:</Typography>
                <TextField
                    multiline
                    rows={3}
                    value={localState.notes}
                    onChange={(e) =>
                        hasModifyPermission &&
                        setLocalState((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                    }
                    onBlur={() => hasModifyPermission && handleNotesUpdate(localState.notes)}
                    placeholder="Add notes about this sample..."
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{
                      ...styles.darkFieldStyles,
                      flex: 1,
                    }}
                    disabled={!hasModifyPermission}
                />
              </Box>

              {/* Proximity Category Field */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Proximity:</Typography>
                <Box sx={styles.valueStyles}>
                  <FormControl
                      variant="outlined"
                      fullWidth
                      size="small"
                      sx={styles.darkFieldStyles}
                      disabled={!hasModifyPermission}
                  >
                    <InputLabel id="proximity-category-label">Proximity</InputLabel>
                    <Select
                        labelId="proximity-category-label"
                        label="Proximity"
                        /* Use empty string '' when localState.proximityCategory is null */
                        value={localState.proximityCategory ?? ''}
                        onChange={(e) => {
                          if (hasModifyPermission) {
                            // Convert '' (the "None" selection) back to null
                            const newValue =
                                e.target.value === ''
                                    ? null
                                    : (e.target.value as ProximityCategory);

                            // Update your state or call your handler
                            handleProximityUpdate(newValue);
                          }
                        }}
                        renderValue={(value) => {
                          // If value is empty string, show "None" in the Select
                          // @ts-ignore
                          return value === '' ? <em>None</em> : (value as string);
                        }}
                    >
                      {/* Empty / None option */}
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>

                      {/* Enum values */}
                      {Object.values(ProximityCategory).map((value) => (
                          <MenuItem key={value} value={value}>
                            {value}
                          </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Location Fields Component */}
              <LocationFields
                  sampleGroup={sampleGroup as TSampleGroupMetadata}
                  metadataItemStyles={{
                    ...styles.metadataItemStyles,
                    minHeight: 'fit-content', // Ensure enough space for error messages
                    py: 2, // Add vertical padding
                  }}
                  labelStyles={styles.labelStyles}
                  darkFieldStyles={styles.darkFieldStyles}
                  disabled={!hasModifyPermission}
              />

              {/* Penguin Count Field (can be null) */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Penguin Count:</Typography>
                <TextField
                    // Use type="number" (or "text" if you prefer to handle parsing more manually)
                    type="number"
                    value={localState.penguinCount ?? ''}
                    onChange={(e) => {
                      if (!hasModifyPermission) return;
                      const val = e.target.value;
                      // If the user clears the field (val === ""), store null
                      // Otherwise, parse the integer
                      setLocalState((prev) => ({
                        ...prev,
                        penguinCount: val === '' ? null : parseInt(val, 10),
                      }));
                    }}
                    onBlur={() =>
                        hasModifyPermission && handlePenguinCountUpdate(localState.penguinCount)
                    }
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{
                      ...styles.darkFieldStyles,
                      flex: 1,
                    }}
                    disabled={!hasModifyPermission}
                />
              </Box>

              {/* Penguins Present Field */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Penguins Present:</Typography>
                <Box sx={styles.valueStyles}>
                  <Switch
                      checked={Boolean(localState.penguinPresent)}
                      onChange={(e) => hasModifyPermission && handlePenguinPresentUpdate(e.target.checked)}
                      color="primary"
                      disabled={!hasModifyPermission}
                  />
                </Box>
              </Box>

              {/* Excluded Field */}
              <Box sx={styles.metadataItemStyles}>
                <Typography sx={styles.labelStyles}>Excluded:</Typography>
                <Box sx={styles.valueStyles}>
                  <Switch
                      checked={Boolean(localState.excluded)}
                      onChange={(e) => hasModifyPermission && handleExcludedUpdate(e.target.checked)}
                      color="primary"
                      disabled={!hasModifyPermission}
                  />
                </Box>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Card>
  );
};

export default SampleGroupMetadataComponent;
