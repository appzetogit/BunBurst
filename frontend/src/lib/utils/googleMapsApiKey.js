/**
 * Google Maps API Key Utility
 * Fetches API key dynamically in order of priority:
 *  1. window.__PUBLIC_ENV__ (loaded from Admin → System → ENV at app startup)
 *  2. import.meta.env.VITE_GOOGLE_MAPS_API_KEY (.env file)
 *  3. Backend API call (adminAPI.getPublicEnvVariables)
 */

let cachedApiKey = null;
let apiKeyPromise = null;

/**
 * Get Google Maps API Key
 * Checks runtime env (admin panel), then .env file, then backend API.
 * @returns {Promise<string>} Google Maps API Key or empty string
 */
export async function getGoogleMapsApiKey() {
  // Return cached key if already resolved
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // --- Priority 1: Runtime env from admin panel (window.__PUBLIC_ENV__) ---
  const runtimeEnv = typeof window !== 'undefined' ? (window.__PUBLIC_ENV__ || {}) : {};
  if (runtimeEnv.VITE_GOOGLE_MAPS_API_KEY && runtimeEnv.VITE_GOOGLE_MAPS_API_KEY.trim()) {
    cachedApiKey = runtimeEnv.VITE_GOOGLE_MAPS_API_KEY.trim();
    console.log('✅ Google Maps API key loaded from Admin System ENV (runtime)');
    return cachedApiKey;
  }

  // --- Priority 2: .env file (build-time) ---
  const envFileKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envFileKey && envFileKey.trim()) {
    cachedApiKey = envFileKey.trim();
    console.log('✅ Google Maps API key loaded from .env file');
    return cachedApiKey;
  }

  // --- Priority 3: Backend API call (avoid duplicate concurrent requests) ---
  if (apiKeyPromise) {
    return apiKeyPromise;
  }

  apiKeyPromise = (async () => {
    try {
      const { adminAPI } = await import('../api/index.js');
      const response = await adminAPI.getPublicEnvVariables();

      if (response.data.success && response.data.data?.VITE_GOOGLE_MAPS_API_KEY) {
        cachedApiKey = response.data.data.VITE_GOOGLE_MAPS_API_KEY;
        // Also store in window.__PUBLIC_ENV__ for next time
        if (typeof window !== 'undefined') {
          window.__PUBLIC_ENV__ = { ...(window.__PUBLIC_ENV__ || {}), VITE_GOOGLE_MAPS_API_KEY: cachedApiKey };
        }
        console.log('✅ Google Maps API key loaded from backend database');
        return cachedApiKey;
      }

      console.warn('⚠️ Google Maps API key not found in database. Please set it in Admin → System → Environment Variables');
      return '';
    } catch (error) {
      console.warn('Failed to fetch Google Maps API key from backend:', error.message);
      return '';
    } finally {
      apiKeyPromise = null;
    }
  })();

  return apiKeyPromise;
}

/**
 * Clear cached API key (call after updating in admin panel)
 */
export function clearGoogleMapsApiKeyCache() {
  cachedApiKey = null;
  apiKeyPromise = null;
}

/**
 * MAP_APIS_ENABLED — now always true since key fetching is dynamic.
 * Kept for backward compatibility with any existing imports.
 */
export const MAP_APIS_ENABLED = true;
