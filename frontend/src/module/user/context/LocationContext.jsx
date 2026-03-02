import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { locationAPI, userAPI } from "@/lib/api"

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  const watchIdRef = useRef(null)
  const updateTimerRef = useRef(null)
  const prevLocationCoordsRef = useRef({ latitude: null, longitude: null })

  /* ===================== DB UPDATE ===================== */
  const updateLocationInDB = useCallback(async (locationData) => {
    try {
      const hasPlaceholder =
        locationData?.city === "Current Location" ||
        locationData?.address === "Select location" ||
        locationData?.formattedAddress === "Select location" ||
        (!locationData?.city && !locationData?.address && !locationData?.formattedAddress);

      if (hasPlaceholder) return;

      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') return

      const locationPayload = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address || "",
        city: locationData.city || "",
        state: locationData.state || "",
        area: locationData.area || "",
        formattedAddress: locationData.formattedAddress || locationData.address || "",
      }

      await userAPI.updateLocation(locationPayload)
      console.log("✅ Live location successfully stored in database")
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
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: forceFresh ? 0 : 3600000
        })
      })

      const { latitude, longitude } = position.coords

      // Reverse geocode
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      )
      const data = await res.json()

      const newLocation = {
        latitude,
        longitude,
        city: data.city || data.locality || "Unknown",
        state: data.principalSubdivision || "",
        address: data.locality || data.city || "",
        formattedAddress: `${data.locality || ""}, ${data.city || ""}, ${data.principalSubdivision || ""}`.replace(/^,\s*/, ""),
      }

      setLocation(newLocation)
      setPermissionGranted(true)
      localStorage.setItem("userLocation", JSON.stringify(newLocation))

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
  }, [updateLocationInDB])

  const setManualLocation = useCallback((locationData) => {
    setLocation(locationData)
    localStorage.setItem("userLocation", JSON.stringify(locationData))
    updateLocationInDB(locationData)
  }, [updateLocationInDB])

  /* ===================== INIT ===================== */
  useEffect(() => {
    const stored = localStorage.getItem("userLocation")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.latitude) {
          setLocation(parsed)
          setPermissionGranted(true)
          setLoading(false)
        }
      } catch (e) {
        console.error("Error parsing stored location:", e)
      }
    } else {
      setLoading(false)
    }
  }, [])

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
