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
  CircularProgress, SelectChangeEvent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  TimePicker,
  DatePicker,
  LocalizationProvider,
} from '@mui/x-date-pickers';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFnsV3';
import {format, parse} from 'date-fns';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {useTheme} from '@mui/material/styles';
import {LocationOn} from "@mui/icons-material";

/**
 * Represents a form field with various customizable attributes.
 *
 * @interface Field
 *
 * @property {string} name
 * The unique identifier for the field. This is typically used to reference the field internally and must not be null or undefined.
 *
 * @property {string} [label]
 * An optional human-readable label for the field. This is usually displayed alongside the field to inform the user about its purpose.
 *
 * @property {'text' | 'textarea' | 'select' | 'number' | 'date' | 'time' | 'timezone'} type
 * Specifies the type of the field, determining the kind of input expected from the user or the way the field is rendered.
 *
 * @property {{ value: string; label: string }[]} [options]
 * An optional array of option objects, applicable when the field type is 'select'. Each option object must contain a 'value' and a 'label' that will be presented in the selection list.
 *
 * @property {string} [tooltip]
 * An optional descriptive text providing additional information about the field. It may be shown to the user, often as a hover effect, to assist with filling out the field correctly.
 *
 * @property {boolean} [required]
 * Indicates whether the field is mandatory. If true, the form containing the field should not be submitted without a valid input for this field.
 */
// src/renderer/components/Modal/Modal.tsx

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
        | 'timezone'
        | 'location'; // Added 'location' type
    options?: { value: string; label: string }[];
    tooltip?: string;
    required?: boolean;
}


/**
 * Represents the properties for a Modal component.
 *
 * This interface defines the necessary and optional properties needed for
 * configuring and handling a modal's behavior, including its visibility, title,
 * event handlers for changes and submission, as well as customization options for
 * appearance and interaction.
 *
 * @property isOpen - Indicates whether the modal is currently open.
 * @property title - The title displayed at the top of the modal.
 * @property onClose - A callback function invoked when the modal is requested to be closed.
 * @property className - Optional additional CSS class names for styling the modal.
 * @property modalFields - Optional array of fields contained within the modal.
 * @property modalInputs - Optional record of input field values within the modal.
 * @property handleModalChange - Optional handler for changes in modal input fields.
 * @property handleModalSubmit - Optional handler for form submission within the modal.
 * @property requiredFields - Optional array of field names that are required within the modal.
 * @property children - Optional React nodes to be rendered inside the modal.
 * @property isProcessing - Optional indicator whether an operation is in progress.
 */
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
          | SelectChangeEvent,
      child?: React.ReactNode
  ) => void;
  handleModalSubmit?: () => void;
  requiredFields?: string[];
  children?: React.ReactNode;
  isProcessing?: boolean;
}

/**
 * An array of timezone objects, each containing a label and a value.
 *
 * Each object contains:
 * - label: A string representing the timezone offset from UTC in the format "UTC±HH:MM".
 * - value: A string representing the corresponding IANA timezone in the "Etc/GMT±HH" format.
 *
 * This array provides timezones ranging from UTC−12:00 to UTC+12:00, enabling users to identify
 * time offsets easily with standardized labels and IANA timezone designations.
 */
const timezones = [
  {label: 'UTC−12:00', value: 'Etc/GMT+12'},
  {label: 'UTC−11:00', value: 'Etc/GMT+11'},
  {label: 'UTC−10:00', value: 'Etc/GMT+10'},
  {label: 'UTC−09:00', value: 'Etc/GMT+9'},
  {label: 'UTC−08:00', value: 'Etc/GMT+8'},
  {label: 'UTC−07:00', value: 'Etc/GMT+7'},
  {label: 'UTC−06:00', value: 'Etc/GMT+6'},
  {label: 'UTC−05:00', value: 'Etc/GMT+5'},
  {label: 'UTC−04:00', value: 'Etc/GMT+4'},
  {label: 'UTC−03:00', value: 'Etc/GMT+3'},
  {label: 'UTC−02:00', value: 'Etc/GMT+2'},
  {label: 'UTC−01:00', value: 'Etc/GMT+1'},
  {label: 'UTC+00:00', value: 'Etc/GMT'},
  {label: 'UTC+01:00', value: 'Etc/GMT-1'},
  {label: 'UTC+02:00', value: 'Etc/GMT-2'},
  {label: 'UTC+03:00', value: 'Etc/GMT-3'},
  {label: 'UTC+04:00', value: 'Etc/GMT-4'},
  {label: 'UTC+05:00', value: 'Etc/GMT-5'},
  {label: 'UTC+06:00', value: 'Etc/GMT-6'},
  {label: 'UTC+07:00', value: 'Etc/GMT-7'},
  {label: 'UTC+08:00', value: 'Etc/GMT-8'},
  {label: 'UTC+09:00', value: 'Etc/GMT-9'},
  {label: 'UTC+10:00', value: 'Etc/GMT-10'},
  {label: 'UTC+11:00', value: 'Etc/GMT-11'},
  {label: 'UTC+12:00', value: 'Etc/GMT-12'},
];

