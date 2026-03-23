/**
 * Google Maps API Key Utility
 * Fetches API key dynamically in order of priority:
 *  1. window.__PUBLIC_ENV__ (loaded from Admin → System → ENV at app startup)
 *  2. import.meta.env.VITE_GOOGLE_MAPS_API_KEY (.env file)
 *  3. Backend API call (adminAPI.getPublicEnvVariables)
 */

let cachedApiKey = null;
let apiKeyPromise = null;
let warnedDisabled = false;

function isGoogleMapsAllowedRoute() {
  return true;
}

function readRuntimeEnv(key) {
  if (typeof window === "undefined") return undefined;
  return window.__PUBLIC_ENV__?.[key];
}

function parseBooleanFlag(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return fallback;
}

export function isMapApisEnabled() {
  const runtimeFlag = readRuntimeEnv("VITE_MAP_APIS_ENABLED");
  const envFlag = import.meta.env.VITE_MAP_APIS_ENABLED;
  const disabledByWindow = typeof window !== "undefined" && window.__mapApisDisabled === true;
  const enabled = parseBooleanFlag(runtimeFlag ?? envFlag, true);
  return enabled && !disabledByWindow;
}

export function isGooglePlacesEnabled() {
  const runtimeFlag = readRuntimeEnv("VITE_GOOGLE_PLACES_ENABLED");
  const envFlag = import.meta.env.VITE_GOOGLE_PLACES_ENABLED;
  return parseBooleanFlag(runtimeFlag ?? envFlag, false);
}

export function isGoogleGeocodingEnabled() {
  const runtimeFlag = readRuntimeEnv("VITE_GOOGLE_GEOCODING_ENABLED");
  const envFlag = import.meta.env.VITE_GOOGLE_GEOCODING_ENABLED;
  return parseBooleanFlag(runtimeFlag ?? envFlag, false);
}

/**
 * Get Google Maps API Key
 * Checks runtime env (admin panel), then .env file, then backend API.
 * @returns {Promise<string>} Google Maps API Key or empty string
 */
export async function getGoogleMapsApiKey() {
  if (!isMapApisEnabled() || !isGoogleMapsAllowedRoute()) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn('Google Maps APIs are disabled. Skipping API key retrieval.');
    }
    return '';
  }
  // Return cached key if already resolved
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // --- Priority 1: Runtime env from admin panel (window.__PUBLIC_ENV__) ---
  const runtimeEnv = typeof window !== 'undefined' ? (window.__PUBLIC_ENV__ || {}) : {};
  if (runtimeEnv.VITE_GOOGLE_MAPS_API_KEY && runtimeEnv.VITE_GOOGLE_MAPS_API_KEY.trim()) {
    cachedApiKey = runtimeEnv.VITE_GOOGLE_MAPS_API_KEY.trim();
    
    return cachedApiKey;
  }

  // --- Priority 2: .env file (build-time) ---
  const envFileKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envFileKey && envFileKey.trim()) {
    cachedApiKey = envFileKey.trim();
    
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
 * MAP_APIS_ENABLED — only allow Google Maps where runtime explicitly needs it.
 * Kept for backward compatibility with any existing imports.
 */
export const MAP_APIS_ENABLED = isMapApisEnabled();
export const GOOGLE_PLACES_ENABLED = isGooglePlacesEnabled();
export const GOOGLE_GEOCODING_ENABLED = isGoogleGeocodingEnabled();
