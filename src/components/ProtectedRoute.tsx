import React, { useEffect, useState } from 'react';
import { isAuthenticated, handleAuthTokenFromURL } from '@/lib/auth';
import NaoAutenticado from '@/pages/NaoAutenticado';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Component that protects routes requiring authentication.
 * Checks for auth_token in URL or localStorage.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // First try to get token from URL
    handleAuthTokenFromURL();
    // Then check if authenticated
    setIsAuthed(isAuthenticated());
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return null; // or a loading spinner
  }

  if (!isAuthed) {
    return <NaoAutenticado />;
  }

  return <>{children}</>;
};
