import React, { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  IconButton,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTime } from 'luxon';
import useUI from '../hooks/useUI';
import { useLocations } from '../hooks/useLocations';

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
  const { filters, setFilters } = useUI();
  const { locations } = useLocations();
  const theme = useTheme();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const handleStartDateChange = (date: DateTime | null) => {
    const newStartDate = date ? date.toISODate() : null;
    setFilters((prev) => ({
      ...prev,
      startDate: newStartDate,
    }));
  };

  const handleEndDateChange = (date: DateTime | null) => {
    const newEndDate = date ? date.toISODate() : null;
    setFilters((prev) => ({
      ...prev,
      endDate: newEndDate,
    }));
  };

  const handleLocationChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    setFilters((prev) => ({
      ...prev,
      selectedLocations: typeof value === 'string' ? value.split(',') : value,
    }));
  };

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

  const darkFieldStyles = {
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
  };

  const selectMenuProps = {
    PaperProps: {
      sx: {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        '& .MuiMenuItem-root': {
          '&.Mui-selected': {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.common.white,
          },
          '&.Mui-selected:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
          },
        },
      },
    },
  };

  return (
    <Box
      className="filter-menu visible"
      onClick={(e) => e.stopPropagation()}
      sx={{
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
      }}
    >
      <Box
        className="filter-menu-header"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing(3),
        }}
      >
        <Typography variant="h6" color="textPrimary">
          Filters
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="close"
          size="small"
          sx={{
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ marginBottom: theme.spacing(2) }}>
        <DatePicker
          label="Start Date"
          value={filters.startDate ? DateTime.fromISO(filters.startDate) : null}
          onChange={handleStartDateChange}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              size="small"
              inputRef={firstInputRef}
              fullWidth
              sx={darkFieldStyles}
            />
          )}
        />
      </Box>

      <Box sx={{ marginBottom: theme.spacing(2) }}>
        <DatePicker
          label="End Date"
          value={filters.endDate ? DateTime.fromISO(filters.endDate) : null}
          onChange={handleEndDateChange}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              size="small"
              fullWidth
              sx={darkFieldStyles}
            />
          )}
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
              .map(
                (locId) =>
                  locations.find((loc) => loc.id === locId)?.label || locId,
              )
              .join(', ')
          }
          MenuProps={selectMenuProps}
          sx={darkFieldStyles}
        >
          {locations.map((location) => (
            <MenuItem key={location.id} value={location.id}>
              {location.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing(1),
          marginTop: theme.spacing(3),
        }}
      >
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
  );
};

export default FilterMenu;
