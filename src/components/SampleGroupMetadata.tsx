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
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SxProps, Theme } from '@mui/material/styles';

import { useData, useUI } from '../lib/hooks';
import type { SampleGroupMetadata as TSampleGroupMetadata } from '../lib/types';
import LocationFields from './LocationFields';

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

export const SampleGroupMetadata: React.FC = () => {
  const theme = useTheme();
  const { locations, updateSampleGroup, sampleGroups } = useData();
  const { selectedLeftItem } = useUI();

  // Local state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [localState, setLocalState] = useState({
    collectionTimeUTC: '',
    notes: '',
  });

  // Get current sample group
  const sampleGroup = selectedLeftItem
      ? sampleGroups[selectedLeftItem.id]
      : null as unknown as TSampleGroupMetadata;

  const location = sampleGroup?.loc_id
      ? locations.find(loc => loc.id === sampleGroup.loc_id)
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
      });
    }
  }, [sampleGroup]);

  // Handlers
  const handleCollectionTimeUpdate = useCallback(async (timeString: string) => {
    if (!sampleGroup?.id) return;

    try {
      let collection_datetime_utc: string | undefined;

      if (timeString) {
        const utcDateTimeString = `${sampleGroup.collection_date}T${timeString}Z`;
        const utcDateTime = new Date(utcDateTimeString);
        collection_datetime_utc = utcDateTime.toISOString();
      }

      setLocalState(prev => ({
        ...prev,
        collectionTimeUTC: timeString
      }));

      await updateSampleGroup(sampleGroup.id, { collection_datetime_utc });
    } catch (error) {
      console.error('Error updating collection time:', error);
      // Reset to previous value on error
      setLocalState(prev => ({
        ...prev,
        collectionTimeUTC: sampleGroup.collection_datetime_utc
            ? new Date(sampleGroup.collection_datetime_utc)
                .toISOString()
                .split('T')[1]
                .substring(0, 8)
            : ''
      }));
    }
  }, [sampleGroup, updateSampleGroup]);

  const handleNotesUpdate = useCallback(async (newNotes: string) => {
    if (!sampleGroup?.id) return;

    try {
      setLocalState(prev => ({
        ...prev,
        notes: newNotes
      }));

      await updateSampleGroup(sampleGroup.id, { notes: newNotes });
    } catch (error) {
      console.error('Error updating notes:', error);
      setLocalState(prev => ({
        ...prev,
        notes: sampleGroup.notes || ''
      }));
    }
  }, [sampleGroup, updateSampleGroup]);

  if (!sampleGroup) return null;

  return (
      <Card sx={styles.containerStyles}>
        <Accordion
            expanded={isExpanded}
            onChange={() => setIsExpanded(!isExpanded)}
            sx={styles.accordionStyles}
            disableGutters
        >
          <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={styles.summaryStyles}
          >
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

          <AccordionDetails sx={{
            p: 0,
            overflowY: 'auto',
            overflowX: 'hidden', // Prevent horizontal scroll
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: 'calc(100vh - 240px)', // Adjusted for header and margins
          }}>
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 'min-content',
              pb: 2, // Add bottom padding for last item
            }}>
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
                          if (newValue && !isNaN(newValue.getTime())) {
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
                          },
                        }}
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
                    onChange={(e) => setLocalState(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    onBlur={() => handleNotesUpdate(localState.notes)}
                    placeholder="Add notes about this sample..."
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{
                      ...styles.darkFieldStyles,
                      flex: 1,
                    }}
                />
              </Box>

              {/* Location Fields Component */}
              <LocationFields
                  sampleGroup={sampleGroup}
                  metadataItemStyles={{
                    ...styles.metadataItemStyles,
                    minHeight: 'fit-content', // Ensure enough space for error messages
                    py: 2, // Add vertical padding
                  }}
                  labelStyles={styles.labelStyles}
                  darkFieldStyles={styles.darkFieldStyles}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Card>
  );
};

export default SampleGroupMetadata;