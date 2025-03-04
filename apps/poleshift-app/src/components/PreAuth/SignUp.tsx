import { ChangeEvent, FC, FormEvent, useState } from 'react';
import { supabaseConnector } from '@/lib/powersync/SupabaseConnector';
import type { PreAuthView } from 'src/types';

// shadcn/ui components
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, X } from 'lucide-react';

interface SignUpFormState {
  email: string;
  password: string;
  confirmPassword: string;
  licenseKey: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

type LicenseStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface SignUpProps {
  onNavigate: (
    view: PreAuthView,
    data?: { email?: string; message?: string }
  ) => void;
}

const SignUp: FC<SignUpProps> = ({ onNavigate }) => {
  const [formState, setFormState] = useState<SignUpFormState>({
    email: '',
    password: '',
    confirmPassword: '',
    licenseKey: '',
    message: null,
    error: null,
    isLoading: false,
  });

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('idle');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseOrg, setLicenseOrg] = useState<string | null>(null);

  // Add validation state
  const [validations, setValidations] = useState({
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Add validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    // Require at least 8 characters, one uppercase, one lowercase, and one number
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };

  const handleLicenseKeyChange = async (value: string) => {
    setFormState((prev) => ({ ...prev, licenseKey: value }));

    if (!value) {
      setLicenseStatus('idle');
      setLicenseError(null);
      setLicenseOrg(null);
      return;
    }

    try {
      setLicenseStatus('checking');
      setLicenseError(null);
      setLicenseOrg(null);

      const result = await supabaseConnector.validateLicenseKey(value);
      if (!result.valid) {
        setLicenseStatus('invalid');
        setLicenseError(result.errorMessage || 'Invalid license key.');
      } else {
        setLicenseStatus('valid');
        setLicenseOrg(result.organizationName ?? null);
      }
    } catch (err) {
      console.error(err);
      setLicenseStatus('invalid');
      setLicenseError(
        err instanceof Error ? err.message : 'Error validating license key'
      );
    }
  };

  const handleInputChange =
    (field: keyof SignUpFormState) =>
    async (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (field === 'licenseKey') {
        await handleLicenseKeyChange(value);
      } else {
        setFormState((prev) => ({ ...prev, [field]: value }));
        
        // Update validations
        if (field === 'email') {
          setValidations(prev => ({ ...prev, email: validateEmail(value) }));
        } else if (field === 'password') {
          const isValid = validatePassword(value);
          setValidations(prev => ({ 
            ...prev, 
            password: isValid,
            confirmPassword: isValid && value === formState.confirmPassword
          }));
        } else if (field === 'confirmPassword') {
          setValidations(prev => ({ 
            ...prev, 
            confirmPassword: value === formState.password && validatePassword(formState.password)
          }));
        }
      }
    };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState((prev) => ({
      ...prev,
      error: null,
      message: null,
    }));

    if (!formState.email || !formState.password) {
      setFormState((prev) => ({
        ...prev,
        error: 'Email and password are required.',
      }));
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      setFormState((prev) => ({
        ...prev,
        error: 'Passwords do not match.',
      }));
      return;
    }

    // If you want to enforce valid license:
    if (licenseStatus === 'invalid' || licenseStatus === 'checking') {
      setFormState((prev) => ({
        ...prev,
        error: 'Please enter a valid license key before signing up.',
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, isLoading: true }));
    try {
      // Sign up with Supabase and activate license in one step
      await supabaseConnector.signUp(
        formState.email, 
        formState.password, 
        formState.licenseKey
      );

      // If everything succeeded
      onNavigate('login', {
        email: formState.email,
        message:
          'Sign-up successful! Please check your email to confirm your account before logging in.',
      });
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
    <div className='flex min-h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
          </CardHeader>

          <CardContent>
            {formState.error && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{formState.error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor='email'>Email</Label>
              <div className="relative">
                <Input
                  id='email'
                  type='email'
                  value={formState.email}
                  onChange={handleInputChange('email')}
                  autoComplete='email'
                  disabled={formState.isLoading}
                  required
                  className={formState.email && (validations.email ? 'pr-8 border-green-500' : 'pr-8 border-red-500')}
                />
                {formState.email && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    {validations.email ? 
                      <Check className="h-4 w-4 text-green-500" /> :
                      <X className="h-4 w-4 text-red-500" />
                    }
                  </div>
                )}
              </div>
              {formState.email && !validations.email && (
                <p className="text-sm text-red-500 mt-1">Please enter a valid email address</p>
              )}
            </div>

            <div className='mt-3'>
              <Label htmlFor='password'>Password</Label>
              <div className="relative">
                <Input
                  id='password'
                  type='password'
                  value={formState.password}
                  onChange={handleInputChange('password')}
                  autoComplete='new-password'
                  disabled={formState.isLoading}
                  required
                  className={formState.password && (validations.password ? 'pr-8 border-green-500' : 'pr-8 border-red-500')}
                />
                {formState.password && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    {validations.password ? 
                      <Check className="h-4 w-4 text-green-500" /> :
                      <X className="h-4 w-4 text-red-500" />
                    }
                  </div>
                )}
              </div>
              {formState.password && !validations.password && (
                <p className="text-sm text-red-500 mt-1">
                  Password must be at least 8 characters and contain uppercase, lowercase, and numbers
                </p>
              )}
            </div>

            <div className='mt-3'>
              <Label htmlFor='confirmPassword'>Confirm Password</Label>
              <div className="relative">
                <Input
                  id='confirmPassword'
                  type='password'
                  value={formState.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  autoComplete='new-password'
                  disabled={formState.isLoading}
                  required
                  className={formState.confirmPassword && (validations.confirmPassword ? 'pr-8 border-green-500' : 'pr-8 border-red-500')}
                />
                {formState.confirmPassword && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    {validations.confirmPassword ? 
                      <Check className="h-4 w-4 text-green-500" /> :
                      <X className="h-4 w-4 text-red-500" />
                    }
                  </div>
                )}
              </div>
              {formState.confirmPassword && !validations.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">Passwords must match</p>
              )}
            </div>

            {/* License Key + Validation UI */}
            <div className='mt-3'>
              <Label htmlFor='licenseKey'>License Key</Label>
              <Input
                id='licenseKey'
                type='text'
                value={formState.licenseKey}
                onChange={handleInputChange('licenseKey')}
                disabled={formState.isLoading}
              />

              {licenseStatus !== 'idle' && (
                <div className='mt-2 flex items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger>
                      {licenseStatus === 'checking' && (
                        <Badge variant='secondary'>Checking...</Badge>
                      )}
                      {licenseStatus === 'valid' && (
                        <Badge variant='default'>Valid</Badge>
                      )}
                      {licenseStatus === 'invalid' && (
                        <Badge variant='destructive'>Invalid</Badge>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {licenseStatus === 'checking' && (
                        <span>We're validating your license key...</span>
                      )}
                      {licenseStatus === 'valid' && licenseOrg ? (
                        <span>License belongs to: {licenseOrg}</span>
                      ) : licenseStatus === 'valid' ? (
                        <span>License key is valid</span>
                      ) : licenseError ? (
                        <span>{licenseError}</span>
                      ) : (
                        <span>Unknown license status</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className='flex flex-col gap-2'>
            <Button type='submit' disabled={formState.isLoading}>
              {formState.isLoading && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {formState.isLoading ? 'Signing Up...' : 'Sign Up'}
            </Button>
            <div>
              Already have an account?{' '}
              <Button
                variant='link'
                onClick={() => onNavigate('login')}
                disabled={formState.isLoading}
              >
                Log In
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignUp;
