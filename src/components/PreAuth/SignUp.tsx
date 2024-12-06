// components/PreAuth/SignUp.tsx

import React, { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAuth } from '../../lib/hooks';
import type { PreAuthView } from '../../lib/types';

interface SignUpFormState {
  email: string;
  password: string;
  licenseKey: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

interface SignUpProps {
  onNavigate: (view: PreAuthView) => void;
}

const SignUp: React.FC<SignUpProps> = ({ onNavigate }) => {
  const { signUp } = useAuth();
  const [formState, setFormState] = useState<SignUpFormState>({
    email: '',
    password: '',
    licenseKey: '',
    message: null,
    error: null,
    isLoading: false,
  });

  const handleInputChange =
      (field: keyof SignUpFormState) =>
          (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormState((prev) => ({ ...prev, [field]: e.target.value }));
          };

  const styles = useMemo(
      () => ({
        container: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          p: 2,
        } as SxProps<Theme>,
        form: {
          width: '100%',
          maxWidth: 400,
          p: 4,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 3,
        } as SxProps<Theme>,
        button: {
          mt: 2,
          mb: 1,
        } as SxProps<Theme>,
      }),
      []
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate form fields
    if (!formState.email || !formState.password || !formState.licenseKey) {
      setFormState((prev) => ({
        ...prev,
        error: 'All fields are required.',
      }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      error: null,
      message: null,
      isLoading: true,
    }));

    try {
      // Call signUp with email, password, and licenseKey
      await signUp(formState.email, formState.password, formState.licenseKey);

      setFormState((prev) => ({
        ...prev,
        message:
            'Sign-up successful! Please check your email to confirm your account before logging in.',
        isLoading: false,
        // Optionally, you can clear the form fields after successful sign-up
        email: '',
        password: '',
        licenseKey: '',
      }));
    } catch (err) {
      console.error('Sign-up error:', err);
      setFormState((prev) => ({
        ...prev,
        error:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        isLoading: false,
      }));
    }
  };

  return (
      <Box sx={styles.container}>
        <Box component="form" onSubmit={handleSubmit} sx={styles.form}>
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Sign Up
          </Typography>

          {formState.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formState.error}
              </Alert>
          )}

          {formState.message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {formState.message}{' '}
                <Button variant="text" onClick={() => onNavigate('login')}>
                  Log in here
                </Button>
              </Alert>
          )}

          <TextField
              label="Email"
              variant="outlined"
              type="email"
              fullWidth
              margin="normal"
              value={formState.email}
              onChange={handleInputChange('email')}
              required
              disabled={!!formState.message || formState.isLoading}
              autoComplete="email"
              inputProps={{
                'aria-label': 'Email',
              }}
          />

          <TextField
              label="Password"
              variant="outlined"
              type="password"
              fullWidth
              margin="normal"
              value={formState.password}
              onChange={handleInputChange('password')}
              required
              disabled={!!formState.message || formState.isLoading}
              autoComplete="new-password"
              inputProps={{
                'aria-label': 'Password',
              }}
          />

          <TextField
              label="License Key"
              variant="outlined"
              type="text"
              fullWidth
              margin="normal"
              value={formState.licenseKey}
              onChange={handleInputChange('licenseKey')}
              required
              disabled={!!formState.message || formState.isLoading}
              inputProps={{
                'aria-label': 'License Key',
              }}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={styles.button}
              disabled={!!formState.message || formState.isLoading}
              startIcon={formState.isLoading ? <CircularProgress size={20} /> : null}
          >
            {formState.isLoading ? 'Signing Up...' : 'Sign Up'}
          </Button>

          {!formState.message && (
              <Box textAlign="center" mt={2}>
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Button
                      variant="text"
                      onClick={() => onNavigate('login')}
                      disabled={formState.isLoading}
                  >
                    Log In
                  </Button>
                </Typography>
              </Box>
          )}
        </Box>
      </Box>
  );
};

export default SignUp;
