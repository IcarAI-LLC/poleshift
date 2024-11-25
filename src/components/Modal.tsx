// src/renderer/components/Modal/Modal.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  IconButton,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  TimePicker,
  DatePicker,
  LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { format, parse } from 'date-fns';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTheme } from '@mui/material/styles';

interface Field {
  name: string;
  label?: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'date'
    | 'time'
    | 'timezone';
  options?: { value: string; label: string }[];
  tooltip?: string;
  required?: boolean;
}

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  className?: string;
  modalFields?: Field[];
  modalInputs?: Record<string, string>;
  handleModalChange?: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<{ name?: string; value: unknown }>
      | React.SyntheticEvent<Element, Event>,
  ) => void;
  handleModalSubmit?: () => void;
  requiredFields?: string[];
  children?: React.ReactNode;
  isProcessing?: boolean;
}

const timezones = [
  { label: 'UTC−12:00', value: 'Etc/GMT+12' },
  { label: 'UTC−11:00', value: 'Etc/GMT+11' },
  { label: 'UTC−10:00', value: 'Etc/GMT+10' },
  { label: 'UTC−09:00', value: 'Etc/GMT+9' },
  { label: 'UTC−08:00', value: 'Etc/GMT+8' },
  { label: 'UTC−07:00', value: 'Etc/GMT+7' },
  { label: 'UTC−06:00', value: 'Etc/GMT+6' },
  { label: 'UTC−05:00', value: 'Etc/GMT+5' },
  { label: 'UTC−04:00', value: 'Etc/GMT+4' },
  { label: 'UTC−03:00', value: 'Etc/GMT+3' },
  { label: 'UTC−02:00', value: 'Etc/GMT+2' },
  { label: 'UTC−01:00', value: 'Etc/GMT+1' },
  { label: 'UTC+00:00', value: 'Etc/GMT' },
  { label: 'UTC+01:00', value: 'Etc/GMT-1' },
  { label: 'UTC+02:00', value: 'Etc/GMT-2' },
  { label: 'UTC+03:00', value: 'Etc/GMT-3' },
  { label: 'UTC+04:00', value: 'Etc/GMT-4' },
  { label: 'UTC+05:00', value: 'Etc/GMT-5' },
  { label: 'UTC+06:00', value: 'Etc/GMT-6' },
  { label: 'UTC+07:00', value: 'Etc/GMT-7' },
  { label: 'UTC+08:00', value: 'Etc/GMT-8' },
  { label: 'UTC+09:00', value: 'Etc/GMT-9' },
  { label: 'UTC+10:00', value: 'Etc/GMT-10' },
  { label: 'UTC+11:00', value: 'Etc/GMT-11' },
  { label: 'UTC+12:00', value: 'Etc/GMT-12' },
];

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  onClose,
  className = '',
  modalFields,
  modalInputs,
  handleModalChange,
  handleModalSubmit,
  children,
  isProcessing = false,
}) => {
  const theme = useTheme();

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
    '& .MuiAutocomplete-popupIndicator': {
      color: theme.palette.text.primary,
    },
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="modal-title"
      className={className}
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <DialogTitle
        id="modal-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing(2),
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: theme.palette.text.primary,
        }}
      >
        <Typography>{title}</Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close Modal"
          sx={{
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          padding: theme.spacing(2),
          overflowY: 'auto',
          backgroundColor: '#1a1a1a',
        }}
      >
        {modalFields &&
        modalInputs &&
        handleModalChange &&
        handleModalSubmit ? (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleModalSubmit();
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing(2),
              }}
            >
              {modalFields.map((field, index) => {
                const hasLabel = Boolean(field.label);

                const textFieldProps = {
                  id: field.name,
                  name: field.name,
                  value: modalInputs[field.name] || '',
                  required: field.required || false,
                  label: hasLabel ? field.label : undefined,
                  placeholder: hasLabel
                    ? `Enter ${field.label?.toLowerCase()}...`
                    : `Enter your input...`,
                  onChange: handleModalChange,
                  helperText: field.tooltip,
                  sx: darkFieldStyles,
                };

                switch (field.type) {
                  case 'text':
                    return (
                      <TextField
                        key={field.name}
                        {...textFieldProps}
                        variant="outlined"
                        fullWidth
                      />
                    );

                  case 'textarea':
                    return (
                      <TextField
                        key={field.name}
                        {...textFieldProps}
                        variant="outlined"
                        fullWidth
                        multiline
                        minRows={4}
                      />
                    );

                  case 'number':
                    return (
                      <TextField
                        key={field.name}
                        {...textFieldProps}
                        variant="outlined"
                        fullWidth
                        type="number"
                      />
                    );

                  case 'select':
                    return (
                      <FormControl
                        key={field.name}
                        variant="outlined"
                        fullWidth
                        required={field.required}
                        sx={darkFieldStyles}
                      >
                        <InputLabel id={`${field.name}-label`}>
                          {field.label}
                        </InputLabel>
                        <Select
                          labelId={`${field.name}-label`}
                          id={field.name}
                          name={field.name}
                          value={modalInputs[field.name] || ''}
                          onChange={handleModalChange}
                          label={field.label}
                        >
                          <MenuItem value="" disabled>
                            Select an option
                          </MenuItem>
                          {field.options?.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );

                  case 'date':
                    return (
                      <DatePicker
                        key={field.name}
                        label={field.label}
                        value={
                          modalInputs[field.name]
                            ? parse(
                                modalInputs[field.name],
                                'yyyy-MM-dd',
                                new Date(),
                              )
                            : null
                        }
                        onChange={(newValue) => {
                          if (newValue && !isNaN(newValue.getTime())) {
                            const dateString = format(newValue, 'yyyy-MM-dd');
                            handleModalChange({
                              target: {
                                name: field.name,
                                value: dateString,
                              },
                            } as any);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required={field.required || false}
                            fullWidth
                            sx={darkFieldStyles}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  {params.InputProps?.startAdornment}
                                  <CalendarTodayIcon
                                    sx={{
                                      color: theme.palette.text.primary,
                                      mr: 1,
                                    }}
                                  />
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    );

                  case 'time':
                    return (
                      <TimePicker
                        key={field.name}
                        label={field.label}
                        value={
                          modalInputs[field.name]
                            ? parse(
                                modalInputs[field.name],
                                'HH:mm:ss',
                                new Date(),
                              )
                            : null
                        }
                        onChange={(newValue) => {
                          if (newValue && !isNaN(newValue.getTime())) {
                            const timeString = format(newValue, 'HH:mm:ss');
                            handleModalChange({
                              target: {
                                name: field.name,
                                value: timeString,
                              },
                            } as any);
                          }
                        }}
                        ampm={false}
                        views={['hours', 'minutes', 'seconds']}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required={field.required || false}
                            fullWidth
                            sx={darkFieldStyles}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  {params.InputProps?.startAdornment}
                                  <AccessTimeIcon
                                    sx={{
                                      color: theme.palette.text.primary,
                                      mr: 1,
                                    }}
                                  />
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    );

                  case 'timezone':
                    return (
                      <Autocomplete
                        key={field.name}
                        options={timezones}
                        getOptionLabel={(option) => option.label}
                        value={
                          timezones.find(
                            (tz) => tz.value === modalInputs[field.name],
                          ) || null
                        }
                        onChange={(_, newValue) => {
                          handleModalChange({
                            target: {
                              name: field.name,
                              value: newValue ? newValue.value : '',
                            },
                          } as any);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={field.label}
                            required={field.required || false}
                            placeholder={
                              hasLabel
                                ? `Select ${field.label?.toLowerCase()}...`
                                : `Select timezone...`
                            }
                            sx={darkFieldStyles}
                          />
                        )}
                        fullWidth
                        popupIcon={<AccessTimeIcon />}
                        sx={{
                          '& .MuiAutocomplete-paper': {
                            backgroundColor: '#1a1a1a',
                            color: theme.palette.text.primary,
                          },
                        }}
                      />
                    );

                  default:
                    return (
                      <TextField
                        key={field.name}
                        {...textFieldProps}
                        variant="outlined"
                        fullWidth
                      />
                    );
                }
              })}

              <DialogActions
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: theme.spacing(2),
                  marginTop: theme.spacing(2),
                  padding: theme.spacing(2),
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Button
                  type="button"
                  variant="outlined"
                  onClick={onClose}
                  sx={{
                    color: theme.palette.text.primary,
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: theme.palette.text.primary,
                    },
                    minWidth: '100px',
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    minWidth: '100px',
                    color: '#ffffff',
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Submit'
                  )}
                </Button>
              </DialogActions>
            </Box>
          </LocalizationProvider>
        ) : (
          <Box
            className="data-content"
            sx={{
              color: theme.palette.text.primary,
              '& table': {
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#1a1a1a',
              },
              '& th, & td': {
                padding: theme.spacing(1.5),
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: theme.palette.text.primary,
              },
              '& th': {
                backgroundColor: '#242424',
                fontWeight: 600,
              },
              '& tr:nth-of-type(even)': {
                backgroundColor: '#1f1f1f',
              },
              '& tr:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            {children}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
