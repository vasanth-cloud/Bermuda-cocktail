// Centralized Configuration for API & WebSocket Endpoints

const DEFAULT_PRODUCTION_BACKEND = 'https://bermuda-cocktail-backend.onrender.com';

/**
 * Returns the base API URL:
 * - Uses VITE_API_URL if configured in environment
 * - In local development (localhost / 127.0.0.1), returns empty string to use Vite dev proxy
 * - In production (elitedominators.com, onrender.com, etc.), returns the live Render backend URL
 */
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
  }

  return DEFAULT_PRODUCTION_BACKEND;
};

/**
 * Returns the WebSocket base URL:
 * - Converts http/https backend URL to ws/wss
 * - In local dev without backend URL, connects to current host ws
 */
export const getWsBaseUrl = () => {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    return apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  return `${protocol}//${host}`;
};

/**
 * Constructs a full API URL given a path like '/api/auth/login'
 */
export const getApiUrl = (endpoint) => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
};

/**
 * Helper to fetch with automatic backend URL resolution
 */
export const apiFetch = (endpoint, options) => {
  return fetch(getApiUrl(endpoint), options);
};

/**
 * Resolves static asset paths (like /uploads/image.jpg) to the backend server
 */
export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
