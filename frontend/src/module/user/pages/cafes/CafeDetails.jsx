import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { cafeAPI, diningAPI, adminAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useLocation } from "../../hooks/useLocation"
import { useZone } from "../../hooks/useZone"
import {
  ArrowLeft,
  Search,
  MoreVertical,
  MapPin,
  Clock,
  Tag,
  ChevronDown,
  Info,
  Star,
  SlidersHorizontal,
  Utensils,
  Bookmark,
  Share2,
  Plus,
  Minus,
  X,
  RotateCcw,
  Zap,
  Check,
  Lock,
  Percent,
  Eye,
  Users,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import AnimatedPage from "../../components/AnimatedPage"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import AddToCartAnimation from "../../components/AddToCartAnimation"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { isModuleAuthenticated } from "@/lib/utils/auth"



export default function CafeDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const shouldShowInlineViewCartButton = slug === "man-cafe"
  const [searchParams] = useSearchParams()
  const showOnlyUnder250 = searchParams.get('under250') === 'true'
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart()
  const { vegMode, addDishFavorite, removeDishFavorite, isDishFavorite, getDishFavorites, getFavorites, addFavorite, removeFavorite, isFavorite } = useProfile()
  const { location: userLocation } = useLocation() // Get user's current location
  const { zoneId, zone, loading: loadingZone, isOutOfService } = useZone(userLocation) // Get user's zone for zone-based filtering
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [quantities, setQuantities] = useState({})
  const [showManageCollections, setShowManageCollections] = useState(false)
  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedVariants, setSelectedVariants] = useState([])
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [showLocationSheet, setShowLocationSheet] = useState(false)
  const [showCafeInfoSheet, setShowCafeInfoSheet] = useState(false)
  const [showScheduleSheet, setShowScheduleSheet] = useState(false)
  const [showOffersSheet, setShowOffersSheet] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [expandedCoupons, setExpandedCoupons] = useState(new Set())
  const [showMenuSheet, setShowMenuSheet] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showMenuOptionsSheet, setShowMenuOptionsSheet] = useState(false)
  const [expandedAddButtons, setExpandedAddButtons] = useState(new Set())
  const [expandedSections, setExpandedSections] = useState(new Set([0])) // Default: Recommended section is expanded
  const [itemDetailQuantity, setItemDetailQuantity] = useState(1)
  const [filters, setFilters] = useState({
    sortBy: null, // "low-to-high" | "high-to-low"
    vegNonVeg: null, // "veg" | "non-veg"
  })

  useEffect(() => {
    if (vegMode && filters.vegNonVeg === "non-veg") {
      setFilters((prev) => ({ ...prev, vegNonVeg: null }))
    }
  }, [vegMode, filters.vegNonVeg])

  useEffect(() => {
    if (!showFilterSheet || typeof document === "undefined") return undefined

    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [showFilterSheet])

  // Addon states
  const [itemAddons, setItemAddons] = useState([])
  const [selectedAddons, setSelectedAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)
  const [variantQuantities, setVariantQuantities] = useState({})

  // Cafe data state
  const [cafe, setCafe] = useState(null)
  const [loadingCafe, setLoadingCafe] = useState(true)
  const [cafeError, setCafeError] = useState(null)
  const fetchedCafeRef = useRef(null) // Track the last fetched slug/zone combination
  const loggedPreparationTimesRef = useRef(new Set())

  const isVegFoodType = (foodType) => {
    const normalized = String(foodType || "").trim().toLowerCase()
    return normalized === "veg" || normalized === "pure veg" || normalized === "vegan"
  }

  const getItemVariations = (item) => {
    if (!item) return []
    const variations = item.variations || item.variants || []
    return Array.isArray(variations) ? variations.filter(Boolean) : []
  }

  const getVariantId = (variant) => {
    const rawId = variant?.id ?? variant?._id ?? null
    if (!rawId) return null
    if (typeof rawId === "string" || typeof rawId === "number") return String(rawId)
    if (typeof rawId === "object") {
      if (rawId.$oid) return String(rawId.$oid)
      if (typeof rawId.toString === "function") {
        const text = rawId.toString()
        if (text && text !== "[object Object]") return String(text)
      }
    }
    return null
  }

  const getVariantKey = (variant) => {
    if (!variant) return null
    const directId = getVariantId(variant)
    if (directId) return String(directId)
    const name = typeof variant.name === "string" ? variant.name.trim().toLowerCase().replace(/\s+/g, "-") : ""
    const price = typeof variant.price === "number" ? String(variant.price) : ""
    if (name && price) return `${name}-${price}`
    if (name) return name
    if (price) return `price-${price}`
    return null
  }

  const getVariantMatchKey = (variant) => {
    return (
      getVariantKey(variant) ||
      (typeof variant?.name === "string" ? variant.name.trim().toLowerCase() : "") ||
      null
    )
  }

  const toggleVariantSelection = (variant) => {
    const matchKey = getVariantMatchKey(variant)
    if (!matchKey) return
    setSelectedVariants(prev => {
      const isSelected = prev.some(v => getVariantMatchKey(v) === matchKey)
      if (isSelected) {
        setVariantQuantities(current => {
          const next = { ...current }
          delete next[matchKey]
          return next
        })
        return prev.filter(v => getVariantMatchKey(v) !== matchKey)
      }
      setVariantQuantities(current => ({
        ...current,
        [matchKey]: current[matchKey] || 1,
      }))
      return [...prev, variant]
    })
  }

  const isVariantOutOfStock = (variant) => {
    if (!variant) return false
    const stockValue = typeof variant.stock === "string" ? variant.stock.trim().toLowerCase() : variant.stock
    return stockValue === 0 || stockValue === "0" || stockValue === "out of stock"
  }

  const buildCartItemId = (itemId, addons = [], variant = null) => {
    const variantKey = getVariantKey(variant)
    const addonsKey = addons.length > 0
      ? addons.map(a => a._id || a.id).sort().join("-")
      : null
    const parts = [itemId]
    if (variantKey) parts.push(`variant-${variantKey}`)
    if (addonsKey) parts.push(`addons-${addonsKey}`)
    return parts.join("-")
  }

  const getVariantQuantity = (variant) => {
    const matchKey = getVariantMatchKey(variant)
    if (!matchKey) return 0
    return variantQuantities[matchKey] || 0
  }

  const incrementVariantQuantity = (variant) => {
    const matchKey = getVariantMatchKey(variant)
    if (!matchKey || isVariantOutOfStock(variant)) return

    setSelectedVariants(prev => {
      const isSelected = prev.some(v => getVariantMatchKey(v) === matchKey)
      return isSelected ? prev : [...prev, variant]
    })

    setVariantQuantities(prev => ({
      ...prev,
      [matchKey]: (prev[matchKey] || 0) + 1,
    }))
  }

  const decrementVariantQuantity = (variant) => {
    const matchKey = getVariantMatchKey(variant)
    if (!matchKey) return
    const currentQuantity = getVariantQuantity(variant)
    if (currentQuantity <= 0) return

    if (currentQuantity === 1) {
      setVariantQuantities(prev => {
        const next = { ...prev }
        delete next[matchKey]
        return next
      })
      setSelectedVariants(prev => prev.filter(v => getVariantMatchKey(v) !== matchKey))
      return
    }

    setVariantQuantities(prev => ({
      ...prev,
      [matchKey]: currentQuantity - 1,
    }))
  }

  const getPreferredVariantForItem = (item) => {
    const variations = getItemVariations(item)
    if (variations.length === 0) return null
    const cartVariantKeys = cart
      .filter(cartItem => (cartItem.baseItemId || cartItem.id) === item.id)
      .map(cartItem => cartItem.variantKey || cartItem.variantId || null)
      .filter(Boolean)
    const uniqueVariantKeys = [...new Set(cartVariantKeys)]
    if (uniqueVariantKeys.length === 1) {
      const match = variations.find(v => getVariantKey(v) === uniqueVariantKeys[0] || getVariantId(v) === uniqueVariantKeys[0])
      return match || variations[0]
    }
    if (uniqueVariantKeys.length === 0) {
      return variations[0]
    }
    return null
  }

  useEffect(() => {
    if (!cafe?.menuSections || !Array.isArray(cafe.menuSections)) return

    cafe.menuSections.forEach((section, sectionIndex) => {
      section?.items?.forEach((item, itemIndex) => {
        if (!item?.preparationTime) return

        const itemKey = item.id || item._id || `${sectionIndex}-item-${itemIndex}-${item.name}`
        const logKey = `${itemKey}:${item.preparationTime}`
        if (loggedPreparationTimesRef.current.has(logKey)) return

        loggedPreparationTimesRef.current.add(logKey)
        console.log(`[FRONTEND] Item "${item.name}" preparationTime:`, item.preparationTime, 'Type:', typeof item.preparationTime)
      })

      section?.subsections?.forEach((subsection, subsectionIndex) => {
        subsection?.items?.forEach((item, itemIndex) => {
          if (!item?.preparationTime) return

          const itemKey =
            item.id ||
            item._id ||
            `${sectionIndex}-${subsectionIndex}-subitem-${itemIndex}-${item.name}`
          const logKey = `${itemKey}:${item.preparationTime}`
          if (loggedPreparationTimesRef.current.has(logKey)) return

          loggedPreparationTimesRef.current.add(logKey)
          console.log(`[FRONTEND] Subsection item "${item.name}" preparationTime:`, item.preparationTime, 'Type:', typeof item.preparationTime)
        })
      })
    })
  }, [cafe?.menuSections])

  // Fetch cafe data from API
  useEffect(() => {
    const fetchKey = `${slug || 'no-slug'}:${zoneId || 'no-zone'}`

    const fetchCafe = async () => {
      if (!slug) return

      // Skip duplicate fetches for the same slug/zone combination.
      if (fetchedCafeRef.current === fetchKey) {
        return
      }

      try {
        setLoadingCafe(true)
        setCafeError(null)

        console.log('Fetching cafe with slug:', slug)
        let response = null
        let apiCafe = null

        // Try dining API first
        try {
          response = await diningAPI.getCafeBySlug(slug)
          if (response.data && response.data.success && response.data.data) {
            apiCafe = response.data.data
            console.log('✅ Found cafe in dining API:', apiCafe)
          }
        } catch (diningError) {
          // If dining API fails with 404, try cafe API
          if (diningError.response?.status === 404) {
            console.log('⚠️ Cafe not found in dining API, trying cafe API...')
            try {
              // First, try to get cafe directly by slug (getCafeById supports both ID and slug)
              // This doesn't require zoneId, so it works even if zone is not detected
              try {
                response = await cafeAPI.getCafeById(slug)
                if (response.data && response.data.success && response.data.data) {
                  apiCafe = response.data.data
                  console.log('✅ Found cafe in cafe API by slug/ID:', apiCafe)
                }
              } catch (directLookupError) {
                // If direct lookup fails, try searching by name (requires zoneId)
                console.log('⚠️ Direct lookup failed, trying search by name...')

                // Only search if zoneId is available (zoneId is required by backend for search)
                if (!zoneId) {
                  console.warn('⚠️ User zone not available, cannot search cafes. Cafe may not be found.')
                  // Don't throw error - let it fall through to show "Cafe not found" message
                } else {
                  // Include zoneId for zone-based filtering
                  const searchParams = { limit: 100, zoneId: zoneId }
                  const searchResponse = await cafeAPI.getCafes(searchParams)
                  const cafes = searchResponse?.data?.data?.cafes || searchResponse?.data?.data || []

                  // Try to find by slug match or name match
                  const cafeName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                  const matchingCafe = cafes.find(r =>
                    r.slug === slug ||
                    r.name?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase() ||
                    r.name?.toLowerCase() === cafeName.toLowerCase()
                  )

                  if (matchingCafe) {
                    // Get full cafe details by ID
                    const fullResponse = await cafeAPI.getCafeById(matchingCafe._id || matchingCafe.cafeId)
                    if (fullResponse.data && fullResponse.data.success && fullResponse.data.data) {
                      apiCafe = fullResponse.data.data
                      console.log('✅ Found cafe in cafe API by name search:', apiCafe)
                    }
                  }
                }
              }
            } catch (cafeError) {
              console.error('❌ Cafe not found in cafe API either:', cafeError)
              // Only throw if we haven't found the cafe yet
              if (!apiCafe) {
                throw diningError // Throw original error to show "Cafe not found"
              }
            }
          } else {
            throw diningError // Re-throw if it's not a 404
          }
        }

        if (apiCafe) {
          console.log('✅ Fetched cafe from API:', apiCafe)
          console.log('📋 Cafe data keys:', Object.keys(apiCafe))
          console.log('📋 Cafe name field:', apiCafe?.name)
          console.log('📋 Cafe cafeId:', apiCafe?.cafeId)
          console.log('📋 Cafe _id:', apiCafe?._id)
          console.log('📋 Cafe.cafe:', apiCafe?.cafe)

          // Check if this is a dining cafe with nested cafe data
          const actualCafe = apiCafe?.cafe || apiCafe

          // Helper function to format address with zone and pin code
          const formatCafeAddress = (locationObj) => {
            if (!locationObj) return "Location"

            // If location is a string, return it as is
            if (typeof locationObj === 'string') {
              return locationObj
            }

            // PRIORITY 1: Use formattedAddress if it's complete and has pin code
            // formattedAddress usually has the most complete information from Google Maps
            if (locationObj.formattedAddress && locationObj.formattedAddress.trim() !== "" && locationObj.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj.formattedAddress.trim())
              if (!isCoordinates) {
                const formattedAddr = locationObj.formattedAddress.trim()
                // Check if it contains a pin code (6 digit number)
                const hasPinCode = /\b\d{6}\b/.test(formattedAddr)
                // If it has pin code, it's complete - use it directly
                if (hasPinCode) {
                  // Clean up the address - remove Google Plus Code if present (e.g., "PV6X+JXX, ")
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                  return cleanedAddr
                }
                // If it has multiple parts (3+), it's likely complete
                if (formattedAddr.split(',').length >= 3) {
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                  return cleanedAddr
                }
              }
            }

            // PRIORITY 2: Build address from location object components (with zone and pin code)
            // This ensures we always show zone and pin code if available
            const addressParts = []

            // Add addressLine1 if available
            if (locationObj.addressLine1 && locationObj.addressLine1.trim() !== "") {
              addressParts.push(locationObj.addressLine1.trim())
            }

            // Add addressLine2 if available
            if (locationObj.addressLine2 && locationObj.addressLine2.trim() !== "") {
              addressParts.push(locationObj.addressLine2.trim())
            }

            // Add area (zone) if available
            if (locationObj.area && locationObj.area.trim() !== "") {
              addressParts.push(locationObj.area.trim())
            }

            // Add city if available
            if (locationObj.city && locationObj.city.trim() !== "") {
              addressParts.push(locationObj.city.trim())
            }

            // Add state if available
            if (locationObj.state && locationObj.state.trim() !== "") {
              addressParts.push(locationObj.state.trim())
            }

            // Add pin code (priority: pincode > zipCode > postalCode)
            const pinCode = locationObj.pincode || locationObj.zipCode || locationObj.postalCode
            if (pinCode && pinCode.toString().trim() !== "") {
              addressParts.push(pinCode.toString().trim())
            }

            // If we have at least 3 parts (complete address), use it
            if (addressParts.length >= 3) {
              return addressParts.join(', ')
            }

            // If we have at least 2 parts, use it
            if (addressParts.length >= 2) {
              return addressParts.join(', ')
            }

            // PRIORITY 3: Fallback to formattedAddress (even if incomplete)
            if (locationObj.formattedAddress && locationObj.formattedAddress.trim() !== "" && locationObj.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj.formattedAddress.trim())
              if (!isCoordinates) {
                const cleanedAddr = locationObj.formattedAddress.trim().replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                return cleanedAddr
              }
            }

            // PRIORITY 4: Fallback to address field
            if (locationObj.address && locationObj.address.trim() !== "") {
              return locationObj.address.trim()
            }

            // PRIORITY 5: Last fallback - use area or city
            return locationObj.area || locationObj.city || "Location"
          }

          // Get location object for address formatting
          const locationObj = actualCafe?.location || apiCafe?.location
          console.log('📍 Location Object for formatting:', locationObj)
          console.log('📍 formattedAddress field:', locationObj?.formattedAddress)
          const formattedAddress = formatCafeAddress(locationObj)
          console.log('📍 Final Formatted Address:', formattedAddress)

          // Calculate distance from user to cafe
          const calculateDistance = (lat1, lng1, lat2, lng2) => {
            const R = 6371 // Earth's radius in kilometers
            const dLat = (lat2 - lat1) * Math.PI / 180
            const dLng = (lng2 - lng1) * Math.PI / 180
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            return R * c // Distance in kilometers
          }

          // Get cafe coordinates
          // Priority: latitude/longitude fields > coordinates array (GeoJSON format: [lng, lat])
          const cafeLat = locationObj?.latitude || (locationObj?.coordinates && Array.isArray(locationObj.coordinates) ? locationObj.coordinates[1] : null)
          const cafeLng = locationObj?.longitude || (locationObj?.coordinates && Array.isArray(locationObj.coordinates) ? locationObj.coordinates[0] : null)

          console.log('📍 Cafe coordinates:', { cafeLat, cafeLng, locationObj })

          // Get user coordinates
          const userLat = userLocation?.latitude
          const userLng = userLocation?.longitude

          console.log('📍 User location:', { userLat, userLng, userLocation })

          // Calculate distance if both coordinates are available
          let calculatedDistance = null
          if (userLat && userLng && cafeLat && cafeLng &&
            !isNaN(userLat) && !isNaN(userLng) && !isNaN(cafeLat) && !isNaN(cafeLng)) {
            const distanceInKm = calculateDistance(userLat, userLng, cafeLat, cafeLng)
            // Format distance: show 1 decimal place if >= 1km, otherwise show in meters
            if (distanceInKm >= 1) {
              calculatedDistance = `${distanceInKm.toFixed(1)} km`
            } else {
              const distanceInMeters = Math.round(distanceInKm * 1000)
              calculatedDistance = `${distanceInMeters} m`
            }
            console.log('✅ Calculated distance from user to cafe:', calculatedDistance, 'km:', distanceInKm)
          } else {
            console.warn('⚠️ Cannot calculate distance - missing coordinates:', {
              hasUserLocation: !!(userLat && userLng),
              hasCafeLocation: !!(cafeLat && cafeLng),
              userLat,
              userLng,
              cafeLat,
              cafeLng
            })
          }

          // Transform API data to match expected format with comprehensive fallbacks
          // Handle both dining cafe and regular cafe data structures
          const transformedCafe = {
            id: actualCafe?.cafeId || actualCafe?._id || actualCafe?.id || apiCafe?.cafeId || apiCafe?._id || null,
            name: actualCafe?.name || apiCafe?.name || apiCafe?.cafeName || "Unknown Cafe",
            cuisine: (actualCafe?.cuisines && Array.isArray(actualCafe.cuisines) && actualCafe.cuisines.length > 0)
              ? actualCafe.cuisines[0]
              : (apiCafe?.cuisines && Array.isArray(apiCafe.cuisines) && apiCafe.cuisines.length > 0)
                ? apiCafe.cuisines[0]
                : (actualCafe?.cuisine || apiCafe?.cuisine || actualCafe?.category || apiCafe?.category || "Multi-cuisine"),
            rating: actualCafe?.rating ?? apiCafe?.rating ?? actualCafe?.averageRating ?? apiCafe?.averageRating ?? 4.5,
            reviews: actualCafe?.totalRatings ?? apiCafe?.totalRatings ?? actualCafe?.reviewCount ?? apiCafe?.reviewCount ?? actualCafe?.reviews?.length ?? apiCafe?.reviews?.length ?? 0,
            deliveryTime: actualCafe?.estimatedDeliveryTime || apiCafe?.estimatedDeliveryTime || actualCafe?.deliveryTime || apiCafe?.deliveryTime || actualCafe?.avgDeliveryTime || apiCafe?.avgDeliveryTime || "25-30 mins",
            distance: calculatedDistance || actualCafe?.distance || apiCafe?.distance || actualCafe?.distanceFromUser || apiCafe?.distanceFromUser || "1.2 km",
            location: formattedAddress,
            locationObject: locationObj, // Store full location object for reference
            image: actualCafe?.profileImage?.url
              || apiCafe?.profileImage?.url
              || actualCafe?.profileImage
              || apiCafe?.profileImage
              || (Array.isArray(actualCafe?.menuImages) && actualCafe.menuImages.length > 0
                ? (actualCafe.menuImages[0]?.url || actualCafe.menuImages[0])
                : null)
              || (Array.isArray(apiCafe?.menuImages) && apiCafe.menuImages.length > 0
                ? (apiCafe.menuImages[0]?.url || apiCafe.menuImages[0])
                : null)
              || actualCafe?.image
              || apiCafe?.image
              || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
            priceRange: apiCafe?.priceRange || "$$",
            offers: Array.isArray(apiCafe?.offers) ? apiCafe.offers : [], // Will be populated from menu/offers API later
            offerText: apiCafe?.offer || "FLAT 50% OFF",
            offerCount: apiCafe?.offerCount ?? 0,
            cafeOffers: {
              goldOffer: {
                title: apiCafe?.cafeOffers?.goldOffer?.title || "Gold exclusive offer",
                description: apiCafe?.cafeOffers?.goldOffer?.description || "Free delivery above ₹99",
                unlockText: apiCafe?.cafeOffers?.goldOffer?.unlockText || "join Gold to unlock",
                buttonText: apiCafe?.cafeOffers?.goldOffer?.buttonText || "Add Gold - ₹1",
              },
              coupons: Array.isArray(apiCafe?.cafeOffers?.coupons)
                ? apiCafe.cafeOffers.coupons
                : [],
            },
            outlets: Array.isArray(apiCafe?.outlets) ? apiCafe.outlets : [],
            categories: Array.isArray(apiCafe?.categories) ? apiCafe.categories : [],
            menu: Array.isArray(apiCafe?.menu) ? apiCafe.menu : [],
            slug: apiCafe?.slug || apiCafe?.name?.toLowerCase().replace(/\s+/g, '-') || slug || "unknown",
            cafeId: apiCafe?.cafeId || apiCafe?._id || apiCafe?.id || null,
            // Add other fields with defaults
            featuredDish: apiCafe?.featuredDish || "Special Dish",
            featuredPrice: apiCafe?.featuredPrice ?? 249,
            // Additional safety fields
            openDays: Array.isArray(apiCafe?.openDays) ? apiCafe.openDays : [],
            deliveryTimings: apiCafe?.deliveryTimings || {
              openingTime: "09:00",
              closingTime: "22:00",
            },
            cuisines: Array.isArray(apiCafe?.cuisines) ? apiCafe.cuisines : [],
            profileImage: apiCafe?.profileImage || null,
            menuImages: Array.isArray(apiCafe?.menuImages) ? apiCafe.menuImages : [],
            // Menu sections for display (will be populated from menu API)
            menuSections: [],
            // Availability fields for grayscale styling
            isActive: actualCafe?.isActive !== false, // Default to true if not specified
            isAcceptingOrders: actualCafe?.isAcceptingOrders !== false, // Default to true if not specified
          }

          console.log('✅ Transformed cafe:', transformedCafe)
          console.log('✅ Cafe ID for menu fetch:', transformedCafe.id)

          if (!transformedCafe.id) {
            console.error('❌ No cafe ID found! Cannot fetch menu.')
          }

          setCafe(transformedCafe)
          fetchedCafeRef.current = fetchKey // Mark this slug/zone combination as fetched

          // Fetch menu and inventory for this cafe
          // If no cafe ID, try to find matching cafe by name
          let cafeIdForMenu = transformedCafe.id

          if (!cafeIdForMenu) {
            console.warn('⚠️ No cafe ID available, searching for cafe by name...')
            try {
              // CRITICAL: Only search if zoneId is available (zoneId is required by backend)
              if (!zoneId) {
                console.warn('⚠️ User zone not available, cannot search cafes. Menu may not load.')
                // Continue without menu - cafe details are still available
                return
              }

              // Include zoneId for zone-based filtering
              const searchParams = { limit: 100, zoneId: zoneId }
              const searchResponse = await cafeAPI.getCafes(searchParams)
              const cafes = searchResponse?.data?.data?.cafes || searchResponse?.data?.data || []

              // Try to find by exact name match
              const matchingCafe = cafes.find(r =>
                r.name?.toLowerCase().trim() === transformedCafe.name?.toLowerCase().trim()
              )

              if (matchingCafe) {
                cafeIdForMenu = matchingCafe._id || matchingCafe.cafeId || matchingCafe.id
                console.log('✅ Found matching cafe by name, ID:', cafeIdForMenu)

                // Update the cafe ID in state
                setCafe(prev => ({
                  ...prev,
                  id: cafeIdForMenu,
                  cafeId: cafeIdForMenu
                }))
              } else {
                console.warn('⚠️ No matching cafe found by name')
              }
            } catch (searchError) {
              console.error('❌ Error searching for cafe:', searchError)
            }
          }

          if (cafeIdForMenu) {
            try {
              console.log('📋 Fetching menu for cafe ID:', cafeIdForMenu)
              const menuResponse = await cafeAPI.getMenuByCafeId(cafeIdForMenu)
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const menuSections = menuResponse.data.data.menu.sections || []
                const normalizedMenuSections = menuSections.map((section) => ({
                  ...section,
                  items: (section.items || []).map((item) => ({
                    ...item,
                    sectionName: section.name || item.sectionName || null,
                    categoryName: item.categoryName || section.name || item.category || null,
                  })),
                  subsections: (section.subsections || []).map((subsection) => ({
                    ...subsection,
                    items: (subsection.items || []).map((item) => ({
                      ...item,
                      sectionName: subsection.name || section.name || item.sectionName || null,
                      categoryName:
                        item.categoryName ||
                        subsection.name ||
                        section.name ||
                        item.category ||
                        null,
                    })),
                  })),
                }))

                // Collect all recommended items from all sections
                // Only include items that are both recommended (isRecommended === true) AND available (isAvailable !== false)
                const recommendedItems = []
                normalizedMenuSections.forEach(section => {
                  // Check direct items - only include if isRecommended is explicitly true (strict check) AND item is available
                  if (section.items && Array.isArray(section.items)) {
                    section.items.forEach(item => {
                      // Strict check: isRecommended must be exactly boolean true
                      // This will exclude: false, undefined, null, 0, "", and any other falsy values
                      if (item.isRecommended === true && typeof item.isRecommended === 'boolean' && item.isAvailable !== false) {
                        recommendedItems.push(item)
                      }
                    })
                  }
                  // Check subsection items - only include if isRecommended is explicitly true (strict check) AND item is available
                  if (section.subsections && Array.isArray(section.subsections)) {
                    section.subsections.forEach(subsection => {
                      if (subsection.items && Array.isArray(subsection.items)) {
                        subsection.items.forEach(item => {
                          // Strict check: isRecommended must be exactly boolean true
                          // This will exclude: false, undefined, null, 0, "", and any other falsy values
                          if (item.isRecommended === true && typeof item.isRecommended === 'boolean' && item.isAvailable !== false) {
                            recommendedItems.push(item)
                          }
                        })
                      }
                    })
                  }
                })

                // Debug log to verify recommended items and their isRecommended values
                console.log('Recommended items collected:', recommendedItems.map(item => ({
                  name: item.name,
                  isRecommended: item.isRecommended,
                  isRecommendedType: typeof item.isRecommended,
                  preparationTime: item.preparationTime
                })))

                // Debug log to check preparationTime in menu sections
                console.log('Menu sections with preparationTime:', menuSections.map(section => ({
                  sectionName: section.name,
                  items: section.items?.map(item => ({
                    name: item.name,
                    preparationTime: item.preparationTime
                  })) || []
                })))

                // Always create recommended section (even if empty) - will show "No dish Yet" if empty
                const finalMenuSections = [{ name: "Recommended for you", items: recommendedItems, subsections: [] }, ...normalizedMenuSections]

                setCafe(prev => ({
                  ...prev,
                  menuSections: finalMenuSections,
                }))

                // Set first 3 sections (Recommended, Starters, Main Course) as expanded by default
                const defaultExpandedSections = new Set([0, 1, 2]) // Index 0, 1, 2
                setExpandedSections(defaultExpandedSections)

                console.log('Fetched menu sections with recommended items:', finalMenuSections)
              }
            } catch (menuError) {
              if (menuError.response && menuError.response.status === 404) {
                console.log('⚠️ Menu not found for this cafe (might be a dining-only listing).')
              } else {
                console.error('❌ Error fetching menu:', menuError)
              }
            }

            try {
              console.log('📋 Fetching inventory for cafe ID:', cafeIdForMenu)
              const inventoryResponse = await cafeAPI.getInventoryByCafeId(cafeIdForMenu)
              if (inventoryResponse.data && inventoryResponse.data.success && inventoryResponse.data.data && inventoryResponse.data.data.inventory) {
                const inventoryCategories = inventoryResponse.data.data.inventory.categories || []

                // Normalize inventory categories to ensure proper structure
                const normalizedInventory = inventoryCategories.map((category, index) => ({
                  id: category.id || `category-${index}`,
                  name: category.name || "Unnamed Category",
                  description: category.description || "",
                  itemCount: category.itemCount ?? (category.items?.length || 0),
                  inStock: category.inStock !== undefined ? category.inStock : true,
                  items: Array.isArray(category.items) ? category.items.map(item => ({
                    id: String(item.id || Date.now() + Math.random()),
                    name: item.name || "Unnamed Item",
                    inStock: item.inStock !== undefined ? item.inStock : true,
                    isVeg: item.isVeg !== undefined ? item.isVeg : true,
                    stockQuantity: item.stockQuantity || "Unlimited",
                    unit: item.unit || "piece",
                    expiryDate: item.expiryDate || null,
                    lastRestocked: item.lastRestocked || null,
                  })) : [],
                  order: category.order !== undefined ? category.order : index,
                }))

                setCafe(prev => ({
                  ...prev,
                  inventory: normalizedInventory,
                }))
                console.log('✅ Fetched and normalized inventory categories:', normalizedInventory)
              }
            } catch (inventoryError) {
              if (inventoryError.response && inventoryError.response.status === 404) {
                console.log('⚠️ Inventory not found for this cafe (might be a dining-only listing).')
              } else {
                console.error('❌ Error fetching inventory:', inventoryError)
              }
            }
          }
        } else {
          console.error('❌ No cafe data found in API response')
          console.error('❌ Response:', response)
          console.error('❌ apiCafe:', apiCafe)
          setCafeError('Cafe not found')
          setCafe(null)
          fetchedCafeRef.current = null
        }
      } catch (error) {
        // Check if it's a network error (backend not running)
        const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error'

        // Check if it's a 404 error (cafe doesn't exist)
        const is404Error = error.response?.status === 404

        if (isNetworkError) {
          // Network error - backend is not running
          // Don't show "Cafe not found" for network errors
          // The axios interceptor will show a toast notification
          console.error('Network error fetching cafe (backend may not be running):', error)
          setCafeError('Backend server is not connected. Please make sure the backend is running.')
          setCafe(null)
          fetchedCafeRef.current = null
        } else if (is404Error) {
          // 404 error - cafe doesn't exist in database
          console.log(`Cafe "${slug}" not found in database`)
          setCafeError('Cafe not found')
          setCafe(null)
          fetchedCafeRef.current = null
        } else {
          // Other errors
          console.error('Error fetching cafe:', error)
          setCafeError(error.message || 'Failed to load cafe')
          setCafe(null)
          fetchedCafeRef.current = null
        }
      } finally {
        setLoadingCafe(false)
      }
    }

    // Wait for zone to load before fetching (if zone-based search might be needed)
    // But don't block if we're fetching by direct ID
    if (loadingZone) {
      console.log('⏳ Waiting for zone detection before fetching cafe...')
      return
    }

    fetchCafe()
  }, [slug, zoneId, loadingZone])

  // Track previous values to prevent unnecessary recalculations
  const prevCoordsRef = useRef({ userLat: null, userLng: null, cafeLat: null, cafeLng: null })
  const prevDistanceRef = useRef(null)

  // Extract cafe coordinates as stable values (not array references)
  const cafeLat = cafe?.locationObject?.latitude ||
    (cafe?.locationObject?.coordinates && Array.isArray(cafe.locationObject.coordinates)
      ? cafe.locationObject.coordinates[1]
      : null)
  const cafeLng = cafe?.locationObject?.longitude ||
    (cafe?.locationObject?.coordinates && Array.isArray(cafe.locationObject.coordinates)
      ? cafe.locationObject.coordinates[0]
      : null)

  // Recalculate distance when user location updates
  useEffect(() => {
    if (!cafe || !userLocation?.latitude || !userLocation?.longitude) return
    if (!cafeLat || !cafeLng) return

    const userLat = userLocation.latitude
    const userLng = userLocation.longitude

    // Check if coordinates have actually changed (with small threshold to avoid floating point issues)
    const coordsChanged =
      Math.abs(prevCoordsRef.current.userLat - userLat) > 0.0001 ||
      Math.abs(prevCoordsRef.current.userLng - userLng) > 0.0001 ||
      Math.abs(prevCoordsRef.current.cafeLat - cafeLat) > 0.0001 ||
      Math.abs(prevCoordsRef.current.cafeLng - cafeLng) > 0.0001

    // Skip recalculation if coordinates haven't changed
    if (!coordsChanged && prevDistanceRef.current !== null) {
      return
    }

    // Update refs with current coordinates
    prevCoordsRef.current = { userLat, userLng, cafeLat, cafeLng }

    if (userLat && userLng && cafeLat && cafeLng &&
      !isNaN(userLat) && !isNaN(userLng) && !isNaN(cafeLat) && !isNaN(cafeLng)) {

      // Calculate distance
      const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371 // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLng = (lng2 - lng1) * Math.PI / 180
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c // Distance in kilometers
      }

      const distanceInKm = calculateDistance(userLat, userLng, cafeLat, cafeLng)
      let calculatedDistance = null

      // Format distance: show 1 decimal place if >= 1km, otherwise show in meters
      if (distanceInKm >= 1) {
        calculatedDistance = `${distanceInKm.toFixed(1)} km`
      } else {
        const distanceInMeters = Math.round(distanceInKm * 1000)
        calculatedDistance = `${distanceInMeters} m`
      }

      // Only update if distance actually changed
      if (calculatedDistance !== prevDistanceRef.current) {
        console.log('🔄 Recalculated distance from user to cafe:', calculatedDistance, 'km:', distanceInKm)
        prevDistanceRef.current = calculatedDistance

        // Update cafe distance
        setCafe(prev => {
          // Only update if distance actually changed to prevent infinite loop
          if (prev?.distance === calculatedDistance) {
            return prev
          }
          return {
            ...prev,
            distance: calculatedDistance
          }
        })
      }
    }
  }, [userLocation?.latitude, userLocation?.longitude, cafeLat, cafeLng])

  // Sync quantities from cart on mount and when cafe changes
  useEffect(() => {
    if (!cafe || !cafe.name) return

    const cartQuantities = {}
    cart.forEach((item) => {
      if (item.cafe === cafe.name) {
        const baseId = item.baseItemId || item.id
        cartQuantities[baseId] = (cartQuantities[baseId] || 0) + (item.quantity || 0)
      }
    })
    setQuantities(cartQuantities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe?.name, cart])

  // Helper function to update item quantity in both local state and cart
  const updateItemQuantity = (item, newQuantity, event = null, addons = [], variant = null) => {
    const isGuestUser = !isModuleAuthenticated('user')

    // CRITICAL: Check if user is in service zone or cafe is available
    if (isOutOfService) {
      toast.error('You are outside the service zone. Please select a location within the service area.');
      return;
    }

    // Generate a unique ID if there are addons
    const cartItemId = buildCartItemId(item.id, addons, variant)

    // Update local state (only for the base item to show quantity badge in list)
    setQuantities((prev) => {
      const baseItemId = item.id
      const otherVariantsTotal = cart.reduce((sum, cartItem) => {
        const cartBaseId = cartItem.baseItemId || cartItem.id
        if (cartBaseId !== baseItemId) return sum
        if (cartItem.id === cartItemId) return sum
        return sum + (cartItem.quantity || 0)
      }, 0)
      const nextTotal = newQuantity > 0 ? otherVariantsTotal + newQuantity : otherVariantsTotal
      return {
        ...prev,
        [baseItemId]: nextTotal,
      }
    })

    // CRITICAL: Validate cafe data before adding to cart
    if (!cafe || !cafe.name) {
      console.error('❌ Cannot add item to cart: Cafe data is missing!');
      toast.error('Cafe information is missing. Please refresh the page.');
      return;
    }

    // Ensure we have a valid cafeId
    const validCafeId = cafe?.cafeId || cafe?._id || cafe?.id;
    if (!validCafeId) {
      console.error('❌ Cannot add item to cart: Cafe ID is missing!');
      toast.error('Cafe ID is missing. Please refresh the page.');
      return;
    }

    // Prepare cart item with all required properties
    const addonsPrice = addons.reduce((sum, addon) => sum + (addon.price || 0), 0)
    const variantId = getVariantId(variant)
    const variantKey = getVariantKey(variant)
    const variantPrice = typeof variant?.price === "number" ? variant.price : null
    const basePrice = variantPrice !== null ? variantPrice : item.price
    const cartItem = {
      id: cartItemId,
      baseItemId: item.id, // Store original ID
      name: item.name,
      price: basePrice + addonsPrice,
      basePrice: basePrice,
      variantId: variantId,
      variantKey: variantKey,
      variantName: variant?.name || null,
      variantPrice: basePrice,
      variant: variantId ? { id: variantId, name: variant?.name || "", price: basePrice } : null,
      addons: addons.map(a => ({ addonId: a._id || a.id, name: a.name, price: a.price })), // Keep for backward compatibility
      selectedAddons: addons.map(a => ({ addonId: a._id || a.id, name: a.name, price: a.price })), // New field as requested
      image: item.image,
      cafe: cafe.name,
      cafeId: validCafeId,
      categoryId: item.categoryId || null,
      category: item.category || item.categoryName || item.sectionName || null,
      categoryName: item.categoryName || item.category || item.sectionName || null,
      sectionName: item.sectionName || null,
      description: item.description,
      originalPrice: item.originalPrice ? (item.originalPrice + addonsPrice) : null,
      isVeg: item.isVeg !== undefined ? item.isVeg : isVegFoodType(item.foodType)
    }

    // Get source position for animation
    let sourcePosition = null
    if (event) {
      let buttonElement = event.currentTarget
      if (!buttonElement && event.target) {
        buttonElement = event.target.closest('button') || event.target
      }

      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect()
        sourcePosition = {
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          scrollX: window.pageXOffset || window.scrollX || 0,
          scrollY: window.pageYOffset || window.scrollY || 0,
          itemId: cartItemId,
        }
      }
    }

    // Update cart context
    try {
      if (newQuantity <= 0) {
        removeFromCart(cartItemId, sourcePosition, { id: cartItemId, name: item.name, imageUrl: item.image })
      } else {
        const existingCartItem = getCartItem(cartItemId)
        if (existingCartItem) {
          if (newQuantity > existingCartItem.quantity) {
            addToCart(cartItem, sourcePosition)
          } else {
            updateQuantity(cartItemId, newQuantity, sourcePosition, { id: cartItemId, name: item.name, imageUrl: item.image })
          }
        } else {
          addToCart(cartItem, sourcePosition)
          if (newQuantity > 1) {
            updateQuantity(cartItemId, newQuantity, sourcePosition, { id: cartItemId, name: item.name, imageUrl: item.image })
          }
        }
      }
    } catch (error) {
      console.error('❌ Error updating cart:', error);
      toast.error(error.message || 'Error updating cart');
    }
  }

  // Menu categories - dynamically generated from cafe menu sections
  const menuCategories = (cafe?.menuSections && Array.isArray(cafe.menuSections))
    ? cafe.menuSections.map((section, index) => {
      // Handle section name - check for valid non-empty string
      let sectionTitle = "Unnamed Section"
      if (index === 0) {
        sectionTitle = "Recommended for you"
      } else if (section?.name && typeof section.name === 'string' && section.name.trim()) {
        sectionTitle = section.name.trim()
      } else if (section?.title && typeof section.title === 'string' && section.title.trim()) {
        sectionTitle = section.title.trim()
      }

      const itemCount = section?.items?.length || 0
      const subsectionCount = section?.subsections?.reduce((sum, sub) => sum + (sub?.items?.length || 0), 0) || 0
      const totalCount = itemCount + subsectionCount

      return {
        name: sectionTitle,
        count: totalCount,
        sectionIndex: index,
      }
    })
    : []

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (filters.sortBy) count++
    if (filters.vegNonVeg) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  // Handle bookmark click
  const handleBookmarkClick = (item) => {
    const cafeId = cafe?.cafeId || cafe?._id || cafe?.id
    if (!cafeId) {
      toast.error("Cafe information is missing")
      return
    }

    const dishId = item.id || item._id
    if (!dishId) {
      toast.error("Dish information is missing")
      return
    }

    const isFavorite = isDishFavorite(dishId, cafeId)

    if (isFavorite) {
      // If already bookmarked, remove it
      removeDishFavorite(dishId, cafeId)
      toast.success("Dish removed from favorites")
    } else {
      // Add to favorites
      const dishData = {
        id: dishId,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        cafeId: cafeId,
        cafeName: cafe?.name || "",
        cafeSlug: cafe?.slug || slug || "",
        foodType: item.foodType,
        isSpicy: item.isSpicy,
        customisable: item.customisable,
      }
      addDishFavorite(dishData)
      toast.success("Dish added to favorites")
    }
  }

  // Handle add to collection
  const handleAddToCollection = () => {
    const cafeSlug = cafe?.slug || slug || ""

    if (!cafeSlug) {
      toast.error("Cafe information is missing")
      return
    }

    if (!cafe) {
      toast.error("Cafe data not available")
      return
    }

    const isAlreadyFavorite = isFavorite(cafeSlug)

    if (isAlreadyFavorite) {
      // Remove from collection
      removeFavorite(cafeSlug)
      toast.success("Cafe removed from collection")
    } else {
      // Add to collection
      addFavorite({
        slug: cafeSlug,
        name: cafe.name || "",
        cuisine: cafe.cuisine || "",
        rating: cafe.rating || 0,
        deliveryTime: cafe.deliveryTime || cafe.estimatedDeliveryTime || "",
        distance: cafe.distance || "",
        priceRange: cafe.priceRange || "",
        image: cafe.profileImageUrl?.url || cafe.image || ""
      })
      toast.success("Cafe added to collection")
    }

    setShowMenuOptionsSheet(false)
  }

  // Custom share sheet state (shown when navigator.share is unavailable)
  const [shareSheetData, setShareSheetData] = useState(null) // { url, title, text }

  // Handle share cafe
  const handleShareCafe = async () => {
    const companyName = await getCompanyNameAsync()
    const cafeName = cafe?.name || "this cafe"
    const currentPath = window.location.pathname || `/cafes/${cafe?.slug || slug || ""}`

    // Create share URL
    const shareUrl = `${window.location.origin}${currentPath}`
    const shareText = `Check out ${cafeName} on ${companyName}!`

    // Try Web Share API first (native mobile share sheet - requires HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title: cafeName, text: shareText, url: shareUrl })
        toast.success("Cafe shared successfully")
        setShowMenuOptionsSheet(false)
      } catch (error) {
        if (error.name !== "AbortError") {
          setShareSheetData({ url: shareUrl, title: cafeName, text: shareText })
        }
      }
    } else {
      // Show custom share sheet as fallback
      setShareSheetData({ url: shareUrl, title: cafeName, text: shareText })
    }
  }



  // Handle share click
  const handleShareClick = async (item) => {
    const dishId = item.id || item._id
    const currentPath = window.location.pathname || `/cafes/${cafe?.slug || slug || ""}`

    // Create share URL
    const shareUrl = `${window.location.origin}${currentPath}?dish=${encodeURIComponent(dishId)}`
    const shareTitle = `${item.name} - ${cafe?.name || ""}`
    const shareText = `Check out ${item.name} from ${cafe?.name || "this cafe"}!`

    // Try Web Share API first (native mobile share sheet - requires HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        toast.success("Dish shared successfully")
      } catch (error) {
        if (error.name !== "AbortError") {
          setShareSheetData({ url: shareUrl, title: shareTitle, text: shareText })
        }
      }
    } else {
      // Show custom share sheet as fallback
      setShareSheetData({ url: shareUrl, title: shareTitle, text: shareText })
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand("copy")
        toast.success("Link copied to clipboard!")
      } catch (err) {
        toast.error("Failed to copy link")
      }
      document.body.removeChild(textArea)
    }
  }

  // Handle item card click
  const handleItemClick = (item) => {
    const variations = getItemVariations(item)
    const initialVariantQuantities = {}
    const initiallySelectedVariants = []

    variations.forEach((variant) => {
      const cartItemId = buildCartItemId(item.id, [], variant)
      const existingCartItem = getCartItem(cartItemId)
      const quantity = existingCartItem?.quantity || 0
      if (quantity > 0) {
        const matchKey = getVariantMatchKey(variant)
        if (matchKey) {
          initialVariantQuantities[matchKey] = quantity
          initiallySelectedVariants.push(variant)
        }
      }
    })

    if (variations.length > 0 && initiallySelectedVariants.length === 0) {
      const defaultVariant = variations[0]
      const defaultMatchKey = getVariantMatchKey(defaultVariant)
      if (defaultMatchKey) {
        initialVariantQuantities[defaultMatchKey] = 1
        initiallySelectedVariants.push(defaultVariant)
      }
    }

    setSelectedItem({
      ...item,
      isVeg: item.isVeg !== undefined ? item.isVeg : isVegFoodType(item.foodType),
    })
    setSelectedVariants(initiallySelectedVariants)
    setVariantQuantities(initialVariantQuantities)
    setItemDetailQuantity(1)
    setSelectedAddons([]) // Reset selected addons when opening item
    setShowItemDetail(true)
  }

  // Fetch addons when selectedItem changes
  useEffect(() => {
    const fetchItemAddons = async (categoryId) => {
      try {
        setLoadingAddons(true)
        const response = await adminAPI.getAddonsByCategory(categoryId)
        if (response.data?.success) {
          setItemAddons(response.data.data.addons || [])
        }
      } catch (error) {
        console.error("Error fetching item addons:", error)
        setItemAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    if (showItemDetail && selectedItem?.categoryId) {
      fetchItemAddons(selectedItem.categoryId)
    } else if (!showItemDetail) {
      setItemAddons([])
      setSelectedAddons([])
      setSelectedVariants([])
      setVariantQuantities({})
    }
  }, [showItemDetail, selectedItem])

  useEffect(() => {
    if (!showItemDetail || !selectedItem) return
    if (getItemVariations(selectedItem).length > 0) return
    if (selectedVariants.length !== 1) return
    const primaryVariant = selectedVariants[0]
    const cartItemId = buildCartItemId(selectedItem.id, selectedAddons, primaryVariant)
    const existingCartItem = getCartItem(cartItemId)
    setItemDetailQuantity(Math.max(1, existingCartItem?.quantity || 1))
  }, [showItemDetail, selectedItem, selectedVariants, selectedAddons, getCartItem])

  const toggleAddon = (addon) => {
    setSelectedAddons(prev => {
      const isSelected = prev.find(a => a._id === addon._id)
      if (isSelected) {
        return prev.filter(a => a._id !== addon._id)
      } else {
        return [...prev, addon]
      }
    })
  }

  const calculateTotalPrice = () => {
    if (!selectedItem) return 0
    const addonsPrice = selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0)
    const hasVariantSelections = selectedVariants.some(variant => getVariantQuantity(variant) > 0)

    if (hasVariantSelections) {
      return selectedVariants.reduce((sum, variant) => {
        const quantity = getVariantQuantity(variant)
        if (quantity <= 0) return sum
        const variantPrice = typeof variant?.price === "number" ? variant.price : null
        const basePrice = variantPrice !== null ? variantPrice : (selectedItem.price || 0)
        return sum + ((basePrice + addonsPrice) * quantity)
      }, 0)
    }

    const selectedBase = selectedVariants.length > 0
      ? selectedVariants.reduce((sum, variant) => {
          const variantPrice = typeof variant?.price === "number" ? variant.price : null
          const basePrice = variantPrice !== null ? variantPrice : (selectedItem.price || 0)
          return sum + basePrice
        }, 0)
      : (selectedItem.price || 0)
    const variantsCount = selectedVariants.length > 0 ? selectedVariants.length : 1
    const perUnitTotal = selectedVariants.length > 0
      ? (selectedBase + addonsPrice * variantsCount)
      : (selectedBase + addonsPrice)
    return perUnitTotal * Math.max(1, itemDetailQuantity)
  }

  // Helper function to calculate final price after discount
  const getFinalPrice = (item) => {
    // If discount exists, calculate from originalPrice, otherwise use price directly
    if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
      // Calculate discounted price from originalPrice
      let discountedPrice = item.originalPrice;
      if (item.discountType === 'Percent') {
        discountedPrice = item.originalPrice - (item.originalPrice * item.discountAmount / 100);
      } else if (item.discountType === 'Fixed') {
        discountedPrice = item.originalPrice - item.discountAmount;
      }
      return Math.max(0, discountedPrice);
    }
    // Otherwise, use price as the final price
    return Math.max(0, item.price || 0);
  };

  // Filter menu items based on active filters
  const filterMenuItems = (items) => {
    if (!items) return items

    return items.filter((item) => {
      // Under 250 filter (when coming from Under 250 page)
      if (showOnlyUnder250) {
        const finalPrice = getFinalPrice(item);
        if (finalPrice > 250) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const itemName = item.name?.toLowerCase() || ""
        if (!itemName.includes(query)) return false
      }

      // VegMode filter - when vegMode is ON, show only Veg items
      // When vegMode is false/null/undefined, show all items (Veg and Non-Veg)
      if (vegMode === true) {
        if (!isVegFoodType(item.foodType)) return false
      }

      // Veg/Non-veg filter (local filter override)
      if (filters.vegNonVeg === "veg") {
        // Show only veg items
        if (!isVegFoodType(item.foodType)) return false
      }
      if (filters.vegNonVeg === "non-veg") {
        // Show only non-veg items
        if (isVegFoodType(item.foodType)) return false
      }


      return true
    })
  }

  // Sort items based on sortBy filter
  const sortMenuItems = (items) => {
    if (!items) return items
    if (!filters.sortBy) return items

    const sorted = [...items]
    if (filters.sortBy === "low-to-high") {
      return sorted.sort((a, b) => getFinalPrice(a) - getFinalPrice(b))
    } else if (filters.sortBy === "high-to-low") {
      return sorted.sort((a, b) => getFinalPrice(b) - getFinalPrice(a))
    }
    return sorted
  }

  const isItemOutOfStock = (item) => {
    if (!item) return false
    if (item.isAvailable === false) return true
    const stockValue = typeof item.stock === "string" ? item.stock.trim().toLowerCase() : item.stock
    return stockValue === 0 || stockValue === "0" || stockValue === "out of stock"
  }

  // Helper function to check if a section has any items under ₹250
  const sectionHasItemsUnder250 = (section) => {
    if (!showOnlyUnder250) return true; // If not filtering, show all sections

    // Check direct items
    if (section.items && section.items.length > 0) {
      const hasUnder250Items = section.items.some(item => {
        const finalPrice = getFinalPrice(item);
        return finalPrice <= 250;
      });
      if (hasUnder250Items) return true;
    }

    // Check subsection items
    if (section.subsections && section.subsections.length > 0) {
      for (const subsection of section.subsections) {
        if (subsection.items && subsection.items.length > 0) {
          const hasUnder250Items = subsection.items.some(item => {
            const finalPrice = getFinalPrice(item);
            return finalPrice <= 250;
          });
          if (hasUnder250Items) return true;
        }
      }
    }

    return false;
  }

  // Filter sections to only show those with items under ₹250
  // Returns array of { section, originalIndex } to preserve original index for expanded sections
  const getFilteredSections = () => {
    if (!cafe?.menuSections) return [];
    if (!showOnlyUnder250) {
      return cafe.menuSections.map((section, index) => ({ section, originalIndex: index }));
    }

    return cafe.menuSections
      .map((section, index) => ({ section, originalIndex: index }))
      .filter(({ section }) => sectionHasItemsUnder250(section));
  }

  // Highlight offers/texts for the blue offer line
  const highlightOffers = [
    "Upto 50% OFF",
    cafe?.offerText || "",
    ...(Array.isArray(cafe?.offers) ? cafe.offers.map((offer) => offer?.title || "") : []),
  ]

  // Auto-rotate images every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        const offersLength = Array.isArray(cafe?.offers) ? cafe.offers.length : 1
        return (prev + 1) % offersLength
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [cafe?.offers?.length || 0])

  // Auto-rotate highlight offer text every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % highlightOffers.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [highlightOffers.length])

  // Show loading state
  if (loadingCafe) {
    return (
      <AnimatedPage>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
            <span className="text-sm text-gray-600">Loading cafe...</span>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  // Show error state if cafe not found or network error
  if (cafeError && !cafe) {
    const isNetworkError = cafeError.includes('Backend server is not connected')
    const isNotFoundError = cafeError === 'Cafe not found'

    return (
      <AnimatedPage>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className={`h-12 w-12 ${isNetworkError ? 'text-orange-500' : 'text-red-500'}`} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {isNetworkError ? 'Connection Error' : isNotFoundError ? 'Cafe not found' : 'Error'}
              </h2>
              <p className="text-sm text-gray-600 mb-4 max-w-md">{cafeError}</p>
              {isNetworkError && (
                <p className="text-xs text-gray-500 mb-4">
                  Make sure the backend server is running at {API_BASE_URL.replace('/api', '')}
                </p>
              )}
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  // Show error if cafe is still null
  if (!cafe) {
    return (
      <AnimatedPage>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <span className="text-sm text-gray-600">Cafe not found</span>
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  // Only show grayscale when user is out of service (not based on cafe availability)
  const shouldShowGrayscale = isOutOfService
  const selectedVariantOutOfStock = selectedVariants.some(v => isVariantOutOfStock(v))
  const isDetailOutOfStock = selectedItem
    ? (isItemOutOfStock(selectedItem) || selectedVariantOutOfStock)
    : false
  const selectedItemVariations = getItemVariations(selectedItem)

  return (
    <>
      <AnimatedPage
        id="scrollingelement"
        className={`min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col transition-all duration-300 ${shouldShowGrayscale ? 'grayscale opacity-75' : ''
          }`}
      >
        {/* Header - Back, Search, Menu (like reference image) */}
        <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 pt-3 md:pt-4 lg:pt-5 pb-2 md:pb-3 bg-white dark:bg-[#1a1a1a]">
          <div className="w-full lg:max-w-[1100px] mx-auto flex items-center justify-between">
            {/* Back Button */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a]"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
            </Button>

            {/* Right side: Search pill + menu */}
            <div className="flex items-center gap-3">
              {!showSearch ? (
                <Button
                  variant="outline"
                  className="rounded-full h-10 px-4 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a] flex items-center gap-2 text-gray-900 dark:text-white"
                  onClick={() => setShowSearch(true)}
                >
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-medium">Search</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for dishes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a] text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      autoFocus
                      onBlur={() => {
                        if (!searchQuery) {
                          setShowSearch(false)
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery("")
                          setShowSearch(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-10 w-10 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1a1a1a]"
                onClick={() => setShowMenuOptionsSheet(true)}
              >
                <MoreVertical className="h-5 w-5 text-gray-900 dark:text-white" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Card - Height is determined by content, padding only when needed */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-t-3xl relative z-10 flex-1">
          <div className="w-full lg:max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-5 md:py-6 lg:py-8 space-y-3 md:space-y-4 lg:space-y-5 pb-0">
            {/* Cafe Name and Rating */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cafe?.name || "Unknown Cafe"}</h1>
                <button
                  type="button"
                  onClick={() => setShowCafeInfoSheet(true)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Show cafe information"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col items-end">
                <Badge className="bg-green-500 text-white mb-1 flex items-center gap-1 px-2 py-1">
                  <Star className="h-3 w-3 fill-white" />
                  {cafe?.rating ?? 4.5}
                </Badge>
                <span className="text-xs text-gray-500">By {(cafe.reviews || 0).toLocaleString()}+</span>
              </div>
            </div>

            {/* Location */}
            <div
              className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
              onClick={() => setShowLocationSheet(true)}
            >
              <MapPin className="h-4 w-4" />
              <span>{cafe?.distance || "1.2 km"} · {cafe?.location || "Location"}</span>
            </div>

            {/* Delivery Time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="h-4 w-4" />
                <span>{cafe?.deliveryTime || "25-30 mins"}</span>
              </div>
            </div>

            {/* Offers */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm overflow-hidden">
                <Tag className="h-4 w-4 text-blue-600" />
                <div className="relative h-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={highlightIndex}
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-blue-600 font-medium inline-block"
                    >
                      {highlightOffers[highlightIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Filter/Category Buttons */}
            <div className="border-y border-gray-200 py-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-2 w-max">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 whitespace-nowrap border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] relative"
                  onClick={() => setShowFilterSheet(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex items-center gap-1.5 whitespace-nowrap border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-full ${filters.vegNonVeg === "veg" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""
                    }`}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      vegNonVeg: prev.vegNonVeg === "veg" ? null : "veg",
                    }))
                  }
                >
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Veg
                  {filters.vegNonVeg === "veg" && (
                    <X className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                  )}
                </Button>
                {!vegMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex items-center gap-1.5 whitespace-nowrap border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white rounded-full ${filters.vegNonVeg === "non-veg" ? "border-amber-700 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30" : ""
                      }`}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        vegNonVeg: prev.vegNonVeg === "non-veg" ? null : "non-veg",
                      }))
                    }
                  >
                    <div className="h-3 w-3 rounded-full bg-amber-700" />
                    Non-veg
                    {filters.vegNonVeg === "non-veg" && (
                      <X className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {cafe?.menuSections && Array.isArray(cafe.menuSections) && cafe.menuSections.length > 0 && (
            <div className="w-full lg:max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8 md:py-10 lg:py-12 space-y-6 md:space-y-8 lg:space-y-10 pb-[180px]">
              {getFilteredSections().map(({ section, originalIndex }, sectionIndex) => {
                // Handle section name - check for valid non-empty string
                let sectionTitle = "Unnamed Section"
                if (originalIndex === 0) {
                  sectionTitle = "Recommended for you"
                } else if (section?.name && typeof section.name === 'string' && section.name.trim()) {
                  sectionTitle = section.name.trim()
                } else if (section?.title && typeof section.title === 'string' && section.title.trim()) {
                  sectionTitle = section.title.trim()
                }
                const sectionId = `menu-section-${originalIndex}`

                const isExpanded = expandedSections.has(originalIndex)

                return (
                  <div key={sectionIndex} id={sectionId} className="space-y-4 scroll-mt-20">
                    {/* Section Header */}
                    {sectionIndex === 0 && (
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          Recommended for you
                        </h2>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedSections(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(originalIndex)) {
                                newSet.delete(originalIndex)
                              } else {
                                newSet.add(originalIndex)
                              }
                              return newSet
                            })
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          <ChevronDown
                            className={`h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'
                              }`}
                          />
                        </button>
                      </div>
                    )}
                    {sectionIndex > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {(section?.name && typeof section.name === 'string' && section.name.trim())
                              ? section.name.trim()
                              : (section?.title && typeof section.title === 'string' && section.title.trim())
                                ? section.title.trim()
                                : "Unnamed Section"}
                          </h2>
                          {section.subtitle && (
                            <button className="text-sm text-blue-600 dark:text-blue-400 underline">
                              {section.subtitle}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedSections(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(originalIndex)) {
                                newSet.delete(originalIndex)
                              } else {
                                newSet.add(originalIndex)
                              }
                              return newSet
                            })
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          <ChevronDown
                            className={`h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'
                              }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* Direct Items */}
                    {isExpanded && originalIndex === 0 && section.items && section.items.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
                          No dish recommended
                        </p>
                      </div>
                    )}
                    {isExpanded && section.items && section.items.length > 0 && (
                      <div className="space-y-0">
                        {sortMenuItems(filterMenuItems(section.items)).map((item) => {
                          const quantity = quantities[item.id] || 0
                          const variations = getItemVariations(item)
                          const hasVariations = variations.length > 0
                          const preferredVariant = getPreferredVariantForItem(item)
                          // Determine veg/non-veg based on foodType
                          const isVeg = isVegFoodType(item.foodType)
                          const isOutOfStock = isItemOutOfStock(item)

                          return (
                            <div
                              key={item.id}
                              className="flex gap-4 p-4 border-b border-gray-100 last:border-none relative cursor-pointer"
                              onClick={() => handleItemClick(item)}
                            >
                              {/* Left Side - Details */}
                              <div className="flex-1 min-w-0">
                                {/* Veg Icon & Spicy Indicator */}
                                <div className="flex items-center gap-2 mb-1">
                                  {isVeg ? (
                                    <div className="w-4 h-4 border-2 border-green-600 flex items-center justify-center rounded-sm flex-shrink-0">
                                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 border-2 border-orange-600 flex items-center justify-center rounded-sm flex-shrink-0">
                                      <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                                    </div>
                                  )}
                                  {item.isSpicy && <span className="text-red-500">🌶️</span>}
                                </div>

                                <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight">{item.name}</h3>

                                {/* Highly Reordered Progress Bar - Show if customisable */}
                                {item.customisable && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-600 w-3/4"></div>
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Highly reordered</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 mt-1">
                                  <p className="font-semibold text-gray-900 dark:text-white">₹{Math.round(item.price)}</p>
                                  {/* Preparation Time - Show if available */}
                                  {item.preparationTime && String(item.preparationTime).trim() && (
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                      <Clock size={12} className="text-gray-500" />
                                      <span>{String(item.preparationTime).trim()}</span>
                                    </div>
                                  )}
                                </div>
                                {isOutOfStock && (
                                  <span className="inline-block mt-1 text-xs font-semibold text-red-600">
                                    Out of stock
                                  </span>
                                )}

                                {/* Description - Show if available */}
                                {item.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                                )}

                                {/* Action Buttons - Bookmark and Share */}
                                <div className="flex gap-4 mt-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleBookmarkClick(item)
                                    }}
                                    className={`p-1.5 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isDishFavorite(item.id, cafe?.cafeId || cafe?._id || cafe?.id)
                                      ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20"
                                      : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                                      }`}
                                  >
                                    <Bookmark
                                      size={18}
                                      className={isDishFavorite(item.id, cafe?.cafeId || cafe?._id || cafe?.id) ? "fill-red-500" : ""}
                                    />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleShareClick(item)
                                    }}
                                    className="p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    <Share2 size={18} />
                                  </button>
                                </div>
                              </div>

                              {/* Right Side - Image and Add Button */}
                              <div className="relative w-32 h-32 flex-shrink-0">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-2xl shadow-sm"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                                    <span className="text-xs text-gray-400">No image</span>
                                  </div>
                                )}
                                {quantity > 0 ? (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                                  >
                                    <div
                                      className={`bg-white border font-bold px-4 py-1.5 rounded-lg shadow-md flex items-center gap-1 ${shouldShowGrayscale
                                        ? 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                                        : 'border-green-600 text-green-600 hover:bg-green-50'
                                        }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!shouldShowGrayscale && !isOutOfStock) {
                                            if (hasVariations && !preferredVariant) {
                                              handleItemClick(item)
                                            } else {
                                              updateItemQuantity(
                                                item,
                                                Math.max(0, quantity - 1),
                                                e,
                                                [],
                                                preferredVariant
                                              )
                                            }
                                          }
                                        }}
                                        disabled={shouldShowGrayscale || isOutOfStock}
                                        className={shouldShowGrayscale || isOutOfStock
                                          ? 'flex h-5 w-5 items-center justify-center text-gray-400 cursor-not-allowed'
                                          : 'flex h-5 w-5 items-center justify-center text-green-600 hover:text-green-700'
                                        }
                                      >
                                        <Minus size={14} className="block" />
                                      </button>
                                      <span className={`mx-2 inline-flex min-w-[1rem] items-center justify-center text-sm ${shouldShowGrayscale || isOutOfStock ? 'text-gray-400' : ''}`}>{quantity}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!shouldShowGrayscale && !isOutOfStock) {
                                            if (hasVariations && !preferredVariant) {
                                              handleItemClick(item)
                                            } else {
                                              updateItemQuantity(item, quantity + 1, e, [], preferredVariant)
                                            }
                                          }
                                        }}
                                        disabled={shouldShowGrayscale || isOutOfStock}
                                        className={shouldShowGrayscale || isOutOfStock
                                          ? 'flex h-5 w-5 items-center justify-center text-gray-400 cursor-not-allowed'
                                          : 'flex h-5 w-5 items-center justify-center text-green-600 hover:text-green-700'
                                        }
                                      >
                                        <Plus size={14} className="block stroke-[3px]" />
                                      </button>
                                    </div>
                                  </motion.div>
                                ) : (
                                  <motion.button
                                    layoutId={`add-button-${item.id}`}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, type: "spring", damping: 20, stiffness: 300 }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!shouldShowGrayscale && !isOutOfStock) {
                                        if (hasVariations || item.categoryId) {
                                          handleItemClick(item)
                                        } else {
                                          updateItemQuantity(item, 1, e)
                                        }
                                      }
                                    }}
                                    disabled={shouldShowGrayscale || isOutOfStock}
                                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white border font-bold px-6 py-1.5 rounded-lg shadow-md flex items-center gap-1 transition-colors ${shouldShowGrayscale || isOutOfStock
                                      ? 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                                      : 'border-green-600 text-green-600 hover:bg-green-50'
                                      }`}
                                  >
                                    {isOutOfStock ? "OUT OF STOCK" : (
                                      <>
                                        ADD <Plus size={14} className="stroke-[3px]" />
                                      </>
                                    )}
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Subsections */}
                    {isExpanded && section.subsections && section.subsections.length > 0 && (
                      <div className="space-y-4">
                        {section.subsections.filter(subsection => {
                          // Filter subsections to only show those with items under ₹250
                          if (!showOnlyUnder250) return true;
                          if (!subsection.items || subsection.items.length === 0) return false;
                          return subsection.items.some(item => {
                            const finalPrice = getFinalPrice(item);
                            return finalPrice <= 250;
                          });
                        }).map((subsection, subIndex) => {
                          const subsectionKey = `${originalIndex}-${subIndex}`
                          const isSubsectionExpanded = expandedSections.has(subsectionKey)

                          return (
                            <div key={subIndex} className="space-y-4">
                              {/* Subsection Header */}
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                  {subsection?.name || subsection?.title || "Subsection"}
                                </h3>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedSections(prev => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(subsectionKey)) {
                                        newSet.delete(subsectionKey)
                                      } else {
                                        newSet.add(subsectionKey)
                                      }
                                      return newSet
                                    })
                                  }}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isSubsectionExpanded ? '' : '-rotate-90'
                                      }`}
                                  />
                                </button>
                              </div>

                              {/* Subsection Items */}
                              {isSubsectionExpanded && subsection.items && subsection.items.length > 0 && (
                                <div className="space-y-0">
                                  {sortMenuItems(filterMenuItems(subsection.items)).map((item) => {
                                    const quantity = quantities[item.id] || 0
                                    const variations = getItemVariations(item)
                                    const hasVariations = variations.length > 0
                                    const preferredVariant = getPreferredVariantForItem(item)
                                    // Determine veg/non-veg based on foodType
                                    const isVeg = isVegFoodType(item.foodType)
                                    const isOutOfStock = isItemOutOfStock(item)

                                    return (
                                      <div
                                        key={item.id}
                                        className="flex gap-4 pt-4 px-4 pb-8 border-b border-gray-100 last:border-none relative cursor-pointer"
                                        onClick={() => handleItemClick(item)}
                                      >
                                        {/* Left Side - Details */}
                                        <div className="flex-1 min-w-0">
                                          {/* Veg Icon & Spicy Indicator */}
                                          <div className="flex items-center gap-2 mb-1">
                                            {isVeg ? (
                                              <div className="w-4 h-4 border-2 border-green-600 flex items-center justify-center rounded-sm flex-shrink-0">
                                                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                              </div>
                                            ) : (
                                              <div className="w-4 h-4 border-2 border-orange-600 flex items-center justify-center rounded-sm flex-shrink-0">
                                                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                                              </div>
                                            )}
                                            {item.isSpicy && <span className="text-red-500">🌶️</span>}
                                          </div>

                                          <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight">{item.name}</h3>

                                          {/* Highly Reordered Progress Bar - Show if customisable */}
                                          {item.customisable && (
                                            <div className="flex items-center gap-2 mt-1">
                                              <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-600 w-3/4"></div>
                                              </div>
                                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Highly reordered</span>
                                            </div>
                                          )}

                                          <div className="flex items-center gap-3 mt-1">
                                            <p className="font-semibold text-gray-900 dark:text-white">₹{Math.round(item.price)}</p>
                                            {/* Preparation Time - Show if available */}
                                            {item.preparationTime && String(item.preparationTime).trim() && (
                                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                                <Clock size={12} className="text-gray-500" />
                                                <span>{String(item.preparationTime).trim()}</span>
                                              </div>
                                            )}
                                          </div>
                                          {isOutOfStock && (
                                            <span className="inline-block mt-1 text-xs font-semibold text-red-600">
                                              Out of stock
                                            </span>
                                          )}

                                          {/* Description - Show if available */}
                                          {item.description && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                                          )}

                                          {/* Action Buttons - Bookmark and Share */}
                                          <div className="flex gap-4 mt-3">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleBookmarkClick(item)
                                              }}
                                              className={`p-1.5 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isDishFavorite(item.id, cafe?.cafeId || cafe?._id || cafe?.id)
                                                ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20"
                                                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                                                }`}
                                            >
                                              <Bookmark
                                                size={18}
                                                className={isDishFavorite(item.id, cafe?.cafeId || cafe?._id || cafe?.id) ? "fill-red-500" : ""}
                                              />
                                            </button>
                                            <button
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                            >
                                              <Share2 size={18} />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Right Side - Image and Add Button */}
                                        <div className="relative w-32 h-32 flex-shrink-0">
                                          {item.image ? (
                                            <img
                                              src={item.image}
                                              alt={item.name}
                                              className="w-full h-full object-cover rounded-2xl shadow-sm"
                                            />
                                          ) : (
                                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                                              <span className="text-xs text-gray-400">No image</span>
                                            </div>
                                          )}
                                          {quantity > 0 ? (
                                            <motion.div
                                              initial={{ opacity: 0, scale: 0.8 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              className="absolute bottom-1 left-1/2 -translate-x-1/2"
                                            >
                                              <div
                                                className={`bg-white border font-bold px-4 py-1.5 rounded-lg shadow-md flex items-center gap-1 ${shouldShowGrayscale
                                                  ? 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                                                  : 'border-green-600 text-green-600 hover:bg-green-50'
                                                  }`}
                                              >
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (!shouldShowGrayscale && !isOutOfStock) {
                                                      if (hasVariations && !preferredVariant) {
                                                        handleItemClick(item)
                                                      } else {
                                                        updateItemQuantity(
                                                          item,
                                                          Math.max(0, quantity - 1),
                                                          e,
                                                          [],
                                                          preferredVariant
                                                        )
                                                      }
                                                    }
                                                  }}
                                                  disabled={shouldShowGrayscale || isOutOfStock}
                                                  className={shouldShowGrayscale || isOutOfStock
                                                    ? 'flex h-5 w-5 items-center justify-center text-gray-400 cursor-not-allowed'
                                                    : 'flex h-5 w-5 items-center justify-center text-green-600 hover:text-green-700'
                                                  }
                                                >
                                                  <Minus size={14} className="block" />
                                                </button>
                                                <span className={`mx-2 inline-flex min-w-[1rem] items-center justify-center text-sm ${shouldShowGrayscale || isOutOfStock ? 'text-gray-400' : ''}`}>{quantity}</span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (!shouldShowGrayscale && !isOutOfStock) {
                                                      if (hasVariations && !preferredVariant) {
                                                        handleItemClick(item)
                                                      } else {
                                                        updateItemQuantity(item, quantity + 1, e, [], preferredVariant)
                                                      }
                                                    }
                                                  }}
                                                  disabled={shouldShowGrayscale || isOutOfStock}
                                                  className={shouldShowGrayscale || isOutOfStock
                                                    ? 'flex h-5 w-5 items-center justify-center text-gray-400 cursor-not-allowed'
                                                    : 'flex h-5 w-5 items-center justify-center text-green-600 hover:text-green-700'
                                                  }
                                                >
                                                  <Plus size={14} className="block stroke-[3px]" />
                                                </button>
                                              </div>
                                            </motion.div>
                                          ) : (
                                            <motion.button
                                              layoutId={`add-button-sub-${item.id}`}
                                              initial={{ opacity: 0, scale: 0.9 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              transition={{ duration: 0.3, type: "spring", damping: 20, stiffness: 300 }}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!shouldShowGrayscale && !isOutOfStock) {
                                                if (hasVariations || item.categoryId) {
                                                  handleItemClick(item)
                                                } else {
                                                  updateItemQuantity(item, 1, e)
                                                }
                                              }
                                              }}
                                              disabled={shouldShowGrayscale || isOutOfStock}
                                              className={`absolute bottom-1 left-1/2 -translate-x-1/2 bg-white border font-bold px-6 py-1.5 rounded-lg shadow-md flex items-center gap-1 transition-colors ${shouldShowGrayscale || isOutOfStock
                                                ? 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                                                : 'border-green-600 text-green-600 hover:bg-green-50'
                                                }`}
                                            >
                                              {isOutOfStock ? "OUT OF STOCK" : (
                                                <>
                                                  ADD <Plus size={14} className="stroke-[3px]" />
                                                </>
                                              )}
                                            </motion.button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </AnimatedPage>

      {/* Fixed UI elements outside AnimatedPage to prevent transform clipping */}
      {/* Menu Button - Fixed at bottom right */}
      {!showFilterSheet && !showMenuSheet && !showMenuOptionsSheet && (
        <div
          className={`fixed transition-all duration-300 ${
            shouldShowInlineViewCartButton
              ? "bottom-16 right-4 z-[70] md:bottom-20 md:right-8"
              : "bottom-28 right-6 z-[55] md:bottom-32 md:right-8"
          }`}
        >
          <Button
            className="bg-gray-800/95 hover:bg-gray-900 text-white flex items-center gap-2 shadow-2xl px-6 py-2.5 rounded-full border border-white/10 backdrop-blur-sm"
            size="lg"
            onClick={() => setShowMenuSheet(true)}
          >
            <Utensils className="h-4 w-4" />
            <span className="font-semibold text-sm">Menu</span>
          </Button>
        </div>
      )}

      {/* Menu Categories Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showMenuSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowMenuSheet(false)}
                />

                {/* Menu Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                  style={{ willChange: "transform" }}
                >
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="space-y-1">
                      {menuCategories.map((category, index) => (
                        <button
                          key={index}
                          className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                          onClick={() => {
                            setShowMenuSheet(false)
                            // Scroll to category section
                            setTimeout(() => {
                              const sectionId = `menu-section-${category.sectionIndex}`
                              const sectionElement = document.getElementById(sectionId)
                              if (sectionElement) {
                                sectionElement.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start'
                                })
                              }
                            }, 300) // Small delay to allow sheet to close
                          }}
                        >
                          <span className="text-base font-medium text-gray-900 dark:text-white">
                            {category.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {category.count}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Close Button */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
                    <Button
                      variant="outline"
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white border-0 flex items-center justify-center gap-2 py-3 rounded-lg"
                      onClick={() => setShowMenuSheet(false)}
                    >
                      <X className="h-5 w-5" />
                      Close
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Filters and Sorting Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showFilterSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowFilterSheet(false)}
                />

                {/* Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl h-[80vh] md:h-auto md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                  style={{ willChange: "transform" }}
                >
                  {/* Header with X button */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters and Sorting</h2>
                    <button
                      onClick={() => setShowFilterSheet(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
                    {/* Sort by */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sort by:</h3>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              sortBy: prev.sortBy === "low-to-high" ? null : "low-to-high",
                            }))
                          }
                          className={`text-left px-4 py-2.5 rounded-lg border-2 transition-all ${filters.sortBy === "low-to-high"
                            ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                        >
                          Price - low to high
                        </button>
                        <button
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              sortBy: prev.sortBy === "high-to-low" ? null : "high-to-low",
                            }))
                          }
                          className={`text-left px-4 py-2.5 rounded-lg border-2 transition-all ${filters.sortBy === "high-to-low"
                            ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                        >
                          Price - high to low
                        </button>
                      </div>
                    </div>

                    {slug !== "man-cafe" && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Veg/Non-veg preference:</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                vegNonVeg: prev.vegNonVeg === "veg" ? null : "veg",
                              }))
                            }
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all flex-1 ${filters.vegNonVeg === "veg"
                              ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                              }`}
                          >
                            <div className="h-4 w-4 rounded-full bg-green-500 dark:bg-green-400" />
                            <span className="font-medium">Veg</span>
                          </button>
                          {!vegMode && (
                            <button
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  vegNonVeg: prev.vegNonVeg === "non-veg" ? null : "non-veg",
                                }))
                              }
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all flex-1 ${filters.vegNonVeg === "non-veg"
                                ? "border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                            >
                              <div className="h-4 w-4 rounded-full bg-amber-700 dark:bg-amber-600" />
                              <span className="font-medium">Non-veg</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Top picks */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top picks:</h3>
                      <button
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            highlyReordered: !prev.highlyReordered,
                          }))
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all w-full ${filters.highlyReordered
                          ? "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">Highly reordered</span>
                      </button>
                    </div>

                  </div>

                  {/* Bottom Action Bar */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => {
                        setFilters({
                          sortBy: null,
                          vegNonVeg: null,
                          highlyReordered: false,
                        })
                      }}
                      className="text-red-600 dark:text-red-400 font-medium text-sm hover:text-red-700 dark:hover:text-red-500"
                    >
                      Clear All
                    </button>
                    <Button
                      className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-lg font-medium"
                      onClick={() => setShowFilterSheet(false)}
                    >
                      Apply {activeFilterCount > 0 && `(${activeFilterCount})`}
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Location Outlets Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showLocationSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowLocationSheet(false)}
                />

                {/* Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl h-[75vh] md:h-auto md:max-h-[90vh] md:max-w-xl w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                  style={{ willChange: "transform" }}
                >
                  {/* Outlets List */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {cafe?.outlets && Array.isArray(cafe.outlets) && cafe.outlets.length > 0 ? (
                      <div className="space-y-2">
                        {cafe.outlets.map((outlet) => (
                          <div
                            key={outlet?.id || Math.random()}
                            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a]"
                          >
                            {outlet?.isNearest && (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded-md">
                                <Zap className="h-3.5 w-3.5 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                  Nearest available outlet
                                </span>
                              </div>
                            )}
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              {outlet?.location || "Location"}
                            </h3>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{outlet?.deliveryTime || "25-30 mins"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>{outlet?.distance || "1.2 km"}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    {outlet?.rating ?? 4.5}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  By {(outlet?.reviews || 0) >= 1000 ? `${((outlet.reviews || 0) / 1000).toFixed(1)}K+` : `${outlet?.reviews || 0}+`}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No outlets available
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {cafe?.outlets && Array.isArray(cafe.outlets) && cafe.outlets.length > 5 && (
                    <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-[#1a1a1a]">
                      <button className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm w-full">
                        <span>See all {cafe.outlets.length} outlets</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Cafe Info Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showCafeInfoSheet && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowCafeInfoSheet(false)}
                />

                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                  <motion.div
                    className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
                    initial={{ opacity: 0, scale: 0.92, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 12 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-red-50 to-white dark:from-[#232323] dark:to-[#1a1a1a]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cafe Info</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Basic details for this cafe</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCafeInfoSheet(false)}
                          className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
                          aria-label="Close cafe information"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="space-y-2.5">
                        {[
                          { label: "Name", value: cafe?.name || "Unknown Cafe" },
                          { label: "Cuisine", value: cafe?.cuisine || "N/A" },
                          { label: "Rating", value: cafe?.rating ?? "N/A" },
                          { label: "Delivery Time", value: cafe?.deliveryTime || "N/A" },
                          { label: "Location", value: cafe?.location || "N/A" },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#222] px-3.5 py-2.5"
                          >
                            <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{item.label}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Manage Collections Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showManageCollections && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowManageCollections(false)}
                />

                {/* Manage Collections Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl md:max-w-lg w-full md:w-auto"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Manage Collections</h2>
                    <button
                      onClick={() => setShowManageCollections(false)}
                      className="h-8 w-8 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>

                  {/* Collections List */}
                  <div className="px-4 py-4 space-y-2">
                    {/* Bookmarks Collection */}
                    <button
                      className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Don't close modal on click, let checkbox handle it
                      }}
                    >
                      <div className="h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                        <Bookmark className="h-6 w-6 text-red-500 dark:text-red-400 fill-red-500 dark:fill-red-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium text-gray-900 dark:text-white">Bookmarks</span>
                          {selectedItem && (
                            <Checkbox
                              checked={isDishFavorite(selectedItem.id, cafe?.cafeId || cafe?._id || cafe?.id)}
                              onCheckedChange={(checked) => {
                                if (!checked && selectedItem) {
                                  const cafeId = cafe?.cafeId || cafe?._id || cafe?.id
                                  removeDishFavorite(selectedItem.id, cafeId)
                                  setShowManageCollections(false)
                                }
                              }}
                              className="h-5 w-5 rounded border-2 border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          {!selectedItem && (
                            <div className="h-5 w-5 rounded border-2 border-red-500 bg-red-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {getDishFavorites().length} dishes • {getFavorites().length} cafe
                        </p>
                      </div>
                    </button>

                    {/* Create new Collection */}
                    <button
                      className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setShowManageCollections(false)}
                    >
                      <div className="h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-6 w-6 text-red-500 dark:text-red-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-base font-medium text-gray-900 dark:text-white">
                          Create new Collection
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Done Button */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                    <Button
                      className="w-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-medium"
                      onClick={() => {
                        setShowManageCollections(false)
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Item Detail Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showItemDetail && selectedItem && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowItemDetail(false)}
                />

                {/* Item Detail Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] md:max-w-2xl lg:max-w-3xl w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.15, type: "spring", damping: 30, stiffness: 400 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close Button - Top Center Above Popup with 4px gap */}
                  <div className="absolute -top-[44px] left-1/2 -translate-x-1/2 z-[10001]">
                    <motion.button
                      onClick={() => setShowItemDetail(false)}
                      className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="h-5 w-5 text-white" />
                    </motion.button>
                  </div>

                  {/* Image Section */}
                  <div className="relative w-full h-64 overflow-hidden rounded-t-3xl">
                    {selectedItem.image ? (
                      <img
                        src={selectedItem.image}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm text-gray-400">No image available</span>
                      </div>
                    )}
                    {/* Bookmark and Share Icons Overlay */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBookmarkClick(selectedItem)
                        }}
                        className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${isDishFavorite(selectedItem.id, cafe?.cafeId || cafe?._id || cafe?.id)
                          ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                          : "border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a]"
                          }`}
                      >
                        <Bookmark
                          className={`h-5 w-5 transition-all duration-300 ${isDishFavorite(selectedItem.id, cafe?.cafeId || cafe?._id || cafe?.id) ? "fill-red-500 dark:fill-red-400" : ""
                            }`}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShareClick(selectedItem)
                        }}
                        className="h-10 w-10 rounded-full border border-white dark:border-gray-800 bg-white/90 dark:bg-[#1a1a1a]/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#2a2a2a] flex items-center justify-center transition-colors"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {/* Item Name and Indicator */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedItem.isVeg
                            ? "border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30"
                            : "border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30"
                        }`}>
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            selectedItem.isVeg
                              ? "bg-green-600 dark:bg-green-500"
                              : "bg-amber-700 dark:bg-amber-600"
                          }`} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {selectedItem.name}
                        </h2>
                      </div>
                      {/* Bookmark and Share Icons (Desktop) */}
                      <div className="hidden md:flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleBookmarkClick(selectedItem)
                          }}
                          className={`h-8 w-8 rounded-full border flex items-center justify-center transition-all duration-300 ${isDishFavorite(selectedItem.id, cafe?.cafeId || cafe?._id || cafe?.id)
                            ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                            : "border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            }`}
                        >
                          <Bookmark
                            className={`h-4 w-4 transition-all duration-300 ${isDishFavorite(selectedItem.id, cafe?.cafeId || cafe?._id || cafe?.id) ? "fill-red-500 dark:fill-red-400" : ""
                              }`}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleShareClick(selectedItem)
                          }}
                          className="h-8 w-8 rounded-full border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                      {selectedItem.description}
                    </p>

                    {selectedItemVariations.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Choose size</p>
                        <div className="space-y-2">
                          {selectedItemVariations.map((variant) => {
                            const variantId = getVariantId(variant)
                            const variantKey = getVariantKey(variant)
                            const isSelected = selectedVariants.some(v => getVariantMatchKey(v) === getVariantMatchKey(variant))
                            const isVariantSoldOut = isVariantOutOfStock(variant)
                            const variantQuantity = getVariantQuantity(variant)
                            const variantPrice = typeof variant?.price === "number"
                              ? variant.price
                              : (selectedItem.price || 0)

                            return (
                              <div
                                key={variantKey || variantId || variant.name}
                                role="button"
                                tabIndex={isVariantSoldOut ? -1 : 0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (!isVariantSoldOut) {
                                    toggleVariantSelection(variant)
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === " ") && !isVariantSoldOut) {
                                    e.preventDefault()
                                    toggleVariantSelection(variant)
                                  }
                                }}
                                className={`w-full text-left border rounded-lg px-3 py-2 grid grid-cols-[1fr_120px_80px] items-center transition-colors ${
                                  isSelected
                                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                                } ${isVariantSoldOut ? "opacity-50 cursor-not-allowed" : "hover:border-red-400"}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
                                    isSelected ? "border-red-500 bg-red-500" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
                                  }`}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{variant.name}</span>
                                  {isVariantSoldOut && (
                                    <span className="text-xs text-red-500">Out of stock</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    decrementVariantQuantity(variant)
                                  }}
                                  disabled={isVariantSoldOut || variantQuantity <= 0}
                                  className={`h-7 w-7 rounded-full border flex items-center justify-center ${
                                    isVariantSoldOut || variantQuantity <= 0
                                      ? "border-gray-200 text-gray-300 cursor-not-allowed"
                                      : "border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  }`}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-sm font-semibold text-gray-900 dark:text-white text-center">
                                  {variantQuantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    incrementVariantQuantity(variant)
                                  }}
                                  disabled={isVariantSoldOut}
                                  className={`h-7 w-7 rounded-full border flex items-center justify-center ${
                                    isVariantSoldOut
                                      ? "border-gray-200 text-gray-300 cursor-not-allowed"
                                      : "border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  }`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                                  ₹{Math.round(variantPrice)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Highly Reordered Progress Bar */}
                    {selectedItem.customisable && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 dark:bg-green-400 rounded-full" style={{ width: '50%' }} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                          highly reordered
                        </span>
                      </div>
                    )}

                    {/* Not Eligible for Coupons */}
                    {selectedItem.notEligibleForCoupons && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
                        NOT ELIGIBLE FOR COUPONS
                      </p>
                    )}

                    {loadingAddons && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
                    <div className="flex items-center gap-4">
                      {selectedItemVariations.length === 0 && (
                        <div className={`flex items-center gap-3 border-2 rounded-lg px-3 h-[44px] bg-white dark:bg-[#2a2a2a] ${shouldShowGrayscale || isDetailOutOfStock
                          ? 'border-gray-300 dark:border-gray-700 opacity-50'
                          : 'border-gray-300 dark:border-gray-700'
                          }`}>
                          <button
                            onClick={(e) => {
                              if (!shouldShowGrayscale && !isDetailOutOfStock) {
                                setItemDetailQuantity((prev) => Math.max(1, prev - 1))
                              }
                            }}
                            disabled={itemDetailQuantity <= 1 || shouldShowGrayscale || isDetailOutOfStock}
                            className={`${shouldShowGrayscale || isDetailOutOfStock
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed'
                              }`}
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                          <span className={`text-lg font-semibold min-w-[2rem] text-center ${shouldShowGrayscale || isDetailOutOfStock
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-gray-900 dark:text-white'
                            }`}>
                            {itemDetailQuantity}
                          </span>
                          <button
                            onClick={(e) => {
                              if (!shouldShowGrayscale && !isDetailOutOfStock) {
                                setItemDetailQuantity((prev) => prev + 1)
                              }
                            }}
                            disabled={shouldShowGrayscale || isDetailOutOfStock}
                            className={shouldShowGrayscale || isDetailOutOfStock
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      )}

                      {/* Add Item Button */}
                      <Button
                        className={`flex-1 h-[44px] rounded-lg font-semibold flex items-center justify-center gap-2 ${shouldShowGrayscale || isDetailOutOfStock
                          ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        onClick={(e) => {
                          if (!shouldShowGrayscale && !isDetailOutOfStock) {
                            const variantsToAdd = selectedItemVariations.length > 0
                              ? selectedVariants.filter(variant => getVariantQuantity(variant) > 0)
                              : [null]
                            const hasVariantsToAdd = variantsToAdd && variantsToAdd.length > 0
                            if (selectedItemVariations.length > 0 && !hasVariantsToAdd) return
                            variantsToAdd.forEach((variant, index) => {
                              updateItemQuantity(
                                selectedItem,
                                selectedItemVariations.length > 0 ? getVariantQuantity(variant) : itemDetailQuantity,
                                index === 0 ? e : null,
                                selectedAddons,
                                variant
                              )
                            })
                            setShowItemDetail(false)
                          }
                        }}
                        disabled={shouldShowGrayscale || isDetailOutOfStock}
                      >
                        {isDetailOutOfStock ? (
                          <span>OUT OF STOCK</span>
                        ) : (
                          <>
                            <span>Add item</span>
                            <div className="flex items-center gap-1">
                              <span className="text-base font-bold">
                                ₹{Math.round(calculateTotalPrice())}
                              </span>
                            </div>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Schedule Delivery Time Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showScheduleSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowScheduleSheet(false)}
                />

                {/* Schedule Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[60vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.15, type: "spring", damping: 30, stiffness: 400 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close Button - Centered Overlapping */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <button
                      onClick={() => setShowScheduleSheet(false)}
                      className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 pt-10 pb-4">
                    {/* Title */}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                      Select your delivery time
                    </h2>

                    {/* Date Selection */}
                    <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                      {(() => {
                        const today = new Date()
                        const tomorrow = new Date(today)
                        tomorrow.setDate(tomorrow.getDate() + 1)
                        const dayAfter = new Date(today)
                        dayAfter.setDate(dayAfter.getDate() + 2)

                        const dates = [
                          { date: today, label: "Today" },
                          { date: tomorrow, label: "Tomorrow" },
                          { date: dayAfter, label: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }) }
                        ]

                        return dates.map((item, index) => {
                          const dateStr = item.date.toISOString().split('T')[0]
                          const day = String(item.date.getDate()).padStart(2, '0')
                          const month = item.date.toLocaleDateString('en-US', { month: 'short' })
                          const isSelected = selectedDate === dateStr

                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedDate(dateStr)}
                              className="flex flex-col items-center gap-0.5 flex-shrink-0 pb-1"
                            >
                              <span className={`text-sm font-medium ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                {day} {month} {item.label}
                              </span>
                              {isSelected && (
                                <div className="h-0.5 w-full bg-red-500 mt-0.5" />
                              )}
                            </button>
                          )
                        })
                      })()}
                    </div>

                    {/* Time Slot Selection */}
                    <div className="space-y-2 mb-4">
                      {["6:30 - 7 PM", "7 - 7:30 PM", "7:30 - 8 PM", "8 - 8:30 PM"].map((slot, index) => {
                        const isSelected = selectedTimeSlot === slot
                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${isSelected
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                              : "bg-white dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                              }`}
                          >
                            <span className="text-sm font-medium">{slot}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Confirm Button - Fixed at bottom */}
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    <Button
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold"
                      onClick={() => {
                        setShowScheduleSheet(false)
                        // Handle schedule confirmation
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Offers Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showOffersSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowOffersSheet(false)}
                />

                {/* Offers Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                  style={{ willChange: "transform" }}
                >
                  {/* Header */}
                  <div className="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Offers at {cafe?.name || "Unknown Cafe"}
                    </h2>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {/* Gold Exclusive Offer Section */}
                    {cafe?.cafeOffers?.goldOffer && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          {cafe.cafeOffers.goldOffer?.title || "Gold exclusive offer"}
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Lock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                {cafe.cafeOffers.goldOffer?.description || "Free delivery above ₹99"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {cafe.cafeOffers.goldOffer?.unlockText || "join Gold to unlock"}
                              </p>
                            </div>
                          </div>
                          <Button
                            className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap"
                            onClick={() => {
                              // Handle add gold
                            }}
                          >
                            {cafe.cafeOffers.goldOffer?.buttonText || "Add Gold - ₹1"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Cafe Coupons Section */}
                    {cafe?.cafeOffers?.coupons && Array.isArray(cafe.cafeOffers.coupons) && cafe.cafeOffers.coupons.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Cafe coupons
                        </h3>
                        <div className="space-y-3">
                          {cafe.cafeOffers.coupons.map((coupon) => {
                            const isExpanded = expandedCoupons.has(coupon.id)
                            return (
                              <div
                                key={coupon.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                              >
                                <button
                                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                  onClick={() => {
                                    setExpandedCoupons((prev) => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(coupon.id)) {
                                        newSet.delete(coupon.id)
                                      } else {
                                        newSet.add(coupon.id)
                                      }
                                      return newSet
                                    })
                                  }}
                                >
                                  <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <div className="flex-1 text-left">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                      {coupon.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Use code {coupon.code}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Copy code to clipboard
                                        navigator.clipboard.writeText(coupon.code)
                                      }}
                                    >
                                      {coupon.code}
                                    </button>
                                    <ChevronDown
                                      className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""
                                        }`}
                                    />
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      Terms and conditions apply
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
                    <Button
                      variant="outline"
                      className="w-full bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white border-0 flex items-center justify-center gap-2 py-3 rounded-lg"
                      onClick={() => setShowOffersSheet(false)}
                    >
                      <X className="h-5 w-5" />
                      Close
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Menu Options Bottom Sheet - Rendered via Portal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showMenuOptionsSheet && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/40 z-[9999]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowMenuOptionsSheet(false)}
                />

                {/* Menu Options Bottom Sheet */}
                <motion.div
                  className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[70vh] md:max-h-[90vh] md:max-w-lg w-full md:w-auto flex flex-col"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.2, type: "spring", damping: 30, stiffness: 400 }}
                  style={{ willChange: "transform" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {cafe?.name || "Unknown Cafe"}
                    </h2>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {/* Menu Options List */}
                    <div className="space-y-1">
                      {/* Add to Collection */}
                      <button
                        className="w-full flex items-center gap-4 px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                        onClick={handleAddToCollection}
                      >
                        <Bookmark className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        <span className="text-base text-gray-900 dark:text-white">
                          {isFavorite(cafe?.slug || slug || "") ? "Remove from Collection" : "Add to Collection"}
                        </span>
                      </button>
                      {/* Share this cafe */}
                      <button
                        className="w-full flex items-center gap-4 px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                        onClick={handleShareCafe}
                      >
                        <Share2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        <span className="text-base text-gray-900 dark:text-white">Share this cafe</span>
                      </button>
                    </div>

                    {/* Disclaimer Text */}
                    <div className="mt-6 px-2">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Menu items, prices, photos and descriptions are set directly by the cafe. In case you see any incorrect information, please report it to us.
                      </p>
                    </div>
                  </div>

                  {/* Bottom Handle */}
                  <div className="px-4 pb-2 pt-2 flex justify-center">
                    <div className="h-1 w-12 bg-gray-300 rounded-full" />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      <AddToCartAnimation
        bottomOffset={shouldShowInlineViewCartButton ? 88 : 100}
        linkTo="/cart"
        hideOnPages={true}
      />

      {/* ── Custom Share Sheet (fallback when navigator.share is unavailable) ── */}
      {shareSheetData && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center"
          onClick={() => setShareSheetData(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-2xl shadow-2xl p-5 pb-8"
            style={{ animation: 'slideUp 0.25s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center mb-4">
              <div className="h-1 w-10 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Share via
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 truncate">
              {shareSheetData.title}
            </p>

            {/* Social options grid */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareSheetData.text + ' ' + shareSheetData.url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5"
                onClick={() => setShareSheetData(null)}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#25D366] flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">WhatsApp</span>
              </a>

              {/* Telegram */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareSheetData.url)}&text=${encodeURIComponent(shareSheetData.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5"
                onClick={() => setShareSheetData(null)}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#2AABEE] flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Telegram</span>
              </a>

              {/* X (Twitter) */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareSheetData.text)}&url=${encodeURIComponent(shareSheetData.url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5"
                onClick={() => setShareSheetData(null)}
              >
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">X</span>
              </a>

              {/* Copy Link */}
              <button
                className="flex flex-col items-center gap-1.5"
                onClick={async () => {
                  await copyToClipboard(shareSheetData.url)
                  setShareSheetData(null)
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-gray-600 dark:stroke-gray-300" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Copy link</span>
              </button>
            </div>

            {/* URL preview bar */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5">
              <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate">{shareSheetData.url}</span>
              <button
                className="text-xs font-medium text-green-600 shrink-0"
                onClick={async () => {
                  await copyToClipboard(shareSheetData.url)
                  setShareSheetData(null)
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
