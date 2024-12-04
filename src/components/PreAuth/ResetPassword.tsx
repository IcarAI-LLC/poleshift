// ResetPassword.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useAuth } from '../../lib/hooks';

interface ResetPasswordProps {
  onNavigate: (view: 'login') => void;
}

interface FormState {
  email: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const theme = useTheme();
  const { resetPassword } = useAuth();
  const [formState, setFormState] = useState<FormState>({
    email: '',
    message: null,
    error: null,
    isLoading: false,
  });

  // Memoized styles
  const styles = useMemo(() => ({
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
  }), []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFormState(prev => ({
      ...prev,
      error: null,
      message: null,
      isLoading: true,
    }));

    try {
      await resetPassword(formState.email);
      setFormState(prev => ({
        ...prev,
        message: 'Password reset email sent. Check your inbox.',
        isLoading: false,
      }));
    } catch (err) {
      console.error('Reset Password error:', err);
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
        isLoading: false,
      }));
    }
  }, [formState.email, resetPassword]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState(prev => ({ ...prev, email: e.target.value }));
  }, []);

  return (
      <Box sx={styles.container}>
        <Box component="form" onSubmit={handleSubmit} sx={styles.form}>
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Reset Password
          </Typography>

          {formState.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formState.error}
              </Alert>
          )}

          {formState.message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {formState.message}
              </Alert>
          )}

          <TextField
              label="Email"
              variant="outlined"
              type="email"
              fullWidth
              margin="normal"
              value={formState.email}
              onChange={handleEmailChange}
              required
              disabled={formState.isLoading || !!formState.message}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={styles.button}
              disabled={formState.isLoading || !!formState.message}
              startIcon={formState.isLoading ? <CircularProgress size={20} /> : null}
          >
            {formState.isLoading ? 'Sending...' : 'Reset Password'}
          </Button>

          <Box textAlign="center" mt={2}>
            <Typography variant="body2">
              Remember your password?{' '}
              <Button
                  variant="text"
                  onClick={() => onNavigate('login')}
                  disabled={formState.isLoading}
              >
                Log In
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
  );
};

export default ResetPassword;