/**
 * A React Functional Component representing a customizable modal dialog.
 *
 * This component displays a modal dialog with a title, content, and an optional form.
 * The form can include various input fields such as text, textarea, number, select, date, time, and timezone.
 * Each field can be customized and includes validation, event handling, and additional properties like labels and tooltips.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Indicates whether the modal is open or not.
 * @param {string} props.title - The title of the modal.
 * @param {Function} props.onClose - Function to be called when the modal is closed.
 * @param {string} [props.className] - Additional class name(s) to be applied to the modal.
 * @param {Array} [props.modalFields] - An array of field configuration objects for dynamically generating form inputs in the modal.
 * @param {object} [props.modalInputs] - An object containing the current values of the modal's form inputs.
 * @param {Function} [props.handleModalChange] - Callback function to handle form input changes.
 * @param {Function} [props.handleModalSubmit] - Callback function to handle form submission.
 * @param {React.ReactNode} [props.children] - Additional components or elements to be rendered inside the modal content area.
 * @param {boolean} [props.isProcessing=false] - Indicates whether the modal is in a processing state (e.g., submitting data).
 */
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
    (<Dialog
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
          <CloseIcon/>
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
                {modalFields.map((field) => {
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
                            <InputLabel id={`${field.name}-label`}>{field.label}</InputLabel>
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
                        // Replace this in your DatePicker component
                        (<DatePicker
                            key={field.name}
                            label={field.label}
                            value={
                              modalInputs[field.name]
                                  ? parse(modalInputs[field.name], 'yyyy-MM-dd', new Date())
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
                            slotProps={{
                              textField: {
                                required: field.required || false,
                                fullWidth: true,
                                sx: darkFieldStyles,
                                InputProps: {
                                  startAdornment: (
                                      <>
                                        <CalendarTodayIcon
                                            sx={{
                                              color: theme.palette.text.primary,
                                              mr: 1,
                                            }}
                                        />
                                      </>
                                  ),
                                },
                              },
                            }}
                        />)
                      );

                    case 'time':
                      return (
                        // Replace this in your TimePicker component
                        (<TimePicker
                            key={field.name}
                            label={field.label}
                            value={
                              modalInputs[field.name]
                                  ? parse(modalInputs[field.name], 'HH:mm:ss', new Date())
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
                            slotProps={{
                              textField: {
                                required: field.required || false,
                                fullWidth: true,
                                sx: darkFieldStyles,
                                InputProps: {
                                  startAdornment: (
                                      <>
                                        <AccessTimeIcon
                                            sx={{
                                              color: theme.palette.text.primary,
                                              mr: 1,
                                            }}
                                        />
                                      </>
                                  ),
                                },
                              },
                            }}
                        />)
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

                      case 'location':
                          return (
                              <Autocomplete
                                  key={field.name}
                                  options={field.options || []} // Use options from the field
                                  getOptionLabel={(option) => option.label}
                                  value={
                                      field.options?.find((loc) => loc.value === modalInputs[field.name]) || null
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
                                              field.label
                                                  ? `Select ${field.label.toLowerCase()}...`
                                                  : 'Select location...'
                                          }
                                          sx={darkFieldStyles}
                                      />
                                  )}
                                  fullWidth
                                  popupIcon={<LocationOn />} // Using Globe Icon for Location
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
    </Dialog>)
  );
};

export default Modal;
