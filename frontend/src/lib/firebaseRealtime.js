import { getDatabase, ref, set, serverTimestamp, onValue } from "firebase/database"
import { ensureFirebaseInitialized, firebaseApp, isFirebaseRealtimeDatabaseConfigured } from "./firebase"

let warnedUnavailable = false

const canUseRealtimeDb = () => {
  if (typeof window === "undefined") return false
  if (!isFirebaseRealtimeDatabaseConfigured()) return false
  const initialized = ensureFirebaseInitialized()
  if (!initialized || !firebaseApp) return false
  try {
    getDatabase(firebaseApp)
    return true
  } catch {
    return false
  }
}

export const isRealtimeDatabaseAvailable = () => canUseRealtimeDb()

export const writeDeliveryLocation = async ({
  deliveryPartnerId,
  lat,
  lng,
  accuracy = null,
  heading = null,
  speed = null,
  isOnline = null,
  orderId = null,
  source = "gps",
}) => {
  if (!deliveryPartnerId) return
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

  if (!canUseRealtimeDb()) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn("Firebase Realtime Database is not available. Skipping live location writes.")
    }
    return
  }

  const db = getDatabase(firebaseApp)
  const locationRef = ref(db, `delivery_locations/${deliveryPartnerId}`)

  const payload = {
    lat,
    lng,
    accuracy,
    heading,
    speed,
    isOnline,
    orderId,
    source,
    updatedAt: serverTimestamp(),
  }

  try {
    await set(locationRef, payload)
  } catch (error) {
    console.warn("Failed to write delivery location to Firebase RTDB:", error?.message || error)
  }
}

export const writeUserLocation = async ({
  userId,
  lat,
  lng,
  address = "",
  formattedAddress = "",
  area = "",
  city = "",
  state = "",
  source = "address",
}) => {
  if (!userId) return
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

  if (!canUseRealtimeDb()) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn("Firebase Realtime Database is not available. Skipping user location writes.")
    }
    return
  }

  const db = getDatabase(firebaseApp)
  const locationRef = ref(db, `users/${userId}`)

  const payload = {
    lat,
    lng,
    address,
    formattedAddress,
    area,
    city,
    state,
    source,
    updatedAt: serverTimestamp(),
  }

  try {
    await set(locationRef, payload)
  } catch (error) {
    console.warn("Failed to write user location to Firebase RTDB:", error?.message || error)
  }
}

export const writeCafeLocation = async ({
  cafeId,
  lat,
  lng,
  address = "",
  formattedAddress = "",
  area = "",
  city = "",
  state = "",
  source = "address",
}) => {
  if (!cafeId) return
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

  if (!canUseRealtimeDb()) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn("Firebase Realtime Database is not available. Skipping cafe location writes.")
    }
    return
  }

  const db = getDatabase(firebaseApp)
  const locationRef = ref(db, `cafe_locations/${cafeId}`)

  const payload = {
    lat,
    lng,
    address,
    formattedAddress,
    area,
    city,
    state,
    source,
    updatedAt: serverTimestamp(),
  }

  try {
    await set(locationRef, payload)
  } catch (error) {
    console.warn("Failed to write cafe location to Firebase RTDB:", error?.message || error)
  }
}

export const subscribeActiveOrderRealtime = (orderId, onUpdate) => {
  if (!orderId || typeof onUpdate !== "function") {
    return () => {}
  }

  if (!canUseRealtimeDb()) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn("Firebase Realtime Database is not available. Skipping active order subscription.")
    }
    return () => {}
  }

  const db = getDatabase(firebaseApp)
  const activeOrderRef = ref(db, `active_orders/${orderId}`)
  const unsubscribe = onValue(
    activeOrderRef,
    (snapshot) => {
      onUpdate(snapshot.val() || null)
    },
    (error) => {
      console.warn("Failed to subscribe to active order in Firebase RTDB:", error?.message || error)
      onUpdate(null)
    }
  )

  return unsubscribe
}
