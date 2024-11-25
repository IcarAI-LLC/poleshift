// src/theme.ts

import { createTheme } from '@mui/material/styles';

// 1. Create a Base Theme
const baseTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6200ee',
      light: '#8F3AFF',
      dark: '#3700b3',
    },
    secondary: {
      main: '#03DAC6',
      light: '#66FFF8',
      dark: '#00A896',
    },
    background: {
      default: '#121212',
      paper: '#1a1a1a',
    },
    error: {
      main: '#CF6679',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#b0b0b0',
    },
    action: {
      hover: 'rgba(255, 255, 255, 0.05)',
      selected: 'rgba(255, 255, 255, 0.08)',
    },
    divider: 'rgba(255, 255, 255, 0.1)',
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    fontSize: 16,
    h6: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
  },
});

// 2. Extend the Base Theme with Component Overrides
const theme = createTheme(baseTheme, {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: baseTheme.palette.background.default,
          color: baseTheme.palette.text.primary,
          scrollbarColor: `${baseTheme.palette.grey[700]} ${baseTheme.palette.background.paper}`,
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: '4px',
            backgroundColor: baseTheme.palette.grey[700],
            minHeight: 24,
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: baseTheme.palette.background.paper,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(18, 18, 18, 0.7)',
          borderRadius: '4px',
          color: baseTheme.palette.text.primary,
          '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.23)',
          },
          '&:hover fieldset': {
            borderColor: baseTheme.palette.primary.main,
          },
          '&.Mui-focused fieldset': {
            borderColor: baseTheme.palette.primary.main,
          },
        },
        input: {
          padding: '16.5px 14px', // Update padding to align text vertically in the center
          lineHeight: 1.5, // Adjust line height to improve text positioning
          '&::placeholder': {
            color: baseTheme.palette.text.secondary,
            opacity: 0.7,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: baseTheme.palette.text.primary,
          '&.Mui-focused': {
            color: baseTheme.palette.primary.main,
          },
        },
        outlined: {
          transform: 'translate(14px, 16px) scale(1)', // Adjust label position
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -6px) scale(0.75)', // Adjust shrunk label position
          },
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          padding: '24px', // Increased padding
          '& .MuiFormControl-root': {
            marginBottom: '20px', // Add bottom margin to form controls
            marginTop: '20px',
          },
          '& .MuiFormControl-root:last-child': {
            marginBottom: '20px', // Less margin on last form control
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '14px', // Match input padding
        },
        icon: {
          color: baseTheme.palette.text.primary,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          padding: '8px 16px',
        },
        containedPrimary: {
          backgroundColor: baseTheme.palette.primary.main,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: baseTheme.palette.primary.dark,
          },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.23)',
          color: baseTheme.palette.text.primary,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: baseTheme.palette.text.primary,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          minWidth: '500px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginRight: '10px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 24px', // Increased padding
        },
      },
    },
    // MUI X Components Overrides
    MuiPickersDay: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          color: baseTheme.palette.text.primary,
          '&.Mui-selected': {
            backgroundColor: baseTheme.palette.primary.main,
            color: '#ffffff',
            '&:hover': {
              backgroundColor: baseTheme.palette.primary.dark,
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
          '&.MuiPickersDay-today': {
            borderColor: baseTheme.palette.primary.main,
          },
        },
      },
    },
    MuiPickersToolbar: {
      styleOverrides: {
        toolbar: {
          backgroundColor: '#1a1a1a',
          color: baseTheme.palette.text.primary,
        },
      },
    },
    MuiPickerStaticWrapper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        listbox: {
          '& .MuiAutocomplete-option': {
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
            '&[aria-selected="true"]': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      },
    },
  },
});

export { theme };
