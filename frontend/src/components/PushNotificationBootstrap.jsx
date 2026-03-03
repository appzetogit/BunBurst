import { useEffect } from "react";
import { bootstrapFirebaseMessaging } from "@/lib/firebaseMessaging";

export default function PushNotificationBootstrap() {
  useEffect(() => {
    bootstrapFirebaseMessaging().catch((error) => {
      console.error("[FCM] Bootstrap failed unexpectedly.", error);
    });
  }, []);

  return null;
}
