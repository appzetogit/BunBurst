import {
  firebaseApp,
  getFirebaseVapidKey,
  isUsingFallbackFirebaseConfig,
  isFirebaseConfigAvailable,
  ensureFirebaseInitialized,
} from "./firebase";
import { userAPI, deliveryAPI } from "./api";

const LOG_PREFIX = "[FCM]";
let bootstrapStarted = false;
let foregroundUnsubscribe = null;
let syncIntervalId = null;
let currentFcmToken = "";
let currentServiceWorkerRegistration = null;

const TOKEN_SYNC_STATE_KEY = "fcm_token_sync_state_v1";

function logInfo(message, data) {
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} ${message}`, data);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`);
}

function logWarn(message, data) {
  if (data !== undefined) {
    console.warn(`${LOG_PREFIX} ${message}`, data);
    return;
  }
  console.warn(`${LOG_PREFIX} ${message}`);
}

function logError(message, data) {
  if (data !== undefined) {
    console.error(`${LOG_PREFIX} ${message}`, data);
    return;
  }
  console.error(`${LOG_PREFIX} ${message}`);
}

function getCurrentAuthContext() {
  const path = window.location.pathname || "/";
  const hasUserToken = Boolean(localStorage.getItem("user_accessToken"));
  const hasDeliveryToken = Boolean(localStorage.getItem("delivery_accessToken"));

  if (path.startsWith("/delivery") && hasDeliveryToken) {
    return { audience: "delivery", platform: "web" };
  }

  if (hasUserToken) {
    return { audience: "user", platform: "web" };
  }

  return null;
}

function readSyncState() {
  try {
    const raw = localStorage.getItem(TOKEN_SYNC_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSyncState(state) {
  try {
    localStorage.setItem(TOKEN_SYNC_STATE_KEY, JSON.stringify(state || {}));
  } catch {
    // Ignore storage errors silently.
  }
}

function isTokenAlreadySynced(audience, token) {
  const state = readSyncState();
  return state?.[audience] === token;
}

function markTokenSynced(audience, token) {
  const state = readSyncState();
  state[audience] = token;
  writeSyncState(state);
}

async function getMessagingIfSupported() {
  if (typeof window === "undefined") {
    logWarn("Window is not available. Skipping FCM bootstrap.");
    return null;
  }
  ensureFirebaseInitialized();
  if (!isFirebaseConfigAvailable || !firebaseApp) {
    logWarn("Firebase config not available yet. Skipping FCM bootstrap.");
    return null;
  }

  try {
    const messagingModule = await import("firebase/messaging");
    const supported = await messagingModule.isSupported();
    if (!supported) {
      logWarn("Firebase Messaging is not supported in this browser.");
      return null;
    }
    logInfo("Firebase Messaging is supported.");
    return messagingModule.getMessaging(firebaseApp);
  } catch (error) {
    logError("Failed checking Firebase Messaging support.", error);
    return null;
  }
}

async function registerMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    logWarn("Service Worker is not supported in this browser.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    await navigator.serviceWorker.ready;
    logInfo("Service Worker registered and ready.", {
      scope: registration.scope,
    });
    currentServiceWorkerRegistration = registration;
    return registration;
  } catch (error) {
    logError("Service Worker registration failed.", error);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    logWarn("Notification API not available in this browser.");
    return "unsupported";
  }

  try {
    logInfo("Current notification permission state.", {
      permission: Notification.permission,
    });

    if (Notification.permission === "granted") {
      return "granted";
    }

    const permission = await Notification.requestPermission();
    logInfo("Notification permission request completed.", { permission });
    return permission;
  } catch (error) {
    logError("Notification permission request failed.", error);
    return "error";
  }
}

async function generateFcmToken(messaging, serviceWorkerRegistration) {
  const firebaseVapidKey = getFirebaseVapidKey();
  if (!firebaseVapidKey || !firebaseVapidKey.trim()) {
    logWarn(
      "VAPID key is missing. Set VITE_FIREBASE_VAPID_KEY in frontend env.",
    );
    return "";
  }

  try {
    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey.trim(),
      serviceWorkerRegistration,
    });

    if (!token) {
      logWarn("getToken returned empty token. Permission may not be granted.");
      return "";
    }

    logInfo("FCM token generated successfully.");
    console.log(`${LOG_PREFIX} FCM TOKEN: ${token}`);
    return token;
  } catch (error) {
    const code = error?.code || "";
    const message = error?.message || "";
    logError("FCM token generation failed.", error);

    if (
      code.includes("messaging/token-subscribe-failed") ||
      message.includes("fcmregistrations.googleapis.com") ||
      message.includes("missing required authentication credential")
    ) {
      console.error(
        `${LOG_PREFIX} FCM 401 means Firebase web config is invalid/mismatched for this VAPID key.`,
      );
      console.error(
        `${LOG_PREFIX} Fix: use the SAME Firebase project for VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_MESSAGING_SENDER_ID, and VITE_FIREBASE_VAPID_KEY.`,
      );
      console.error(`${LOG_PREFIX} Current runtime projectId:`, firebaseApp?.options?.projectId);
      console.error(`${LOG_PREFIX} Using fallback config:`, isUsingFallbackFirebaseConfig);
    }
    return "";
  }
}

