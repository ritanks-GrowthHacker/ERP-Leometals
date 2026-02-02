/**
 * Get authentication token from localStorage
 * Works both during SSR hydration and client-side
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    console.log('getAuthToken: window is undefined (SSR)');
    return null;
  }

  try {
    const stored = localStorage.getItem('erp-auth-storage');
    console.log('getAuthToken: localStorage value:', stored);
    
    if (!stored) {
      console.log('getAuthToken: No stored value found');
      return null;
    }

    const parsed = JSON.parse(stored);
    console.log('getAuthToken: Parsed value:', parsed);
    
    const token = parsed.state?.token;
    console.log('getAuthToken: Extracted token:', token ? token.substring(0, 50) + '...' : 'NULL');
    
    return token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}
