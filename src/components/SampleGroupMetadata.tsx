// src/components/SampleGroupMetadata.tsx

import React, { useState } from 'react';
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
import { SampleGroup } from '../lib/types';
import { SampleGroupService } from '../lib/services/SampleGroupService';
import LocationFields from './LocationFields';
import { useData } from '../lib/hooks';

interface SampleGroupMetadataProps {
  sampleGroup: SampleGroup;
}

const SampleGroupMetadata: React.FC<SampleGroupMetadataProps> = ({
                                                                   sampleGroup,
                                                                 }) => {
  const { locations } = useData();
  const theme = useTheme();

  // Initialize state directly from props
  const [collectionTimeUTC, setCollectionTimeUTC] = useState<string>(
      sampleGroup.collection_datetime_utc
          ? new Date(sampleGroup.collection_datetime_utc)
              .toISOString()
              .split('T')[1]
              .substring(0, 8)
          : '',
  );
  const [notes, setNotes] = useState<string>(sampleGroup.notes || '');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const location = sampleGroup
      ? locations.find((loc: { id: string }) => loc.id === sampleGroup.loc_id)
      : null;

  const handleCollectionTimeUpdate = async (timeString: string) => {
    console.log('handleCollectionTimeUpdate called with:', timeString); // Debug log

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
      console.log('setCollectionTimeUTC called with:', timeString); // Debug log

      // Use SampleGroupService to update the sample group
      await SampleGroupService.updateSampleGroup(sampleGroup.id, {
        collection_datetime_utc,
      });

      console.log('Sample group updated via SampleGroupService'); // Debug log
    } catch (error) {
      console.error('Error updating collection time:', error);
    }
  };

  const handleNotesUpdate = async (newNotes: string) => {
    console.log('handleNotesUpdate called with:', newNotes); // Debug log

    if (!sampleGroup.id) {
      console.error('Sample group ID is undefined');
      return;
    }

    try {
      // Update local state immediately
      setNotes(newNotes);
      console.log('setNotes called with:', newNotes); // Debug log

      // Use SampleGroupService to update the sample group
      await SampleGroupService.updateSampleGroup(sampleGroup.id, {
        notes: newNotes,
      });

      console.log('Sample group updated via SampleGroupService'); // Debug log
    } catch (error) {
      console.error('Error updating notes:', error);
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
          {sampleGroup.human_readable_sample_id}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {sampleGroup.collection_date} •{' '}
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
                {sampleGroup.human_readable_sample_id}
              </Typography>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>Date:</Typography>
              <Typography sx={valueStyles}>
                {sampleGroup.collection_date}
              </Typography>
            </Box>

            <Box sx={metadataItemStyles}>
              <Typography sx={labelStyles}>
                Collection Time (UTC):
              </Typography>
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
                          setCollectionTimeUTC(timeString);
                          console.log('TimePicker onChange:', timeString); // Debug log
                        } else {
                          setCollectionTimeUTC('');
                          console.log('TimePicker onChange: cleared'); // Debug log
                        }
                      }}
                      onAccept={(newValue) => {
                        if (newValue && !isNaN(newValue.getTime())) {
                          const timeString = format(newValue, 'HH:mm:ss');
                          handleCollectionTimeUpdate(timeString);
                          console.log('TimePicker onAccept:', timeString); // Debug log
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
                        popper: {
                          sx: {
                            '& .MuiPaper-root': {
                              backgroundColor: theme.palette.background.paper,
                              color: theme.palette.text.primary,
                            },
                            '& .MuiPickersDay-root': {
                              color: theme.palette.text.primary,
                              '&.Mui-selected': {
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.common.white,
                              },
                            },
                          },
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
                  onChange={(e) => {
                    setNotes(e.target.value);
                    console.log('Notes onChange:', e.target.value); // Debug log
                  }}
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
