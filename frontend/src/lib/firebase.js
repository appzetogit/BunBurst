import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getPublicEnvValue } from './utils/publicEnv.js';

const envFromRuntimeOrBuild = (key, fallback = '') =>
  getPublicEnvValue(key, import.meta.env[key] || fallback);

// Validate Firebase configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId'];
let lastMissingFieldsLogKey = '';
export let isFirebaseConfigAvailable = false;
export let isUsingFallbackFirebaseConfig = false;

function getFirebaseConfig() {
  return {
    apiKey: envFromRuntimeOrBuild('VITE_FIREBASE_API_KEY'),
    authDomain: envFromRuntimeOrBuild('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: envFromRuntimeOrBuild('VITE_FIREBASE_PROJECT_ID'),
    appId: envFromRuntimeOrBuild('VITE_FIREBASE_APP_ID'),
    messagingSenderId: envFromRuntimeOrBuild('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: envFromRuntimeOrBuild('VITE_FIREBASE_STORAGE_BUCKET'),
    measurementId: envFromRuntimeOrBuild('VITE_FIREBASE_MEASUREMENT_ID')
  };
}

export function getFirebaseVapidKey() {
  return envFromRuntimeOrBuild('VITE_FIREBASE_VAPID_KEY');
}

function resolveFirebaseConfigStatus() {
  const firebaseConfig = getFirebaseConfig();
  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field] || firebaseConfig[field] === 'undefined'
  );

  const hasRuntimeFirebaseConfig =
    Boolean(getPublicEnvValue('VITE_FIREBASE_API_KEY')) &&
    Boolean(getPublicEnvValue('VITE_FIREBASE_AUTH_DOMAIN')) &&
    Boolean(getPublicEnvValue('VITE_FIREBASE_PROJECT_ID')) &&
    Boolean(getPublicEnvValue('VITE_FIREBASE_APP_ID')) &&
    Boolean(getPublicEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'));

  const hasBuildFirebaseConfig =
    Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
    Boolean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
    Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
    Boolean(import.meta.env.VITE_FIREBASE_APP_ID) &&
    Boolean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);

  isUsingFallbackFirebaseConfig = !hasRuntimeFirebaseConfig && hasBuildFirebaseConfig;
  isFirebaseConfigAvailable = missingFields.length === 0;

  if (missingFields.length > 0) {
    const logKey = missingFields.join('|');
    if (logKey !== lastMissingFieldsLogKey) {
      lastMissingFieldsLogKey = logKey;
      console.error('Firebase configuration is missing required fields:', missingFields);
      console.error('Current config:', firebaseConfig);
      console.error('Environment variables:', {
        VITE_FIREBASE_API_KEY: envFromRuntimeOrBuild('VITE_FIREBASE_API_KEY'),
        VITE_FIREBASE_AUTH_DOMAIN: envFromRuntimeOrBuild('VITE_FIREBASE_AUTH_DOMAIN'),
        VITE_FIREBASE_PROJECT_ID: envFromRuntimeOrBuild('VITE_FIREBASE_PROJECT_ID'),
        VITE_FIREBASE_APP_ID: envFromRuntimeOrBuild('VITE_FIREBASE_APP_ID'),
        VITE_FIREBASE_MESSAGING_SENDER_ID: envFromRuntimeOrBuild('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      });
      console.warn(
        `Firebase disabled until config is provided. Missing fields: ${missingFields.join(', ')}. ` +
        `You can still open Admin panel and set values in System ENV.`
      );
    }
  }

  return { firebaseConfig, missingFields };
}

// Initialize Firebase app only once
let app;
let firebaseAuth;
let googleProvider;

// Function to ensure Firebase is initialized
function ensureFirebaseInitialized() {
  const { firebaseConfig } = resolveFirebaseConfigStatus();
  const hasCompleteFirebaseConfig = requiredFields.every(
    (field) => firebaseConfig[field] && firebaseConfig[field] !== 'undefined'
  );

  if (!hasCompleteFirebaseConfig) {
    return false;
  }
  try {
    const existingApps = getApps();
    if (existingApps.length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully with config:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 20) + '...' : 'missing',
        usingFallbackConfig: isUsingFallbackFirebaseConfig
      });
      if (isUsingFallbackFirebaseConfig) {
        console.warn(
          'Firebase is not using Admin System ENV values. Set Firebase keys in Admin > System > Environment Variables (or VITE_FIREBASE_* in frontend .env).'
        );
      }
    } else {
      app = existingApps[0];
      console.log('Firebase app already initialized, reusing existing instance');
    }

    // Initialize Auth - ensure it's connected to the app
    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
      if (!firebaseAuth) {
        throw new Error('Failed to get Firebase Auth instance');
      }
      console.log('Firebase Auth initialized successfully', {
        app: app.name,
        authApp: firebaseAuth.app.name
      });
    }

    // Initialize Google Provider
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      // Add scopes if needed
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      // Note: Don't set custom client_id - Firebase uses its own OAuth client
      console.log('Google Auth Provider initialized');
    }
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('Firebase config used:', getFirebaseConfig());
    return false;
  }
}

// Initialize immediately
ensureFirebaseInitialized();

export const firebaseApp = app;
export { firebaseAuth, googleProvider, ensureFirebaseInitialized };


