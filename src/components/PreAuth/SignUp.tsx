// SignUp.tsx
interface SignUpFormState extends FormState {
  password: string;
  licenseKey: string;
}

export const SignUp: React.FC<{ onNavigate: (view: 'login') => void }> = ({ onNavigate }) => {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [formState, setFormState] = useState<SignUpFormState>({
    email: '',
    password: '',
    licenseKey: '',
    message: null,
    error: null,
    isLoading: false,
  });

  // Memoized styles - reusing same styles as ResetPassword
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

    if (!formState.email || !formState.password || !formState.licenseKey) {
      setFormState(prev => ({
        ...prev,
        error: 'Email, password, and license key are required.',
      }));
      return;
    }

    setFormState(prev => ({
      ...prev,
      error: null,
      message: null,
      isLoading: true,
    }));

    try {
      await signUp(formState.email, formState.password, formState.licenseKey);
      setFormState(prev => ({
        ...prev,
        message: 'Sign-up successful! Please check your email to confirm your account before logging in.',
        isLoading: false,
      }));
    } catch (err) {
      console.error('Sign-up error:', err);
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
        isLoading: false,
      }));
    }
  }, [formState.email, formState.password, formState.licenseKey, signUp]);

  const handleInputChange = useCallback((field: keyof SignUpFormState) => (
      e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormState(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

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