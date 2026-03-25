import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { bootstrapFirebaseMessaging } from "@/lib/firebaseMessaging"

export default function PushNotificationBootstrap() {
  const location = useLocation()

  useEffect(() => {
    // Admin panel does not need browser push permission prompts/token sync.
    if (location.pathname.startsWith("/admin")) return

    bootstrapFirebaseMessaging().catch((error) => {
      console.error("[FCM] Bootstrap failed unexpectedly.", error)
    })
  }, [location.pathname])

  return null;
}
