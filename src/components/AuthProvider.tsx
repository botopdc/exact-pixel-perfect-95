import { useEffect } from 'react';
import { handleAuthTokenFromURL } from '@/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that handles auth token from URL on mount
 * Wrap your app with this to automatically capture auth_token query params
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  useEffect(() => {
    // Check for auth token in URL on mount
    handleAuthTokenFromURL();
  }, []);

  return <>{children}</>;
};
