import { useAuthStore } from '../stores';

export function useAuth() {
    const {
        user,
        userProfile,
        organization,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        processLicenseKey,
        initializeAuth
    } = useAuthStore();

    return {
        user,
        userProfile,
        organization,
        loading: isLoading, // maintain backward compatibility with loading vs isLoading
        error,
        login: signIn, // maintain backward compatibility with login vs signIn
        signUp,
        logout: signOut, // maintain backward compatibility with logout vs signOut
        resetPassword,
        processLicenseKey,
        initializeAuth
    };
}