async function syncTokenToBackend() {
  if (!currentFcmToken) {
    logWarn("No FCM token available yet, skipping backend sync.");
    return;
  }

  const context = getCurrentAuthContext();
  if (!context) {
    logInfo("No authenticated user/delivery context found. Sync postponed.");
    return;
  }

  if (isTokenAlreadySynced(context.audience, currentFcmToken)) {
    logInfo(`Token already synced for ${context.audience}.`);
    return;
  }

  try {
    logInfo(`Syncing token to backend for ${context.audience}...`);
    if (context.audience === "delivery") {
      await deliveryAPI.saveFcmToken(currentFcmToken, context.platform);
    } else {
      await userAPI.saveFcmToken(currentFcmToken, context.platform);
    }
    markTokenSynced(context.audience, currentFcmToken);
    logInfo(`Token synced to backend for ${context.audience} successfully.`);
  } catch (error) {
    logError(
      `Failed syncing token to backend for ${context.audience}.`,
      error?.response?.data || error,
    );
  }
}

async function setupForegroundNotificationHandler(messaging) {
  try {
    const { onMessage } = await import("firebase/messaging");

    if (foregroundUnsubscribe) {
      foregroundUnsubscribe();
      foregroundUnsubscribe = null;
    }

    foregroundUnsubscribe = onMessage(messaging, (payload) => {
      logInfo("Foreground message received.", payload);
      const title = payload?.notification?.title || "New Notification";
      const body = payload?.notification?.body || "";
      const icon = payload?.notification?.icon || "/bunburst-icon.png";

      if (Notification.permission === "granted") {
        try {
          const browserNotification = new Notification(title, {
            body,
            icon,
            data: payload?.data || {},
          });
          browserNotification.onclick = () => {
            const link =
              payload?.data?.link ||
              payload?.fcmOptions?.link ||
              window.location.origin;
            window.open(link, "_self");
          };
          logInfo("Foreground browser notification displayed.");
        } catch (error) {
          logError("Failed showing foreground browser notification.", error);
        }
      } else {
        logWarn("Foreground message received but Notification permission is not granted.");
      }
    });

    logInfo("Foreground onMessage listener attached.");
  } catch (error) {
    logError("Failed attaching foreground onMessage listener.", error);
  }
}

function startTokenSyncWatcher() {
  if (syncIntervalId) return;
  syncIntervalId = window.setInterval(() => {
    syncTokenToBackend().catch(() => {
      // syncTokenToBackend already logs error details.
    });
  }, 10000);
  logInfo("Token sync watcher started (10s interval).");
}

export async function bootstrapFirebaseMessaging() {
  if (bootstrapStarted) {
    logInfo("FCM bootstrap already started. Skipping duplicate init.");
    return;
  }
  bootstrapStarted = true;
  logInfo("Starting Firebase Messaging bootstrap...");
  logInfo("Firebase app config snapshot.", {
    projectId: firebaseApp?.options?.projectId || "unknown",
    messagingSenderId: firebaseApp?.options?.messagingSenderId || "unknown",
    vapidKeyConfigured: Boolean(getFirebaseVapidKey()?.trim()),
    firebaseConfigAvailable: Boolean(isFirebaseConfigAvailable),
  });

  const messaging = await getMessagingIfSupported();
  if (!messaging) return;

  const swRegistration = await registerMessagingServiceWorker();
  if (!swRegistration) return;

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    logWarn("Notification permission not granted. Push notifications disabled.");
    return;
  }

  currentFcmToken = await generateFcmToken(messaging, swRegistration);
  if (!currentFcmToken) return;

  await syncTokenToBackend();
  await setupForegroundNotificationHandler(messaging);
  startTokenSyncWatcher();
}

export function getCurrentFcmDebugState() {
  const vapidKey = getFirebaseVapidKey();
  return {
    hasToken: Boolean(currentFcmToken),
    tokenPreview: currentFcmToken ? `${currentFcmToken.slice(0, 16)}...` : "",
    hasServiceWorkerRegistration: Boolean(currentServiceWorkerRegistration),
    hasForegroundListener: Boolean(foregroundUnsubscribe),
    vapidKeyConfigured: Boolean(vapidKey && vapidKey.trim()),
  };
}
