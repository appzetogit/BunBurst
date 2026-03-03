/* eslint-disable no-undef */

// Lightweight SW for FCM web push.
// No external importScripts to avoid evaluation failures on blocked networks.
self.addEventListener("install", () => {
  self.skipWaiting();
  console.log("[FCM-SW] Installed");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[FCM-SW] Activated");
});

self.addEventListener("push", (event) => {
  try {
    const payload = event.data ? event.data.json() : {};
    const notification = payload?.notification || {};
    const data = payload?.data || {};

    const title = notification.title || "New Notification";
    const options = {
      body: notification.body || "",
      icon: notification.icon || "/bunburst-icon.png",
      data,
    };

    event.waitUntil(self.registration.showNotification(title, options));
    console.log("[FCM-SW] Push notification shown", payload);
  } catch (error) {
    console.error("[FCM-SW] Failed handling push event.", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(link);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
      return null;
    }),
  );
});
