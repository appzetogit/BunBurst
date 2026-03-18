import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { userAPI } from "@/lib/api"
import { writeUserLocation } from "@/lib/firebaseRealtime"
import { reverseGeocodeWithCache } from "@/lib/utils/reverseGeocodeCache"

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    const stored = localStorage.getItem("userLocation") || localStorage.getItem("guestLocation")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && (parsed.latitude || parsed.lat)) {
          return parsed
        }
      } catch (e) {
        console.error("Error parsing stored location:", e)
      }
    }
    return null
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(() => {
    return !!localStorage.getItem("userLocation")
  })

  const watchIdRef = useRef(null)
  const updateTimerRef = useRef(null)
  const prevLocationCoordsRef = useRef({ latitude: null, longitude: null })

  // Sync state with localStorage
  useEffect(() => {
    if (location) {
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      const storageKey = (userToken && userToken !== 'null' && userToken !== 'undefined') ? "userLocation" : "guestLocation"
      localStorage.setItem(storageKey, JSON.stringify(location))
    }
  }, [location])

  /* ===================== DB UPDATE ===================== */
  const updateLocationInDB = useCallback(async (locationData) => {
    if (!locationData) return

    try {
      const hasPlaceholder =
        locationData?.city === "Current Location" ||
        locationData?.address === "Select location" ||
        locationData?.formattedAddress === "Select location" ||
        (!locationData?.city && !locationData?.address && !locationData?.formattedAddress && !locationData?.area);

      if (hasPlaceholder) return;

      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') return

      const userId = (() => {
        try {
          const raw = localStorage.getItem('user_user') || localStorage.getItem('user')
          if (!raw) return null
          const parsed = JSON.parse(raw)
          return parsed?._id || parsed?.id || null
        } catch {
          return null
        }
      })()

      const locationPayload = {
        latitude: locationData.latitude || locationData.lat,
        longitude: locationData.longitude || locationData.lng,
        address: locationData.address || locationData.formattedAddress || "",
        city: locationData.city || "",
        state: locationData.state || "",
        area: locationData.area || "",
        formattedAddress: locationData.formattedAddress || locationData.address || "",
        accuracy: locationData.accuracy ?? null,
        postalCode: locationData.postalCode || locationData.zipCode || "",
        street: locationData.street || "",
        streetNumber: locationData.streetNumber || "",
      }

      await userAPI.updateLocation(locationPayload)

      const lat = Number(locationPayload.latitude)
      const lng = Number(locationPayload.longitude)
      if (userId && Number.isFinite(lat) && Number.isFinite(lng)) {
        writeUserLocation({
          userId,
          lat,
          lng,
          address: locationPayload.address,
          formattedAddress: locationPayload.formattedAddress,
          area: locationPayload.area,
          city: locationPayload.city,
          state: locationPayload.state,
          source: locationData.source || "address",
        })
      }
    } catch (err) {
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("❌ DB location update error:", err)
      }
    }
  }, [])

  /* ===================== LOCATION FETCHING ===================== */
  const getLocation = useCallback(async (forceFresh = false, updateDB = true) => {
    try {
      setLoading(true)

      // Get coordinates from browser
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation not supported"))
          return
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: forceFresh ? 0 : 3600000
        })
      })

      const { latitude, longitude, accuracy } = position.coords

      let resolvedAddress = ""
      let resolvedCity = ""
      let resolvedState = ""
      let resolvedArea = ""
      let resolvedStreet = ""
      let resolvedPostalCode = ""

      try {
        const response = await reverseGeocodeWithCache(latitude, longitude, { precision: 6 })
        const backendData = response?.data?.data
        const result = backendData?.results?.[0] || backendData?.result?.[0] || null
        const addressComponents = result?.address_components || {}

        resolvedAddress = result?.formatted_address || result?.formattedAddress || ""
        resolvedCity = addressComponents.city || ""
        resolvedState = addressComponents.state || ""
        resolvedArea = addressComponents.area || ""

        if (resolvedAddress && resolvedAddress.endsWith(", India")) {
          resolvedAddress = resolvedAddress.replace(", India", "").trim()
        }

        if (!resolvedStreet && resolvedAddress) {
          const parts = resolvedAddress.split(",").map((part) => part.trim()).filter(Boolean)
          resolvedStreet = parts[0] || ""
          const maybePostal = parts.find((part) => /\b\d{6}\b/.test(part))
          resolvedPostalCode = maybePostal?.match(/\b\d{6}\b/)?.[0] || ""
        }
      } catch (reverseGeocodeError) {
        console.warn("Reverse geocoding failed for current location:", reverseGeocodeError?.message || reverseGeocodeError)
      }

      const fallbackFormattedAddress =
        resolvedAddress ||
        location?.formattedAddress ||
        location?.address ||
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`

      const newLocation = {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        city: resolvedCity || location?.city || "",
        state: resolvedState || location?.state || "",
        address: resolvedStreet || resolvedArea || location?.address || fallbackFormattedAddress,
        area: resolvedArea || location?.area || "",
        street: resolvedStreet || location?.street || "",
        postalCode: resolvedPostalCode || location?.postalCode || "",
        formattedAddress: fallbackFormattedAddress,
        source: "gps",
        timestamp: new Date().toISOString(),
      }

      setLocation(newLocation)
      setPermissionGranted(true)

      if (updateDB) {
        updateLocationInDB(newLocation)
      }

      return newLocation
    } catch (err) {
      console.error("Location error:", err)
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [location, updateLocationInDB])

  const setManualLocation = useCallback((locationData) => {
    if (!locationData) return
    setLocation(locationData)
    updateLocationInDB(locationData)
  }, [updateLocationInDB])

  // Initial DB update if we have a stored location
  useEffect(() => {
    if (location) {
      updateLocationInDB(location)
    }
  }, [updateLocationInDB])

  const value = {
    location,
    loading,
    error,
    permissionGranted,
    getLocation,
    setManualLocation,
    updateLocationInDB
  }

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}


export function useLocationContext() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error("useLocationContext must be used within LocationProvider")
  }
  return context
}
