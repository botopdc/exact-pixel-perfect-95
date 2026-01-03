// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

const AUTH_TOKEN_KEY = 'open_calculator_auth_token';

/**
 * Get the auth token from localStorage
 */
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Set the auth token in localStorage
 */
export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('[Auth] Error saving token:', error);
  }
};

/**
 * Remove the auth token from localStorage
 */
export const removeAuthToken = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('[Auth] Error removing token:', error);
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

/**
 * Handle auth_token from URL query parameter
 * If present, saves to localStorage and removes from URL
 */
export const handleAuthTokenFromURL = (): boolean => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');

    if (authToken) {
      setAuthToken(authToken);
      
      // Remove auth_token from URL without reload
      urlParams.delete('auth_token');
      const newSearch = urlParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
      console.log('[Auth] Token saved from URL');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Auth] Error handling URL token:', error);
    return false;
  }
};
