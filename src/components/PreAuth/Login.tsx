// components/PreAuth/Login.tsx
import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../../lib/hooks';
import type { PreAuthView } from '../../lib/types';

interface LoginProps {
  onNavigate: (view: PreAuthView) => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { login, processLicenseKey, loading, error: authError } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      const { storedLicenseKey } = await login(email, password);

      if (storedLicenseKey) {
        await processLicenseKey(storedLicenseKey).catch((error) => {
          console.error('License key processing error:', error);
          // Continue even if license processing fails
        });
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const displayError = localError || authError;

  return (
      <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          bgcolor="background.default"
          color="text.primary"
          padding={2}
      >
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              maxWidth: 400,
              p: 4,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 3,
            }}
        >
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Login
          </Typography>

          {displayError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {displayError}
              </Alert>
          )}

          <TextField
              label="Email"
              variant="outlined"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              inputProps={{
                'aria-label': 'Password',
              }}
          />

          <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, mb: 1 }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Logging In...' : 'Login'}
          </Button>

          <Box textAlign="center" mt={2}>
            <Button
                variant="text"
                onClick={() => onNavigate('reset-password')}
                disabled={loading}
            >
              Forgot your password?
            </Button>
          </Box>

          <Box textAlign="center" mt={1}>
            <Typography variant="body2">
              Don't have an account?{' '}
              <Button
                  variant="text"
                  onClick={() => onNavigate('signup')}
                  disabled={loading}
              >
                Sign Up
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
  );
};

export default Login;
