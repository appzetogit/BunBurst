import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Building2, Info, Tag, Upload, Calendar, FileText, MapPin, X, Image as ImageIcon, Clock, Loader2 } from "lucide-react"
import { Loader } from "@googlemaps/js-api-loader"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { adminAPI, uploadAPI } from "@/lib/api"
import { getGoogleMapsApiKey } from "@/lib/utils/googleMapsApiKey"
import { toast } from "sonner"

const cuisinesOptions = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Pizza",
  "Burgers",
  "Bakery",
  "Cafe",
]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function AddRestaurant() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [loadingZones, setLoadingZones] = useState(false)
  const [zones, setZones] = useState([])
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState("")
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const mapRef = useRef(null)
  const mainContentRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const zonePolygonRef = useRef(null)

  // Step 1: Basic Info
  const [step1, setStep1] = useState({
    restaurantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    location: {
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
      latitude: "",
      longitude: "",
      formattedAddress: "",
      zoneId: "",
    },
  })
  const step1Ref = useRef(step1)

  // Step 2: Images & Operational
  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "09:00",
    closingTime: "22:00",
    openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  })

  // Step 3: Documents
  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  // Step 4: Display Info
  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "25-30 mins",
    featuredDish: "",
    featuredPrice: "249",
    offer: "",
    diningSettings: {
      isEnabled: false,
      maxGuests: 6,
      diningType: "family-dining"
    }
  })

  // Authentication
  const [auth, setAuth] = useState({
    email: "",
    phone: "",
    password: "", // Added password field
    signupMethod: "email",
  })

  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - বাংলা(BN)" },
    { key: "ar", label: "Arabic - العربية (AR)" },
    { key: "es", label: "Spanish - español(ES)" },
  ]

  // Fetch restaurant data in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const fetchRestaurant = async () => {
        try {
          setLoadingConfig(true)
          const response = await adminAPI.getRestaurantById(id)
          if (response.data?.success) {
            const data = response.data.data.restaurant || response.data.data

            // Populate Step 1
            setStep1({
              restaurantName: data.name || "",
              ownerName: data.ownerName || "",
              ownerEmail: data.ownerEmail || "",
              ownerPhone: data.ownerPhone || "",
              primaryContactNumber: data.primaryContactNumber || "",
              location: {
                addressLine1:
                  data.location?.addressLine1 ||
                  data.onboarding?.step1?.location?.addressLine1 ||
                  data.location?.address ||
                  data.location?.formattedAddress ||
                  "",
                addressLine2:
                  data.location?.addressLine2 ||
                  data.onboarding?.step1?.location?.addressLine2 ||
                  "",
                area:
                  data.location?.area ||
                  data.onboarding?.step1?.location?.area ||
                  "",
                city:
                  data.location?.city ||
                  data.onboarding?.step1?.location?.city ||
                  "",
                state:
                  data.location?.state ||
                  data.onboarding?.step1?.location?.state ||
                  "",
                pincode:
                  data.location?.pincode ||
                  data.onboarding?.step1?.location?.pincode ||
                  data.location?.zipCode ||
                  data.location?.postalCode ||
                  "",
                landmark:
                  data.location?.landmark ||
                  data.onboarding?.step1?.location?.landmark ||
                  "",
                latitude:
                  data.location?.latitude ??
                  data.onboarding?.step1?.location?.latitude ??
                  "",
                longitude:
                  data.location?.longitude ??
                  data.onboarding?.step1?.location?.longitude ??
                  "",
                formattedAddress:
                  data.location?.formattedAddress ||
                  data.onboarding?.step1?.location?.formattedAddress ||
                  data.location?.address ||
                  "",
                zoneId:
                  data.location?.zoneId ||
                  data.onboarding?.step1?.location?.zoneId ||
                  "",
              },
            })

            // Populate Step 2
            setStep2({
              menuImages: (data.menuImages || data.onboarding?.step2?.menuImageUrls || []).slice(0, 1),
              profileImage: data.profileImage || data.onboarding?.step2?.profileImageUrl || null,
              cuisines: data.cuisines || data.onboarding?.step2?.cuisines || [],
              openingTime:
                data.deliveryTimings?.openingTime ||
                data.onboarding?.step2?.deliveryTimings?.openingTime ||
                "09:00",
              closingTime:
                data.deliveryTimings?.closingTime ||
                data.onboarding?.step2?.deliveryTimings?.closingTime ||
                "22:00",
              openDays: data.openDays || data.onboarding?.step2?.openDays || [],
            })

            // Populate Step 3
            setStep3({
              panNumber:
                data.documents?.panNumber ||
                data.panNumber ||
                data.onboarding?.step3?.pan?.panNumber ||
                "",
              nameOnPan:
                data.documents?.nameOnPan ||
                data.nameOnPan ||
                data.onboarding?.step3?.pan?.nameOnPan ||
                "",
              panImage:
                data.documents?.panImage ||
                data.panImage ||
                data.onboarding?.step3?.pan?.image ||
                null,
              gstRegistered:
                data.documents?.gstRegistered ??
                data.onboarding?.step3?.gst?.isRegistered ??
                !!data.gstNumber,
              gstNumber:
                data.documents?.gstNumber ||
                data.gstNumber ||
                data.onboarding?.step3?.gst?.gstNumber ||
                "",
              gstLegalName:
                data.documents?.gstLegalName ||
                data.gstLegalName ||
                data.onboarding?.step3?.gst?.legalName ||
                "",
              gstAddress:
                data.documents?.gstAddress ||
                data.gstAddress ||
                data.onboarding?.step3?.gst?.address ||
                "",
              gstImage:
                data.documents?.gstImage ||
                data.gstImage ||
                data.onboarding?.step3?.gst?.image ||
                null,
              fssaiNumber:
                data.documents?.fssaiNumber ||
                data.fssaiNumber ||
                data.onboarding?.step3?.fssai?.registrationNumber ||
                "",
              fssaiExpiry: data.documents?.fssaiExpiry
                ? new Date(data.documents.fssaiExpiry).toISOString().split('T')[0]
                : data.onboarding?.step3?.fssai?.expiryDate
                  ? new Date(data.onboarding.step3.fssai.expiryDate).toISOString().split('T')[0]
                  : "",
              fssaiImage:
                data.documents?.fssaiImage ||
                data.fssaiImage ||
                data.onboarding?.step3?.fssai?.image ||
                null,
              accountNumber:
                data.bankDetails?.accountNumber ||
                data.accountNumber ||
                data.onboarding?.step3?.bank?.accountNumber ||
                "",
              confirmAccountNumber:
                data.bankDetails?.accountNumber ||
                data.accountNumber ||
                data.onboarding?.step3?.bank?.accountNumber ||
                "",
              ifscCode:
                data.bankDetails?.ifscCode ||
                data.ifscCode ||
                data.onboarding?.step3?.bank?.ifscCode ||
                "",
              accountHolderName:
                data.bankDetails?.accountHolderName ||
                data.accountHolderName ||
                data.onboarding?.step3?.bank?.accountHolderName ||
                "",
              accountType:
                data.bankDetails?.accountType ||
                data.accountType ||
                data.onboarding?.step3?.bank?.accountType ||
                "",
            })

            // Populate Step 4
            setStep4({
              estimatedDeliveryTime:
                data.estimatedDeliveryTime ||
                data.onboarding?.step4?.estimatedDeliveryTime ||
                "25-30 mins",
              featuredDish: data.featuredDish || data.onboarding?.step4?.featuredDish || "",
              featuredPrice: data.featuredPrice || data.onboarding?.step4?.featuredPrice || "249",
              offer: data.offer || data.onboarding?.step4?.offer || "",
              diningSettings: data.diningSettings || {
                isEnabled: false,
                maxGuests: 6,
                diningType: "family-dining"
              }
            })

            // Populate Auth
            setAuth({
              email: data.email || "",
              phone: data.phone || "",
              password: "", // Security: don't show password
              signupMethod: data.signupMethod || "email",
            })
          }
        } catch (error) {
          console.error("Error fetching restaurant:", error)
          toast.error("Failed to fetch restaurant details")
        } finally {
          setLoadingConfig(false)
        }
      }
      fetchRestaurant()
    }
  }, [isEditMode, id])

  useEffect(() => {
    const fetchZones = async () => {
      try {
        setLoadingZones(true)
        const response = await adminAPI.getZones({ limit: 1000 })
        if (response.data?.success && response.data?.data?.zones) {
          setZones(response.data.data.zones)
        }
      } catch (error) {
        console.error("Error fetching zones:", error)
      } finally {
        setLoadingZones(false)
      }
    }
    fetchZones()
  }, [])

  useEffect(() => {
    const loadMapsApiKey = async () => {
      try {
        const key = await getGoogleMapsApiKey()
        setGoogleMapsApiKey(key || "")
      } catch (error) {
        console.error("Error loading Google Maps API key:", error)
      }
    }
    loadMapsApiKey()
  }, [])

  useEffect(() => {
    step1Ref.current = step1
  }, [step1])

  // Reset map instances when route context changes between add/edit (or different edit ids).
  // This prevents stale refs from blocking map initialization on client-side navigation.
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
    if (zonePolygonRef.current) {
      zonePolygonRef.current.setMap(null)
      zonePolygonRef.current = null
    }
    mapInstanceRef.current = null
    setMapError("")
    setMapLoading(true)
  }, [id, isEditMode])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0
    }
  }, [step, id])

  const getZonePath = (google, zone) => {
    if (!zone?.coordinates || zone.coordinates.length < 3) return []
    return zone.coordinates
      .map((coord) => {
        const rawLat = coord?.latitude ?? coord?.lat
        const rawLng = coord?.longitude ?? coord?.lng
        const lat = Number(rawLat)
        const lng = Number(rawLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return new google.maps.LatLng(lat, lng)
      })
      .filter(Boolean)
  }

  const isPointInsideZone = (lat, lng, zone) => {
    if (!zone?.coordinates || zone.coordinates.length < 3) return false
    let inside = false
    for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
      const p1 = zone.coordinates[i]
      const p2 = zone.coordinates[j]
      const x1 = Number(p1?.latitude ?? p1?.lat)
      const y1 = Number(p1?.longitude ?? p1?.lng)
      const x2 = Number(p2?.latitude ?? p2?.lat)
      const y2 = Number(p2?.longitude ?? p2?.lng)
      if (![x1, y1, x2, y2].every((v) => Number.isFinite(v))) continue
      const intersect = ((y1 > lng) !== (y2 > lng)) && (lat < ((x2 - x1) * (lng - y1)) / (y2 - y1) + x1)
      if (intersect) inside = !inside
    }
    return inside
  }

  useEffect(() => {
    if (!zones.length) return
    if (step1.location?.zoneId) return
    const latNum = Number(step1.location?.latitude)
    const lngNum = Number(step1.location?.longitude)
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return

    const detectedZone = zones.find((zone) => isPointInsideZone(latNum, lngNum, zone))
    if (!detectedZone) return

    setStep1((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        zoneId: String(detectedZone._id || detectedZone.id || ""),
      },
    }))
  }, [zones, step1.location?.zoneId, step1.location?.latitude, step1.location?.longitude])

  const setMarker = (google, map, lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const position = new google.maps.LatLng(lat, lng)
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        draggable: true,
        title: "Restaurant location",
      })

      markerRef.current.addListener("dragend", (event) => {
        const nextLat = event.latLng.lat()
        const nextLng = event.latLng.lng()
        setStep1((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            latitude: Number(nextLat.toFixed(6)),
            longitude: Number(nextLng.toFixed(6)),
          },
        }))
      })
      return
    }
    markerRef.current.setPosition(position)
    markerRef.current.setMap(map)
  }

  useEffect(() => {
    if (loadingConfig) return
    if (step !== 1) return
    if (!mapRef.current || mapInstanceRef.current) return

    let cancelled = false

    const mountMap = (google) => {
      if (cancelled || !mapRef.current) return
      const defaultLat = Number(step1Ref.current?.location?.latitude) || 22.7196
      const defaultLng = Number(step1Ref.current?.location?.longitude) || 75.8577

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      })

      mapInstanceRef.current = map
      setMarker(google, map, defaultLat, defaultLng)
      // Fix intermittent blank tiles when map is mounted during layout transitions.
      setTimeout(() => {
        if (cancelled || !mapInstanceRef.current) return
        google.maps.event.trigger(map, "resize")
        map.setCenter({ lat: defaultLat, lng: defaultLng })
      }, 120)

      map.addListener("click", (event) => {
        if (!event.latLng) return
        const clickPoint = event.latLng
        if (
          step1Ref.current?.location?.zoneId &&
          zonePolygonRef.current &&
          google.maps.geometry?.poly?.containsLocation &&
          !google.maps.geometry.poly.containsLocation(clickPoint, zonePolygonRef.current)
        ) {
          toast.error("Please pinpoint inside the selected zone.")
          return
        }

        const nextLat = clickPoint.lat()
        const nextLng = clickPoint.lng()
        setStep1((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            latitude: Number(nextLat.toFixed(6)),
            longitude: Number(nextLng.toFixed(6)),
          },
        }))
      })
    }

    const waitForGoogleMaps = async (timeoutMs = 6000) => {
      const started = Date.now()
      while (Date.now() - started < timeoutMs) {
        if (window.google?.maps) return window.google
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      return null
    }

    const initializeMap = async () => {
      try {
        setMapLoading(true)
        setMapError("")

        const googleFromGlobal = await waitForGoogleMaps(7000)
        if (googleFromGlobal) {
          mountMap(googleFromGlobal)
          return
        }

        if (!googleMapsApiKey) {
          setMapError("Google Maps API key is missing.")
          return
        }

        const loader = new Loader({
          apiKey: googleMapsApiKey,
          version: "weekly",
          libraries: ["geometry", "marker"],
        })
        const google = await loader.load()
        mountMap(google)
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError(error?.message || "Failed to load Google Map.")
      } finally {
        if (!cancelled) setMapLoading(false)
      }
    }

    initializeMap()

    return () => {
      cancelled = true
    }
  }, [googleMapsApiKey, step, loadingConfig])

  useEffect(() => {
    if (step !== 1) return
    if (!mapInstanceRef.current || !window.google?.maps) return

    const google = window.google
    const map = mapInstanceRef.current
    const latNum = Number(step1.location?.latitude)
    const lngNum = Number(step1.location?.longitude)
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      setMarker(google, map, latNum, lngNum)
    }

    if (zonePolygonRef.current) {
      zonePolygonRef.current.setMap(null)
      zonePolygonRef.current = null
    }

    const selectedZone = zones.find((z) => String(z._id || z.id) === String(step1.location?.zoneId || ""))
    if (!selectedZone) return

    const path = getZonePath(google, selectedZone)
    if (path.length < 3) return

    zonePolygonRef.current = new google.maps.Polygon({
      paths: path,
      strokeColor: "#2563eb",
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.12,
      clickable: false,
    })
    zonePolygonRef.current.setMap(map)

    const bounds = new google.maps.LatLngBounds()
    path.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, 40)
  }, [step, zones, step1.location?.zoneId, step1.location?.latitude, step1.location?.longitude])

  if (loadingConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-2 text-sm text-slate-500">Loading restaurant details...</p>
        </div>
      </div>
    )
  }

  // Upload handler for images
  const handleUpload = async (file, folder) => {
    try {
      const res = await uploadAPI.uploadMedia(file, { folder })
      const d = res?.data?.data || res?.data
      return { url: d.url, publicId: d.publicId }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      console.error("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  // Validation functions
  const validateStep1 = () => {
    const errors = []
    if (!step1.restaurantName?.trim()) errors.push("Restaurant name is required")
    if (!step1.ownerName?.trim()) errors.push("Owner name is required")
    if (!step1.ownerEmail?.trim()) errors.push("Owner email is required")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.ownerEmail)) errors.push("Please enter a valid email address")
    if (!step1.ownerPhone?.trim()) errors.push("Owner phone number is required")
    if (!step1.primaryContactNumber?.trim()) errors.push("Primary contact number is required")
    if (!step1.location?.area?.trim()) errors.push("Area/Sector/Locality is required")
    if (!step1.location?.city?.trim()) errors.push("City is required")
    return errors
  }

  const validateStep2 = () => {
    const errors = []
    if (!step2.menuImages || step2.menuImages.length === 0) errors.push("At least one menu image is required")
    if (!step2.profileImage) errors.push("Restaurant profile image is required")
    if (!step2.cuisines || step2.cuisines.length === 0) errors.push("Please select at least one cuisine")
    if (!step2.openingTime?.trim()) errors.push("Opening time is required")
    if (!step2.closingTime?.trim()) errors.push("Closing time is required")
    if (!step2.openDays || step2.openDays.length === 0) errors.push("Please select at least one open day")
    return errors
  }

  const validateStep3 = () => {
    const errors = []
    if (!step3.panNumber?.trim()) errors.push("PAN number is required")
    if (!step3.nameOnPan?.trim()) errors.push("Name on PAN is required")
    if (!step3.panImage) errors.push("PAN image is required")
    if (!step3.fssaiNumber?.trim()) errors.push("FSSAI number is required")
    if (!step3.fssaiExpiry?.trim()) errors.push("FSSAI expiry date is required")
    if (!step3.fssaiImage) errors.push("FSSAI image is required")
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) errors.push("GST number is required when GST registered")
      if (!step3.gstLegalName?.trim()) errors.push("GST legal name is required when GST registered")
      if (!step3.gstAddress?.trim()) errors.push("GST registered address is required when GST registered")
      if (!step3.gstImage) errors.push("GST image is required when GST registered")
    }
    if (!step3.accountNumber?.trim()) errors.push("Account number is required")
    if (step3.accountNumber !== step3.confirmAccountNumber) errors.push("Account number and confirmation do not match")
    if (!step3.ifscCode?.trim()) errors.push("IFSC code is required")
    if (!step3.accountHolderName?.trim()) errors.push("Account holder name is required")
    if (!step3.accountType?.trim()) errors.push("Account type is required")
    return errors
  }

  const validateStep4 = () => {
    const errors = []
    if (!step4.estimatedDeliveryTime?.trim()) errors.push("Estimated delivery time is required")
    if (!step4.featuredDish?.trim()) errors.push("Featured dish name is required")
    if (!step4.featuredPrice || isNaN(parseFloat(step4.featuredPrice)) || parseFloat(step4.featuredPrice) <= 0) {
      errors.push("Featured dish price is required and must be greater than 0")
    }
    if (!step4.offer?.trim()) errors.push("Special offer/promotion is required")
    return errors
  }

  const validateAuth = () => {
    const errors = []
    if (!auth.email && !auth.phone) errors.push("Either email or phone is required")
    if (auth.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.email)) errors.push("Please enter a valid email address")
    if (auth.password && auth.password.length < 6) errors.push("Password must be at least 6 characters")
    return errors
  }

  const handleNext = () => {
    setFormErrors({})
    let validationErrors = []

    if (step === 1) {
      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3()
    } else if (step === 4) {
      validationErrors = validateStep4()
    } else if (step === 5) {
      validationErrors = validateAuth()
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => {
        toast.error(error)
      })
      return
    }

    if (step < 5) {
      setStep(step + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setFormErrors({})

    try {
      // Upload all images first
      let profileImageData = null
      if (step2.profileImage instanceof File) {
        profileImageData = await handleUpload(step2.profileImage, "appzeto/restaurant/profile")
      } else if (step2.profileImage?.url) {
        profileImageData = step2.profileImage
      }

      let menuImagesData = []
      for (const file of step2.menuImages.filter(f => f instanceof File)) {
        const uploaded = await handleUpload(file, "appzeto/restaurant/menu")
        menuImagesData.push(uploaded)
      }
      const existingMenuUrls = step2.menuImages
        .filter(
          (img) =>
            !(img instanceof File) &&
            (img?.url || (typeof img === "string" && img.startsWith("http"))),
        )
        .map((img) => (typeof img === "string" ? { url: img } : img))
      menuImagesData = [...existingMenuUrls, ...menuImagesData]

      let panImageData = null
      if (step3.panImage instanceof File) {
        panImageData = await handleUpload(step3.panImage, "appzeto/restaurant/pan")
      } else if (step3.panImage?.url) {
        panImageData = step3.panImage
      }

      let gstImageData = null
      if (step3.gstRegistered && step3.gstImage) {
        if (step3.gstImage instanceof File) {
          gstImageData = await handleUpload(step3.gstImage, "appzeto/restaurant/gst")
        } else if (step3.gstImage?.url) {
          gstImageData = step3.gstImage
        }
      }

      let fssaiImageData = null
      if (step3.fssaiImage instanceof File) {
        fssaiImageData = await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai")
      } else if (step3.fssaiImage?.url) {
        fssaiImageData = step3.fssaiImage
      }

      // Normalize location: always send GeoJSON coordinates when lat/lng are available
      const normalizedLocation = { ...(step1.location || {}) }
      const latNum = Number(normalizedLocation.latitude)
      const lngNum = Number(normalizedLocation.longitude)

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        normalizedLocation.latitude = latNum
        normalizedLocation.longitude = lngNum
        normalizedLocation.coordinates = [lngNum, latNum]
      } else if (Array.isArray(normalizedLocation.coordinates) && normalizedLocation.coordinates.length >= 2) {
        const [coordLng, coordLat] = normalizedLocation.coordinates
        if (Number.isFinite(Number(coordLat)) && Number.isFinite(Number(coordLng))) {
          normalizedLocation.latitude = Number(coordLat)
          normalizedLocation.longitude = Number(coordLng)
          normalizedLocation.coordinates = [Number(coordLng), Number(coordLat)]
        }
      }

      // Prepare payload
      const payload = {
        // Step 1
        restaurantName: step1.restaurantName,
        ownerName: step1.ownerName,
        ownerEmail: step1.ownerEmail,
        ownerPhone: step1.ownerPhone,
        primaryContactNumber: step1.primaryContactNumber,
        location: normalizedLocation,
        // Step 2
        menuImages: menuImagesData,
        profileImage: profileImageData,
        cuisines: step2.cuisines,
        openingTime: step2.openingTime,
        closingTime: step2.closingTime,
        openDays: step2.openDays,
        // Step 3
        panNumber: step3.panNumber,
        nameOnPan: step3.nameOnPan,
        panImage: panImageData,
        gstRegistered: step3.gstRegistered,
        gstNumber: step3.gstNumber,
        gstLegalName: step3.gstLegalName,
        gstAddress: step3.gstAddress,
        gstImage: gstImageData,
        fssaiNumber: step3.fssaiNumber,
        fssaiExpiry: step3.fssaiExpiry,
        fssaiImage: fssaiImageData,
        accountNumber: step3.accountNumber,
        ifscCode: step3.ifscCode,
        accountHolderName: step3.accountHolderName,
        accountType: step3.accountType,
        // Step 4
        estimatedDeliveryTime: step4.estimatedDeliveryTime,
        featuredDish: step4.featuredDish,
        featuredPrice: parseFloat(step4.featuredPrice) || 249,
        offer: step4.offer,
        // Auth
        email: auth.email || null,
        phone: auth.phone || null,
        password: auth.password || null,
        signupMethod: auth.email ? 'email' : 'phone',
        // Dining Settings
        diningSettings: step4.diningSettings,
      }

      // Call backend API
      let response;
      if (isEditMode) {
        response = await adminAPI.updateRestaurant(id, payload)
      } else {
        response = await adminAPI.createRestaurant(payload)
      }

      if (response.data.success) {
        toast.success(isEditMode ? "Restaurant updated successfully!" : "Restaurant created successfully!")
        navigate("/admin/restaurants")
      } else {
        throw new Error(response.data.message || "Failed to create restaurant")
      }
    } catch (error) {
      console.error("Error creating restaurant:", error)
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to create restaurant. Please try again."
      toast.error(errorMsg)
      setFormErrors({ submit: errorMsg })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render functions for each step
  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => setStep1({ ...step1, restaurantName: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Customers will see this name"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => setStep1({ ...step1, ownerName: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Owner full name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              value={step1.ownerPhone || ""}
              onChange={(e) => setStep1({ ...step1, ownerPhone: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="+91 98XXXXXX"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) => setStep1({ ...step1, primaryContactNumber: e.target.value })}
            className="mt-1 bg-white text-sm text-black placeholder-black"
            placeholder="Restaurant's primary contact number"
          />
        </div>
        <div className="space-y-3">
          <Input
            value={step1.location?.area || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, area: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Area / Sector / Locality*"
          />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, city: e.target.value } })}
            className="bg-white text-sm"
            placeholder="City*"
          />
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine1: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine2: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.state || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, state: e.target.value } })}
            className="bg-white text-sm"
            placeholder="State (optional)"
          />
          <Input
            value={step1.location?.pincode || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, pincode: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Pin code (optional)"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, landmark: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Nearby landmark (optional)"
          />
          <div className="space-y-1">
            <Label className="text-xs text-gray-700">Delivery Zone</Label>
            <select
              value={step1.location?.zoneId || ""}
              onChange={(e) => setStep1({ ...step1, location: { ...step1.location, zoneId: e.target.value } })}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              disabled={loadingZones}
            >
              <option value="">Select zone</option>
              {zones.map((zone) => (
                <option key={zone._id || zone.id} value={zone._id || zone.id}>
                  {zone.name || zone.zoneName}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-md border border-slate-200 overflow-hidden bg-slate-50">
            <div className="px-3 py-2 text-xs text-slate-600 border-b border-slate-200">
              Click on map to pin restaurant location. Drag marker for fine adjustment.
            </div>
            <div ref={mapRef} className="h-72 w-full" />
            {mapLoading && (
              <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200">
                Loading map...
              </div>
            )}
            {!mapLoading && mapError && (
              <div className="px-3 py-2 text-xs text-red-700 border-t border-slate-200 bg-red-50">
                {mapError}
              </div>
            )}
          </div>
          <Input
            type="number"
            step="any"
            value={step1.location?.latitude ?? ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, latitude: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Latitude (for map pin)"
          />
          <Input
            type="number"
            step="any"
            value={step1.location?.longitude ?? ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, longitude: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Longitude (for map pin)"
          />
          <Input
            value={step1.location?.formattedAddress || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, formattedAddress: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Formatted address (optional)"
          />
        </div>
      </section>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Menu & photos</h2>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu images*</Label>
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3">
            <label htmlFor="menuImagesInput" onClick={step2.menuImages.length > 0 ? (e) => e.preventDefault() : undefined} className={`inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium w-full items-center ${step2.menuImages.length > 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <Upload className="w-4.5 h-4.5" />
              <span>Choose files</span>
            </label>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) {
                  setStep2((prev) => ({ ...prev, menuImages: [...(prev.menuImages || []), ...files] }))
                  e.target.value = ''
                }
              }}
            />
          </div>
          {step2.menuImages.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => {
                const imageUrl = file instanceof File ? URL.createObjectURL(file) : (file?.url || file)
                return (
                  <div key={idx} className="relative aspect-[4/5] rounded-md overflow-hidden bg-gray-100">
                    {imageUrl && <img src={imageUrl} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />}
                    <button
                      type="button"
                      onClick={() => setStep2((prev) => ({ ...prev, menuImages: prev.menuImages.filter((_, i) => i !== idx) }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image*</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {step2.profileImage ? (
                (() => {
                  const imageSrc = step2.profileImage instanceof File ? URL.createObjectURL(step2.profileImage) : (step2.profileImage?.url || step2.profileImage)
                  return imageSrc ? <img src={imageSrc} alt="Profile" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-500" />
                })()
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <label htmlFor="profileImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer">
              <Upload className="w-4.5 h-4.5" />
              <span>Upload</span>
            </label>
            <input
              id="profileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) setStep2((prev) => ({ ...prev, profileImage: file }))
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <div>
          <Label className="text-xs text-gray-700">Select cuisines (up to 3)*</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisinesOptions.map((cuisine) => {
              const active = step2.cuisines.includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.cuisines.includes(cuisine)
                      if (exists) return { ...prev, cuisines: prev.cuisines.filter((c) => c !== cuisine) }
                      if (prev.cuisines.length >= 3) return prev
                      return { ...prev, cuisines: [...prev.cuisines, cuisine] }
                    })
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Delivery timings*</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Opening time</Label>
              <Input
                type="time"
                value={step2.openingTime || ""}
                onChange={(e) => setStep2({ ...step2, openingTime: e.target.value })}
                className="bg-white text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Closing time</Label>
              <Input
                type="time"
                value={step2.closingTime || ""}
                onChange={(e) => setStep2({ ...step2, closingTime: e.target.value })}
                className="bg-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days*</span>
          </Label>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.openDays.includes(day)
                      if (exists) return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
                      return { ...prev, openDays: [...prev.openDays, day] }
                    })
                  }}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">PAN details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number*</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => setStep3({ ...step3, panNumber: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Name on PAN*</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) => setStep3({ ...step3, nameOnPan: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">PAN image*</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setStep3({ ...step3, panImage: e.target.files?.[0] || null })}
            className="mt-1 bg-white text-sm text-black placeholder-black"
          />
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <Input value={step3.gstNumber || ""} onChange={(e) => setStep3({ ...step3, gstNumber: e.target.value })} className="bg-white text-sm" placeholder="GST number*" />
            <Input value={step3.gstLegalName || ""} onChange={(e) => setStep3({ ...step3, gstLegalName: e.target.value })} className="bg-white text-sm" placeholder="Legal name*" />
            <Input value={step3.gstAddress || ""} onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })} className="bg-white text-sm" placeholder="Registered address*" />
            <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, gstImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.fssaiNumber || ""} onChange={(e) => setStep3({ ...step3, fssaiNumber: e.target.value })} className="bg-white text-sm" placeholder="FSSAI number*" />
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date*</Label>
            <Input
              type="date"
              value={step3.fssaiExpiry || ""}
              onChange={(e) => setStep3({ ...step3, fssaiExpiry: e.target.value })}
              className="bg-white text-sm"
            />
          </div>
        </div>
        <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Bank account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.accountNumber || ""} onChange={(e) => setStep3({ ...step3, accountNumber: e.target.value.trim() })} className="bg-white text-sm" placeholder="Account number*" />
          <Input value={step3.confirmAccountNumber || ""} onChange={(e) => setStep3({ ...step3, confirmAccountNumber: e.target.value.trim() })} className="bg-white text-sm" placeholder="Re-enter account number*" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.ifscCode || ""} onChange={(e) => setStep3({ ...step3, ifscCode: e.target.value })} className="bg-white text-sm" placeholder="IFSC code*" />
          <Input value={step3.accountType || ""} onChange={(e) => setStep3({ ...step3, accountType: e.target.value })} className="bg-white text-sm" placeholder="Account type (savings / current)*" />
        </div>
        <Input value={step3.accountHolderName || ""} onChange={(e) => setStep3({ ...step3, accountHolderName: e.target.value })} className="bg-white text-sm" placeholder="Account holder name*" />
      </section>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant Display Information</h2>
        <div>
          <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
          <Input value={step4.estimatedDeliveryTime || ""} onChange={(e) => setStep4({ ...step4, estimatedDeliveryTime: e.target.value })} className="mt-1 bg-white text-sm" placeholder="e.g., 25-30 mins" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
          <Input value={step4.featuredDish || ""} onChange={(e) => setStep4({ ...step4, featuredDish: e.target.value })} className="mt-1 bg-white text-sm" placeholder="e.g., Butter Chicken Special" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Featured Dish Price (₹)*</Label>
          <Input type="number" value={step4.featuredPrice || ""} onChange={(e) => setStep4({ ...step4, featuredPrice: e.target.value })} className="mt-1 bg-white text-sm" placeholder="e.g., 249" min="0" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Special Offer/Promotion*</Label>
          <Input value={step4.offer || ""} onChange={(e) => setStep4({ ...step4, offer: e.target.value })} className="mt-1 bg-white text-sm" placeholder="e.g., Flat ₹50 OFF above ₹199" />
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Dining Configuration</h2>

        <div className="flex items-center justify-between border p-3 rounded-md">
          <div>
            <Label className="text-sm font-medium text-black">Enable Dining</Label>
            <p className="text-xs text-gray-500">Allow users to book tables</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep4({ ...step4, diningSettings: { ...step4.diningSettings, isEnabled: !step4.diningSettings?.isEnabled } })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${step4.diningSettings?.isEnabled ? 'bg-black' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${step4.diningSettings?.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs font-medium">{step4.diningSettings?.isEnabled ? "Active" : "Inactive"}</span>
          </div>
        </div>

        {step4.diningSettings?.isEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-700">Max Guests per Booking</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={String(step4.diningSettings?.maxGuests ?? 6)}
                onChange={(e) => setStep4({ ...step4, diningSettings: { ...step4.diningSettings, maxGuests: parseInt(e.target.value) || 1 } })}
                className="mt-1 bg-white text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-700">Dining Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                value={String(step4.diningSettings?.diningType ?? "family-dining")}
                onChange={(e) => setStep4({ ...step4, diningSettings: { ...step4.diningSettings, diningType: e.target.value } })}
              >
                <option value="family-dining">Family Dining</option>
                <option value="fine-dining">Fine Dining</option>
                <option value="cafe">Cafe</option>
                <option value="casual-dining">Casual Dining</option>
                <option value="pub-bar">Pub & Bar</option>
                <option value="buffet">Buffet</option>
              </select>
            </div>
          </div>
        )}
      </section>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Authentication Details</h2>
        <p className="text-sm text-gray-600">Set up login credentials for the restaurant</p>
        <div>
          <Label className="text-xs text-gray-700">Email*</Label>
          <Input
            type="email"
            value={String(auth.email || "")}
            onChange={(e) => setAuth({ ...auth, email: e.target.value || "", signupMethod: e.target.value ? 'email' : 'phone' })}
            className="mt-1 bg-white text-sm"
            placeholder="restaurant@example.com"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Phone (if no email)</Label>
          <Input
            type="tel"
            value={String(auth.phone || "")}
            onChange={(e) => setAuth({ ...auth, phone: e.target.value || "", signupMethod: !auth.email ? 'phone' : 'email' })}
            className="mt-1 bg-white text-sm"
            placeholder="+91 9876543210"
          />
        </div>

      </section>
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    if (step === 3) return renderStep3()
    if (step === 4) return renderStep4()
    return renderStep5()
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-600" />
          <div className="text-sm font-semibold text-black">{isEditMode ? "Edit Restaurant" : "Add New Restaurant"}</div>
        </div>
        <div className="text-xs text-gray-600">Step {step} of 5</div>
      </header>

      <main ref={mainContentRef} className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {renderStep()}
      </main>

      {formErrors.submit && (
        <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">{formErrors.submit}</div>
      )}

      <footer className="px-4 sm:px-6 py-3 bg-white">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="text-sm text-gray-700 bg-transparent"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="text-sm bg-black text-white px-6"
          >
            {step === 5 ? (isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isEditMode ? "Updating..." : "Creating..."} </> : (isEditMode ? "Update Restaurant" : "Create Restaurant")) : isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </footer>


    </div>
  )
}
