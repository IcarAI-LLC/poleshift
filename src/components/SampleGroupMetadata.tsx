// src/components/SampleGroupMetadata.tsx

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SampleGroupMetadata } from '../lib/types';
import LocationFields from './LocationFields';
import { useData, useUI } from '../lib/hooks';

interface SampleGroupMetadataProps {}

const SampleGroupMetadata: React.FC<SampleGroupMetadataProps> = () => {
  const { locations, updateSampleGroup, sampleGroups } = useData();
  const { selectedLeftItem } = useUI();
  let sampleGroup: SampleGroupMetadata;

  if (!selectedLeftItem) {
    sampleGroup = sampleGroups[""] || {};
  } else {
    sampleGroup = sampleGroups[selectedLeftItem?.id] || {};
  }

  const theme = useTheme();

  // Initialize state variables
  const [collectionTimeUTC, setCollectionTimeUTC] = useState<string>(
      sampleGroup.collection_datetime_utc
          ? new Date(sampleGroup.collection_datetime_utc)
              .toISOString()
              .split('T')[1]
              .substring(0, 8)
          : ''
  );
  const [notes, setNotes] = useState<string>(sampleGroup.notes || '');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const location = sampleGroup
      ? locations.find((loc) => loc.id === sampleGroup.loc_id)
      : null;

  // Effect to reset state when sampleGroup changes
  useEffect(() => {
    setCollectionTimeUTC(
        sampleGroup.collection_datetime_utc
            ? new Date(sampleGroup.collection_datetime_utc)
                .toISOString()
                .split('T')[1]
                .substring(0, 8)
            : ''
    );
    setNotes(sampleGroup.notes || '');
    // Add other state setters here if necessary (e.g., latitude, longitude)
  }, [
    sampleGroup.collection_datetime_utc,
    sampleGroup.notes,
    // Include other dependencies if you add more state variables
  ]);

  const handleCollectionTimeUpdate = async (timeString: string) => {
    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      let collection_datetime_utc: string | undefined = undefined;

      if (timeString) {
        const utcDateTimeString = `${sampleGroup.collection_date}T${timeString}Z`;
        const utcDateTime = new Date(utcDateTimeString);
        collection_datetime_utc = utcDateTime.toISOString();
      }

      // Update local state immediately
      setCollectionTimeUTC(timeString);

      // Update sample group through useData
      await updateSampleGroup(sampleGroup.id, {
        collection_datetime_utc,
      });
    } catch (error) {
      console.error('Error updating collection time:', error);
      // Reset to previous value on error
      setCollectionTimeUTC(
          sampleGroup.collection_datetime_utc
              ? new Date(sampleGroup.collection_datetime_utc)
                  .toISOString()
                  .split('T')[1]
                  .substring(0, 8)
              : ''
      );
    }
  };

  const handleNotesUpdate = async (newNotes: string) => {
    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      // Update local state immediately
      setNotes(newNotes);

      // Update sample group through useData
      await updateSampleGroup(sampleGroup.id, {
        notes: newNotes,
      });
    } catch (error) {
      console.error('Error updating notes:', error);
      // Reset to previous value on error
      setNotes(sampleGroup.notes || '');
    }
  };

  const metadataItemStyles = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  };

  const labelStyles = {
    width: '180px',
    flexShrink: 0,
    color: theme.palette.text.secondary,
    fontSize: 'var(--font-size-medium)',
  };

  const valueStyles = {
    flex: 1,
    color: theme.palette.text.primary,
    fontSize: 'var(--font-size-medium)',
  };

  const darkFieldStyles = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'rgba(18, 18, 18, 0.7)',
      '& fieldset': {
        borderColor: theme.palette.divider,
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
      fontSize: 'var(--font-size-medium)',
    },
    '& .MuiSvgIcon-root': {
      color: theme.palette.text.primary,
    },
  };

  const summaryContent = (
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {sampleGroup.human_readable_sample_id || 'Unnamed Sample'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {sampleGroup.collection_date || 'Unknown Date'} •{' '}
          {location ? location.label : 'Unknown Location'}
        </Typography>
      </Box>
  );

  return (
      <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: '8px',
            boxShadow: 'var(--shadow-sm)',
            margin: theme.spacing(2),
          }}
      >
        <Accordion
            expanded={isExpanded}
            onChange={() => setIsExpanded(!isExpanded)}
            sx={{
              '&:before': {
                display: 'none',
              },
              boxShadow: 'none',
            }}
        >
          <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                borderBottom: `1px solid ${theme.palette.divider}`,
                '&.Mui-expanded': {
                  minHeight: '48px',
                },
              }}
          >
            {summaryContent}
          </AccordionSummary>
          <AccordionDetails sx={{ padding: 0 }}>
            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Sample ID:</Typography>
              <Typography sx={valueStyles}>
                {sampleGroup.human_readable_sample_id || 'N/A'}
              </Typography>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Date:</Typography>
              <Typography sx={valueStyles}>
                {sampleGroup.collection_date || 'N/A'}
              </Typography>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Time (UTC):</Typography>
              <Box sx={valueStyles}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <TimePicker
                      value={
                        collectionTimeUTC
                            ? parse(collectionTimeUTC, 'HH:mm:ss', new Date())
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
                          sx: darkFieldStyles,
                        },
                      }}
                  />
                </LocalizationProvider>
              </Box>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Location:</Typography>
              <Typography sx={valueStyles}>
                {location ? location.label : 'Unknown Location'}
              </Typography>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Notes:</Typography>
              <TextField
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => handleNotesUpdate(notes)}
                  placeholder="Add notes about this sample..."
                  fullWidth
                  variant="outlined"
                  size="small"
                  sx={{
                    ...darkFieldStyles,
                    flex: 1,
                  }}
              />
            </Box>

            <LocationFields
                sampleGroup={sampleGroup}
                theme={theme}
                metadataItemStyles={metadataItemStyles}
                labelStyles={labelStyles}
                darkFieldStyles={darkFieldStyles}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
  );
};

export default SampleGroupMetadata;
