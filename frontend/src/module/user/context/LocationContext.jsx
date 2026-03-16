import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { userAPI } from "@/lib/api"

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    const stored = localStorage.getItem("userLocation")
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
      localStorage.setItem("userLocation", JSON.stringify(location))
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
          source: "address",
        })
      }
    } catch (err) {
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("❌ DB location update error:", err)
      }
    }
  }, [])

  /* ===================== LOCATION FETCHING ===================== */
  const getLocation = useCallback(async (forceFresh = false) => {
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

      const { latitude, longitude } = position.coords

      const newLocation = {
        latitude,
        longitude,
        // No reverse geocoding on homepage flow.
        // Keep previously known labels if available, otherwise leave empty.
        city: location?.city || "",
        state: location?.state || "",
        address: location?.address || "",
        area: location?.area || "",
        formattedAddress: location?.formattedAddress || "",
      }

      setLocation(newLocation)
      setPermissionGranted(true)

      // Update DB in background
      updateLocationInDB(newLocation)

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
