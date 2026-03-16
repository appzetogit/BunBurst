import { useState, useEffect, useRef, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Truck, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import { useOrders } from "../../context/OrdersContext"
import { useLocation as useUserLocation } from "../../hooks/useLocation"
import { useZone } from "../../hooks/useZone"
import { orderAPI, cafeAPI, adminAPI, userAPI, API_ENDPOINTS, zoneAPI, couponAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { initRazorpayPayment } from "@/lib/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import { useLocationSelector } from "../../components/UserLayout"


// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    return address.formattedAddress
  }

  // Priority 2: Build address from parts
  const addressParts = []
  if (address.street) addressParts.push(address.street)
  if (address.additionalDetails) addressParts.push(address.additionalDetails)
  if (address.city) addressParts.push(address.city)
  if (address.state) addressParts.push(address.state)
  if (address.zipCode) addressParts.push(address.zipCode)

  if (addressParts.length > 0) {
    return addressParts.join(', ')
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const formatAmount = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "0.00"
  return amount.toFixed(2)
}

export default function Cart() {
  const navigate = useNavigate()

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    console.error('? CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    // Return early with error message
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Cart Error</h2>
          <p className="text-muted-foreground">
            Cart functionality is not available. Please refresh the page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const { cart, updateQuantity, updateCartItem, addToCart, getCartCount, clearCart, cleanCartForCafe } = cartContext;
  const { getDefaultAddress, getDefaultPaymentMethod, addresses, paymentMethods, userProfile } = useProfile()
  const { createOrder } = useOrders()
  const { openLocationSelector } = useLocationSelector()
  const { location: userLocation, setManualLocation } = useUserLocation()

  // Custom addon states
  const [selectedItemForAddons, setSelectedItemForAddons] = useState(null)
  const [categoryAddons, setCategoryAddons] = useState([])
  const [loadingCategoryAddons, setLoadingCategoryAddons] = useState(false)
  const [showAddonModal, setShowAddonModal] = useState(false)
  const [selectedAddonsMap, setSelectedAddonsMap] = useState({})
  const [publicCategories, setPublicCategories] = useState([])

  const normalizeCategoryKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, " ")

  const singularize = (text) => {
    if (!text) return text
    if (text.endsWith("ies") && text.length > 4) return `${text.slice(0, -3)}y`
    if (text.endsWith("es") && text.length > 3) return text.slice(0, -2)
    if (text.endsWith("s") && text.length > 2) return text.slice(0, -1)
    return text
  }

  const isFuzzyCategoryMatch = (hint, target) => {
    const a = normalizeCategoryKey(hint)
    const b = normalizeCategoryKey(target)
    if (!a || !b) return false
    if (a === b) return true
    if (singularize(a) === singularize(b)) return true
    if (a.length >= 4 && b.includes(a)) return true
    if (b.length >= 4 && a.includes(b)) return true
    return false
  }

  const categoryLookup = useMemo(() => {
    const byId = new Map()
    const byName = new Map()
    const bySlug = new Map()
    const entries = []

      ; (publicCategories || []).forEach((category) => {
        const resolvedId = category?._id || category?.id
        if (!resolvedId) return
        const normalizedId = String(resolvedId)
        byId.set(normalizedId, normalizedId)

        if (category?.name) {
          byName.set(normalizeCategoryKey(category.name), normalizedId)
        }
        if (category?.slug) {
          bySlug.set(normalizeCategoryKey(category.slug), normalizedId)
        }
        entries.push({
          id: normalizedId,
          name: category?.name || "",
          slug: category?.slug || "",
        })
      })

    return { byId, byName, bySlug, entries }
  }, [publicCategories])

  const resolveCategoryIdForItem = (item) => {
    // Prefer explicit category names first (category/categoryName/sectionName),
    // because item.categoryId can be stale or cafe-side and may not map
    // to the intended global admin category for addons.
    const primaryNameCandidates = [
      item?.category,
      item?.category?.name,
      item?.categoryName,
      item?.sectionName,
      item?.section,
    ]

    for (const nameCandidate of primaryNameCandidates) {
      if (!nameCandidate) continue
      const normalizedName = normalizeCategoryKey(nameCandidate)
      if (!normalizedName) continue

      const mappedId =
        categoryLookup.byName.get(normalizedName) ||
        categoryLookup.bySlug.get(normalizeCategoryKey(String(nameCandidate)))
      if (mappedId) return mappedId

      const fuzzyMatched = categoryLookup.entries.find((entry) =>
        isFuzzyCategoryMatch(normalizedName, entry.name) ||
        isFuzzyCategoryMatch(normalizedName, entry.slug),
      )
      if (fuzzyMatched?.id) return fuzzyMatched.id
    }

    const directCandidates = [
      item?.categoryId,
      item?.category?._id,
      item?.category?.id,
    ]

    for (const candidate of directCandidates) {
      if (!candidate) continue
      const normalizedCandidate = String(candidate).trim()
      if (!normalizedCandidate) continue

      if (categoryLookup.byId.has(normalizedCandidate)) {
        return categoryLookup.byId.get(normalizedCandidate)
      }

      const byNameOrSlug =
        categoryLookup.bySlug.get(normalizeCategoryKey(normalizedCandidate)) ||
        categoryLookup.byName.get(normalizeCategoryKey(normalizedCandidate))
      if (byNameOrSlug) return byNameOrSlug

      // IMPORTANT:
      // Cart items may carry cafe/menu-side category ObjectIds which are
      // different from admin global category ids used by addons.
      // So only trust raw ObjectId fallback when we don't have public category
      // mappings loaded yet.
      if (
        /^[a-fA-F0-9]{24}$/.test(normalizedCandidate) &&
        categoryLookup.entries.length === 0
      ) {
        return normalizedCandidate
      }
    }

    const nameCandidates = [item?.name]

    for (const nameCandidate of nameCandidates) {
      if (!nameCandidate) continue
      const normalizedName = normalizeCategoryKey(nameCandidate)
      if (!normalizedName) continue

      const mappedId =
        categoryLookup.byName.get(normalizedName) ||
        categoryLookup.bySlug.get(normalizedName)
      if (mappedId) return mappedId

      const fuzzyMatched = categoryLookup.entries.find((entry) =>
        isFuzzyCategoryMatch(normalizedName, entry.name) ||
        isFuzzyCategoryMatch(normalizedName, entry.slug),
      )
      if (fuzzyMatched?.id) return fuzzyMatched.id
    }

    return null
  }

  useEffect(() => {
    const fetchPublicCategories = async () => {
      try {
        const response = await adminAPI.getPublicCategories()
        const categories = response?.data?.data?.categories || []
        setPublicCategories(categories)
      } catch (error) {
        console.error("Error fetching public categories for addons:", error)
      }
    }

    fetchPublicCategories()
  }, [])

  // Addon Customization Handlers
  const handleOpenAddons = async (item, preResolvedCategoryId = null) => {
    setSelectedItemForAddons(item)
    const categoryId = preResolvedCategoryId || resolveCategoryIdForItem(item)

    if (!categoryId) {
      toast.error("This item doesn't support addon customization")
      return
    }

    try {
      setLoadingCategoryAddons(true)
      setShowAddonModal(true)

      // Initialize selected addons from item
      const initialMap = {}
      const existingAddons = item.selectedAddons || item.addons || []
      existingAddons.forEach(a => {
        initialMap[a.addonId] = true
      })
      setSelectedAddonsMap(initialMap)

      const response = await adminAPI.getAddonsByCategory(categoryId)
      if (response.data.success) {
        setCategoryAddons(response.data.data.addons || [])
      }
    } catch (error) {
      console.error("Error fetching addons:", error)
      toast.error("Failed to load addons")
    } finally {
      setLoadingCategoryAddons(false)
    }
  }

  const handleToggleAddon = (addonId) => {
    setSelectedAddonsMap(prev => ({
      ...prev,
      [addonId]: !prev[addonId]
    }))
  }

  const handleSaveAddons = () => {
    if (!selectedItemForAddons) return

    const selectedList = categoryAddons
      .filter(a => selectedAddonsMap[a.id || a._id])
      .map(a => ({
        addonId: a.id || a._id,
        name: a.name,
        price: a.price
      }))

    const addonsTotal = selectedList.reduce((sum, a) => sum + (a.price || 0), 0)

    updateCartItem(selectedItemForAddons.id, {
      addons: selectedList, // Keep for backward compatibility
      selectedAddons: selectedList, // New field as requested
      price: (selectedItemForAddons.basePrice || selectedItemForAddons.price) + addonsTotal
    })

    setShowAddonModal(false)
    setSelectedItemForAddons(null)
    toast.success("Item customized successfully!")
  }

  const currentAddonsTotal = useMemo(() => {
    return categoryAddons
      .filter(a => selectedAddonsMap[a.id || a._id])
      .reduce((sum, a) => sum + (a.price || 0), 0)
  }, [categoryAddons, selectedAddonsMap])
  const { location: currentLocation } = useUserLocation() // Get live location address
  const { zoneId } = useZone(currentLocation) // Get user's zone

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("razorpay") // razorpay | cash | wallet
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [note, setNote] = useState("")
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [selectedAddressLabel, setSelectedAddressLabel] = useState(() => {
    return localStorage.getItem("userDeliveryAddressLabel") || "Location"
  })

  // Keep the selected label in sync when the location selector overlay saves/chooses an address.
  useEffect(() => {
    const handleLabelChange = (e) => {
      const nextLabel = e?.detail?.label
      if (!nextLabel) return
      setSelectedAddressLabel(nextLabel)
      localStorage.setItem("userDeliveryAddressLabel", nextLabel)
    }

    window.addEventListener("userDeliveryLabelChanged", handleLabelChange)
    return () => {
      window.removeEventListener("userDeliveryLabelChanged", handleLabelChange)
    }
  }, [])


  // Cafe and pricing state
  const [cafeData, setCafeData] = useState(null)
  const [loadingCafe, setLoadingCafe] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)

  // Addons state
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)

  // Fee settings from database (used as fallback if pricing not available)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
  })


  const cartCount = getCartCount()
  const savedAddress = getDefaultAddress()

  // Memoize defaultAddress so it keeps the same object reference between renders
  // as long as the actual address values haven't changed.
  // Without this, a new object is created every render ? the pricing useEffect
  // fires on EVERY state change (including setIsPlacingOrder), causing extra API calls.
  const addressKey = [
    currentLocation?.formattedAddress,
    currentLocation?.latitude,
    currentLocation?.longitude,
    currentLocation?.city,
    currentLocation?.state,
    savedAddress?.street,
    savedAddress?.city,
    savedAddress?.state,
    savedAddress?.zipCode,
  ].join('|')

  const defaultAddress = useMemo(() => {
    if (currentLocation?.formattedAddress && currentLocation.formattedAddress !== "Select location") {
      return {
        ...savedAddress,
        formattedAddress: currentLocation.formattedAddress,
        address: currentLocation.address || currentLocation.formattedAddress,
        street: currentLocation.street || currentLocation.address,
        city: currentLocation.city,
        state: currentLocation.state,
        zipCode: currentLocation.postalCode,
        area: currentLocation.area,
        location: currentLocation.latitude && currentLocation.longitude ? {
          coordinates: [currentLocation.longitude, currentLocation.latitude]
        } : savedAddress?.location
      }
    }
    return savedAddress ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey])

  const defaultPayment = getDefaultPaymentMethod()

  // Get cafe ID from cart or cafe data
  // Priority: cafeData > cart[0].cafeId
  // DO NOT use cart[0].cafe as slug fallback - it creates wrong slugs
  const cafeId = cart.length > 0
    ? (cafeData?._id || cafeData?.cafeId || cart[0]?.cafeId || null)
    : null

  // Extract unique category IDs from cart items to fetch matching global addons.
  const cartCategoryIds = useMemo(() => {
    const unique = new Set()
    cart.forEach((item) => {
      const resolvedCategoryId = resolveCategoryIdForItem(item)
      if (resolvedCategoryId) unique.add(String(resolvedCategoryId))
    })
    return Array.from(unique)
  }, [cart, categoryLookup])

  // Stable fingerprint of the cart � changes only when items/quantities actually change.
  // Used as a dep instead of the raw `cart` array to avoid re-firing effects on
  // reference-identity changes (e.g. context re-renders that produce a new array).
  const cartKey = useMemo(
    () => cart.map(i => `${i.id}:${i.quantity}:${(i.price || 0).toFixed(2)}`).join('|'),
    [cart]
  )

  // Use backend pricing if available, otherwise fallback to database settings
  const subtotal = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  const deliveryFee = pricing?.deliveryFee ?? (subtotal >= feeSettings.freeDeliveryThreshold || appliedCoupon?.freeDelivery ? 0 : feeSettings.deliveryFee)
  const platformFee = pricing?.platformFee || feeSettings.platformFee
  const gstCharges = pricing?.tax || Math.round(subtotal * (feeSettings.gstRate / 100))
  const discount = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0)
  
  // Calculate original price (crossed-out amount) using GST on full subtotal
  // This ensures the crossed-out price (e.g. 622) doesn't change when a coupon reduces the tax (e.g. to 619)
  const originalGst = Math.round(subtotal * (feeSettings.gstRate / 100))
  const originalDeliveryFee = subtotal >= feeSettings.freeDeliveryThreshold ? 0 : feeSettings.deliveryFee
  const totalBeforeDiscount = subtotal + originalDeliveryFee + platformFee + originalGst
  
  const total = pricing?.total || (totalBeforeDiscount - discount)
  const savings = pricing?.savings || discount



  // ── Share cart via native OS share sheet (WhatsApp, Instagram, etc.) ──
  const handleShareCart = async () => {
    const cafeSlug = cafeData?.slug || cafeName || 'cafe'
    const shareUrl = `${window.location.origin}/user/cafes/${cafeSlug}`
    const itemNames = cart.map(i => i.name).join(', ')
    const shareTitle = `Check out my order from ${cafeData?.name || cafeSlug}!`
    const shareText = `I'm ordering ${itemNames} from ${cafeData?.name || cafeSlug}. Try it too! ???`
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
      } catch (err) {
        if (err?.name !== 'AbortError') console.error('Share failed:', err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareUrl}\n${shareText}`)
        toast.success('Link copied to clipboard!')
      } catch {
        toast.error('Unable to share. Please copy the link manually.')
      }
    }
  }

  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`

      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  // Fetch cafe data when cart has items
  useEffect(() => {
    const fetchCafeData = async () => {
      if (cart.length === 0) {
        setCafeData(null)
        return
      }

      // If we already have cafeData, don't fetch again
      if (cafeData) {
        return
      }

      setLoadingCafe(true)

      // Strategy 1: Try using cafeId from cart if available
      if (cart[0]?.cafeId) {
        try {
          const cartCafeId = cart[0].cafeId;
          const cartCafeName = cart[0].cafe;

          console.log("?? Fetching cafe data by cafeId from cart:", cartCafeId)
          const response = await cafeAPI.getCafeById(cartCafeId)
          const data = response?.data?.data?.cafe || response?.data?.cafe

          if (data) {
            // CRITICAL: Validate that fetched cafe matches cart items
            const fetchedCafeId = data.cafeId || data._id?.toString();
            const fetchedCafeName = data.name;

            // Check if cafeId matches
            const cafeIdMatches =
              fetchedCafeId === cartCafeId ||
              data._id?.toString() === cartCafeId ||
              data.cafeId === cartCafeId;

            // Check if cafe name matches (if available in cart)
            const cafeNameMatches =
              !cartCafeName ||
              fetchedCafeName?.toLowerCase().trim() === cartCafeName.toLowerCase().trim();

            if (!cafeIdMatches) {
              console.error('? CRITICAL: Fetched cafe ID does not match cart cafeId!', {
                cartCafeId: cartCafeId,
                fetchedCafeId: fetchedCafeId,
                fetched_id: data._id?.toString(),
                fetched_cafeId: data.cafeId,
                cartCafeName: cartCafeName,
                fetchedCafeName: fetchedCafeName
              });
              // Don't set cafeData if IDs don't match - this prevents wrong cafe assignment
              setLoadingCafe(false);
              return;
            }

            if (!cafeNameMatches) {
              console.warn('?? WARNING: Cafe name mismatch:', {
                cartCafeName: cartCafeName,
                fetchedCafeName: fetchedCafeName
              });
              // Still proceed but log warning
            }

            console.log("? Cafe data loaded from cart cafeId:", {
              _id: data._id,
              cafeId: data.cafeId,
              name: data.name,
              cartCafeId: cartCafeId,
              cartCafeName: cartCafeName
            })
            setCafeData(data)
            setLoadingCafe(false)
            return
          }
        } catch (error) {
          console.warn("?? Failed to fetch by cart cafeId, trying fallback...", error)
        }
      }

      // Strategy 2: If no cafeId in cart, search by cafe name
      if (cart[0]?.cafe && !cafeData) {
        try {
          console.log("?? Searching cafe by name:", cart[0].cafe)
          const searchResponse = await cafeAPI.getCafes({ limit: 100 })
          const cafes = searchResponse?.data?.data?.cafes || searchResponse?.data?.data || []
          console.log("?? Fetched", cafes.length, "cafes for name search")

          // Try exact match first
          let matchingCafe = cafes.find(r =>
            r.name?.toLowerCase().trim() === cart[0].cafe?.toLowerCase().trim()
          )

          // If no exact match, try partial match
          if (!matchingCafe) {
            console.log("?? No exact match, trying partial match...")
            matchingCafe = cafes.find(r =>
              r.name?.toLowerCase().includes(cart[0].cafe?.toLowerCase().trim()) ||
              cart[0].cafe?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }

          if (matchingCafe) {
            // CRITICAL: Validate that the found cafe matches cart items
            const cartCafeName = cart[0]?.cafe?.toLowerCase().trim();
            const foundCafeName = matchingCafe.name?.toLowerCase().trim();

            if (cartCafeName && foundCafeName && cartCafeName !== foundCafeName) {
              console.error("? CRITICAL: Cafe name mismatch!", {
                cartCafeName: cart[0]?.cafe,
                foundCafeName: matchingCafe.name,
                cartCafeId: cart[0]?.cafeId,
                foundCafeId: matchingCafe.cafeId || matchingCafe._id
              });
              // Don't set cafeData if names don't match - this prevents wrong cafe assignment
              setLoadingCafe(false);
              return;
            }

            console.log("? Found cafe by name:", {
              name: matchingCafe.name,
              _id: matchingCafe._id,
              cafeId: matchingCafe.cafeId,
              slug: matchingCafe.slug,
              cartCafeName: cart[0]?.cafe
            })
            setCafeData(matchingCafe)
            setLoadingCafe(false)
            return
          } else {
            console.warn("?? Cafe not found even by name search. Searched in", cafes.length, "cafes")
            if (cafes.length > 0) {
              console.log("?? Available cafe names:", cafes.map(r => r.name).slice(0, 10))
            }
          }
        } catch (searchError) {
          console.warn("?? Error searching cafes by name:", searchError)
        }
      }

      // If all strategies fail, set to null
      setCafeData(null)
      setLoadingCafe(false)
    }

    fetchCafeData()
  }, [cart.length, cart[0]?.cafeId, cart[0]?.cafe])

  // Fetch global admin addons that match cart item categories.
  useEffect(() => {
    const fetchCategoryMatchedAddons = async () => {
      if (cartCategoryIds.length === 0) {
        setAddons([])
        return
      }

      try {
        setLoadingAddons(true)
        const responses = await Promise.all(
          cartCategoryIds.map((categoryId) =>
            adminAPI.getAddonsByCategory(categoryId).catch(() => null),
          ),
        )

        const merged = new Map()
        responses.forEach((response, index) => {
          const categoryId = cartCategoryIds[index]
          const list = response?.data?.data?.addons || []
          list.forEach((addon) => {
            const addonId = String(addon.id || addon._id || "")
            if (!addonId) return
            if (!merged.has(addonId)) {
              merged.set(addonId, {
                ...addon,
                id: addon.id || addon._id,
                matchedCategoryIds: [categoryId],
              })
              return
            }
            const existing = merged.get(addonId)
            merged.set(addonId, {
              ...existing,
              matchedCategoryIds: Array.from(
                new Set([...(existing.matchedCategoryIds || []), categoryId]),
              ),
            })
          })
        })

        setAddons(Array.from(merged.values()))
      } catch (error) {
        console.error("Error fetching category-matched addons:", error)
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    fetchCategoryMatchedAddons()
    // Use stable cartCategoryIds string to avoid re-fires on reference changes
  }, [cartCategoryIds.join(',')])
  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !cafeId) {
        setAvailableCoupons([])
        return
      }

      console.log(`[CART-COUPONS] Fetching coupons for ${cart.length} items in cart`)
      setLoadingCoupons(true)

      const allCoupons = []
      const uniqueCouponCodes = new Set()

      // 1. Fetch Global Coupons
      try {
        const globalResponse = await couponAPI.getActiveCoupons()
        if (globalResponse?.data?.success && globalResponse?.data?.data) {
          globalResponse.data.data.forEach(coupon => {
            if (!uniqueCouponCodes.has(coupon.code)) {
              uniqueCouponCodes.add(coupon.code)
              
              let discountVal = 0;
              let description = "";
              
              if (coupon.discountType === 'flat') {
                discountVal = coupon.discountValue;
                description = `Save ₹${formatAmount(coupon.discountValue)} with '${coupon.code}'`;
              } else {
                discountVal = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscount && discountVal > coupon.maxDiscount) {
                  discountVal = coupon.maxDiscount;
                }
                description = `Get ${coupon.discountValue}% OFF with '${coupon.code}'`;
              }

              allCoupons.push({
                code: coupon.code,
                discount: discountVal,
                discountPercentage: coupon.discountType === 'percentage' ? coupon.discountValue : null,
                minOrder: coupon.minOrderAmount || 0,
                description: description,
                isGlobal: true,
                maxDiscount: coupon.maxDiscount
              })
            }
          })
        }
      } catch (err) {
        console.error("Error fetching global coupons:", err)
      }

      // 2. Fetch coupons for each item in cart
      for (const cartItem of cart) {
        if (!cartItem.id) {
          console.log(`[CART-COUPONS] Skipping item without id:`, cartItem)
          continue
        }

        try {
          console.log(`[CART-COUPONS] Fetching coupons for itemId: ${cartItem.id}, name: ${cartItem.name}`)
          const response = await cafeAPI.getCouponsByItemIdPublic(cafeId, cartItem.id)

          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons
            console.log(`[CART-COUPONS] Found ${coupons.length} coupons for item ${cartItem.id}`)

            // Add coupons, avoiding duplicates
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode)
                // Convert backend coupon format to frontend format
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: coupon.originalPrice - coupon.discountedPrice,
                  discountPercentage: coupon.discountPercentage,
                  minOrder: coupon.minOrderValue || 0,
                  description: `Save ₹${formatAmount(coupon.originalPrice - coupon.discountedPrice)} with '${coupon.couponCode}'`,
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  itemId: cartItem.id,
                  itemName: cartItem.name,
                })
              }
            })
          }
        } catch (error) {
          console.error(`[CART-COUPONS] Error fetching coupons for item ${cartItem.id}:`, error)
        }
      }

      console.log(`[CART-COUPONS] Total unique coupons found: ${allCoupons.length}`, allCoupons)
      setAvailableCoupons(allCoupons)
      setLoadingCoupons(false)
    }

    fetchCouponsForCartItems()
    // Use cartKey (stable fingerprint) + cafeId so we only refetch when
    // cart contents or the cafe actually change – not on every re-render.
  }, [cartKey, cafeId, subtotal])

  // Calculate pricing from backend whenever cart, address, or coupon changes.
  // Uses a 400ms debounce so rapid quantity taps don't fire a request per tap.
  // Skips calculation when restaurantId is not yet resolved, and also skips while
  // an order is being placed (isPlacingOrder) to avoid extra calls on click.
  useEffect(() => {
    if (cart.length === 0 || !defaultAddress) {
      setPricing(null)
      return
    }

    // Skip if cafe hasn't loaded yet � the effect will re-run when it does
    if (!cafeId) return

    // Skip while an order is being placed � no point recalculating mid-placement
    if (isPlacingOrder) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setLoadingPricing(true)
        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false,
          addons: item.addons || []
        }))

        const response = await orderAPI.calculateOrder({
          items,
          cafeId: cafeData?.cafeId || cafeData?._id || cafeId || null,
          deliveryAddress: defaultAddress,
          couponCode: appliedCoupon?.code || couponCode || null
        })

        if (cancelled) return

        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)

          // Update applied coupon if backend returns one
          if (response.data.data.pricing.appliedCoupon && !appliedCoupon) {
            const coupon = availableCoupons.find(c => c.code === response.data.data.pricing.appliedCoupon.code)
            if (coupon) {
              setAppliedCoupon(coupon)
            }
          }
        }
      } catch (error) {
        if (cancelled) return
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error calculating pricing:", error)
        }
        setPricing(null)
      } finally {
        if (!cancelled) setLoadingPricing(false)
      }
    }, 400) // 400ms debounce � batches rapid cart changes into one request

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // addressKey (stable string) replaces defaultAddress object in deps � prevents
    // firing on every render just because a new object reference was created.
    // isPlacingOrder prevents extra call when Place Order button is clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, addressKey, appliedCoupon?.code, couponCode, cafeId, isPlacingOrder])

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true)
        const response = await userAPI.getWallet()
        if (response?.data?.success && response?.data?.data?.wallet) {
          setWalletBalance(response.data.data.wallet.balance || 0)
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error)
        setWalletBalance(0)
      } finally {
        setIsLoadingWallet(false)
      }
    }
    fetchWalletBalance()
  }, [])

  // Fetch fee settings on mount
  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        const response = await adminAPI.getPublicFeeSettings()
        if (response.data.success && response.data.data.feeSettings) {
          setFeeSettings({
            deliveryFee: response.data.data.feeSettings.deliveryFee || 25,
            freeDeliveryThreshold: response.data.data.feeSettings.freeDeliveryThreshold || 149,
            platformFee: response.data.data.feeSettings.platformFee || 5,
            gstRate: response.data.data.feeSettings.gstRate || 5,
          })
        }
      } catch (error) {
        console.error('Error fetching fee settings:', error)
        // Keep default values on error
      }
    }
    fetchFeeSettings()
  }, [])



  // Cafe name from data or cart
  const cafeName = cafeData?.name || cart[0]?.cafe || "Cafe"

  // Handler to select address by label (Home, Office, Other)
  const handleSelectAddressByLabel = async (label) => {
    setSelectedAddressLabel(label)
    localStorage.setItem("userDeliveryAddressLabel", label)
    try {
      // Find address with matching label
      const address = addresses.find(addr => addr.label === label)

      if (!address) {
        toast.info(`Using current location as ${label}`)
        return
      }

      // Get coordinates from address location
      const coordinates = address.location?.coordinates || []
      const longitude = coordinates[0]
      const latitude = coordinates[1]

      if (!latitude || !longitude) {
        toast.error(`Invalid coordinates for ${label} address`)
        return
      }

      // Update the location globally via context
      const locationData = {
        city: address.city,
        state: address.state,
        address: `${address.street}, ${address.city}`,
        area: address.additionalDetails || "",
        zipCode: address.zipCode,
        latitude,
        longitude,
        formattedAddress: address.additionalDetails
          ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
          : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
      }

      setManualLocation(locationData)
      toast.success(`${label} address selected!`)
    } catch (error) {
      console.error(`Error selecting ${label} address:`, error)
      toast.error(`Failed to select ${label} address. Please try again.`)
    }
  }

  const handleApplyCoupon = async (coupon) => {
    if (subtotal >= coupon.minOrder) {
      setAppliedCoupon(coupon)
      setCouponCode(coupon.code)
      // The calculatePricing effect will automatically re-run because
      // appliedCoupon.code and couponCode changed � no manual call needed.
    }
  }


  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null)
    setCouponCode("")
    // The calculatePricing effect will automatically re-run because
    // appliedCoupon.code and couponCode changed � no manual call needed.
  }


  const handlePlaceOrder = async () => {
    if (!defaultAddress) {
      alert("Please add a delivery address")
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)

    // Use API_BASE_URL from config (supports both dev and production)

    try {
      console.log("?? Starting order placement process...")
      console.log("?? Cart items:", cart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })))
      console.log("?? Applied coupon:", appliedCoupon?.code || "None")
      console.log("?? Delivery address:", defaultAddress?.label || defaultAddress?.city)

      // Ensure couponCode is included in pricing
      const orderPricing = pricing || {
        subtotal,
        deliveryFee,
        tax: gstCharges,
        platformFee,
        discount,
        total,
        couponCode: appliedCoupon?.code || null
      };

      // Add couponCode if not present but coupon is applied
      if (!orderPricing.couponCode && appliedCoupon?.code) {
        orderPricing.couponCode = appliedCoupon.code;
      }

      // Include all cart items (main items + addons)
      // Note: Addons are added as separate cart items when user clicks the + button
      const orderItems = cart.map(item => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg !== false,
        addons: item.selectedAddons || item.addons || []
      }))

      console.log("?? Order items to send:", orderItems)
      console.log("?? Order pricing:", orderPricing)

      // Check API base URL before making request (for debugging)
      const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
      console.log("?? Making request to:", fullUrl)
      console.log("?? Authentication token present:", !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken'))

      // CRITICAL: Validate cafe ID before placing order
      // Ensure we're using the correct cafe from cafeData (most reliable)
      const finalCafeId = cafeData?.cafeId || cafeData?._id || null;
      const finalCafeName = cafeData?.name || null;

      if (!finalCafeId) {
        console.error('? CRITICAL: Cannot place order - Cafe ID is missing!');
        console.error('?? Debug info:', {
          cafeData: cafeData ? {
            _id: cafeData._id,
            cafeId: cafeData.cafeId,
            name: cafeData.name
          } : 'Not loaded',
          cartCafeId: cafeId,
          cartCafeName: cart[0]?.cafe,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            cafe: item.cafe,
            cafeId: item.cafeId
          }))
        });
        alert('Error: Cafe information is missing. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // CRITICAL: Validate that ALL cart items belong to the SAME cafe
      const cartCafeIds = cart
        .map(item => item.cafeId)
        .filter(Boolean)
        .map(id => String(id).trim()); // Normalize to string and trim

      const cartCafeNames = cart
        .map(item => item.cafe)
        .filter(Boolean)
        .map(name => name.trim().toLowerCase()); // Normalize names

      // Get unique values (after normalization)
      const uniqueCafeIds = [...new Set(cartCafeIds)];
      const uniqueCafeNames = [...new Set(cartCafeNames)];

      // Check if cart has items from multiple cafes
      // Note: If cafe names match, allow even if IDs differ (same cafe, different ID format)
      if (uniqueCafeNames.length > 1) {
        // Different cafe names = definitely different cafes
        console.error('? CRITICAL ERROR: Cart contains items from multiple cafes!', {
          cafeIds: uniqueCafeIds,
          cafeNames: uniqueCafeNames,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            cafe: item.cafe,
            cafeId: item.cafeId
          }))
        });

        // Automatically clean cart to keep items from the cafe matching cafeData
        if (finalCafeId && finalCafeName) {
          console.log('?? Auto-cleaning cart to keep items from:', finalCafeName);
          cleanCartForCafe(finalCafeId, finalCafeName);
          toast.error('Cart contained items from different cafes. Items from other cafes have been removed.');
        } else {
          // If cafeData is not available, keep items from first cafe in cart
          const firstCafeId = cart[0]?.cafeId;
          const firstCafeName = cart[0]?.cafe;
          if (firstCafeId && firstCafeName) {
            console.log('?? Auto-cleaning cart to keep items from first cafe:', firstCafeName);
            cleanCartForCafe(firstCafeId, firstCafeName);
            toast.error('Cart contained items from different cafes. Items from other cafes have been removed.');
          } else {
            toast.error('Cart contains items from different cafes. Please clear cart and try again.');
          }
        }

        setIsPlacingOrder(false);
        return;
      }

      // If cafe names match but IDs differ, that's OK (same cafe, different ID format)
      // But log a warning in development
      if (uniqueCafeIds.length > 1 && uniqueCafeNames.length === 1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('?? Cart items have different cafe IDs but same name. This is OK if IDs are in different formats.', {
            cafeIds: uniqueCafeIds,
            cafeName: uniqueCafeNames[0]
          });
        }
      }

      // Validate that cart items' cafeId matches the cafeData
      if (cartCafeIds.length > 0) {
        const cartCafeId = cartCafeIds[0];

        // Check if cart cafeId matches cafeData
        const cafeIdMatches =
          cartCafeId === finalCafeId ||
          cartCafeId === cafeData?._id?.toString() ||
          cartCafeId === cafeData?.cafeId;

        if (!cafeIdMatches) {
          console.error('? CRITICAL ERROR: Cart cafeId does not match cafeData!', {
            cartCafeId: cartCafeId,
            finalCafeId: finalCafeId,
            cafeDataId: cafeData?._id?.toString(),
            cafeDataCafeId: cafeData?.cafeId,
            cafeDataName: cafeData?.name,
            cartCafeName: cartCafeNames[0]
          });
          alert(`Error: Cart items belong to "${cartCafeNames[0] || 'Unknown Cafe'}" but cafe data doesn't match. Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Validate cafe name matches
      if (cartCafeNames.length > 0 && finalCafeName) {
        const cartCafeName = cartCafeNames[0];
        if (cartCafeName.toLowerCase().trim() !== finalCafeName.toLowerCase().trim()) {
          console.error('? CRITICAL ERROR: Cafe name mismatch!', {
            cartCafeName: cartCafeName,
            finalCafeName: finalCafeName
          });
          alert(`Error: Cart items belong to "${cartCafeName}" but cafe data shows "${finalCafeName}". Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Log order details for debugging
      console.log('? Order validation passed - Placing order with cafe:', {
        cafeId: finalCafeId,
        cafeName: finalCafeName,
        cafeDataId: cafeData?._id,
        cafeDataCafeId: cafeData?.cafeId,
        cartCafeId: cartCafeIds[0],
        cartCafeName: cartCafeNames[0],
        cartItemCount: cart.length
      });

      // FINAL VALIDATION: Double-check cafeId before sending to backend
      const cartCafeId = cart[0]?.cafeId;
      if (cartCafeId && cartCafeId !== finalCafeId &&
        cartCafeId !== cafeData?._id?.toString() &&
        cartCafeId !== cafeData?.cafeId) {
        console.error('? CRITICAL: Final validation failed - cafeId mismatch!', {
          cartCafeId: cartCafeId,
          finalCafeId: finalCafeId,
          cafeDataId: cafeData?._id?.toString(),
          cafeDataCafeId: cafeData?.cafeId,
          cartCafeName: cart[0]?.cafe,
          finalCafeName: finalCafeName
        });
        alert('Error: Cafe information mismatch detected. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // Resolve zoneId from the delivery address to avoid stale/mismatched zone validation
      let resolvedZoneId = zoneId;
      const addressCoords = defaultAddress?.location?.coordinates;
      if (Array.isArray(addressCoords) && addressCoords.length >= 2) {
        const [addrLng, addrLat] = addressCoords;
        if (addrLat && addrLng) {
          try {
            const zoneResponse = await zoneAPI.detectZone(addrLat, addrLng);
            if (zoneResponse?.data?.success) {
              const zoneData = zoneResponse.data.data;
              if (zoneData?.status === 'IN_SERVICE' && zoneData.zoneId) {
                resolvedZoneId = zoneData.zoneId;
              } else if (zoneData?.status === 'OUT_OF_SERVICE') {
                toast.error('Your delivery address is outside the service zone. Please select a location within the service area.');
                setIsPlacingOrder(false);
                return;
              }
            }
          } catch (zoneError) {
            console.warn('⚠️ Zone detection failed during order placement. Falling back to existing zoneId.', zoneError?.response?.data || zoneError?.message);
          }
        }
      }

      const orderPayload = {
        items: orderItems,
        address: defaultAddress,
        cafeId: finalCafeId,
        cafeName: finalCafeName,
        pricing: orderPricing,
        note: note || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        zoneId: resolvedZoneId // CRITICAL: Pass zoneId for strict zone validation
      };
      // Log final order details (including paymentMethod for COD debugging)
      console.log('?? FINAL: Sending order to backend with:', {
        cafeId: finalCafeId,
        cafeName: finalCafeName,
        itemCount: orderItems.length,
        totalAmount: orderPricing.total,
        paymentMethod: orderPayload.paymentMethod
      });

      // Check wallet balance if wallet payment selected
      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error(`Insufficient wallet balance. Required: ?${formatAmount(total)}, Available: ?${formatAmount(walletBalance)}`)
        setIsPlacingOrder(false)
        return
      }

      // Create order in backend
      const orderResponse = await orderAPI.createOrder(orderPayload)

      console.log("? Order created successfully:", orderResponse.data)

      const { order, razorpay } = orderResponse.data.data

      // Cash flow: order placed without online payment
      if (selectedPaymentMethod === "cash") {
        toast.success("Order placed with Cash on Delivery")
        setPlacedOrderId(order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        clearCart()
        setIsPlacingOrder(false)
        return
      }

      // Wallet flow: order placed with wallet payment (already processed in backend)
      if (selectedPaymentMethod === "wallet") {
        toast.success("Order placed with Wallet payment")
        setPlacedOrderId(order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        clearCart()
        setIsPlacingOrder(false)
        // Refresh wallet balance
        try {
          const walletResponse = await userAPI.getWallet()
          if (walletResponse?.data?.success && walletResponse?.data?.data?.wallet) {
            setWalletBalance(walletResponse.data.data.wallet.balance || 0)
          }
        } catch (error) {
          console.error("Error refreshing wallet balance:", error)
        }
        return
      }

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        console.error("? Razorpay initialization failed:", { razorpay, order })
        throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment")
      }

      console.log("?? Razorpay order created:", {
        orderId: razorpay.orderId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        keyPresent: !!razorpay.key
      })

      // Get user info for Razorpay prefill
      const userInfo = userProfile || {}
      const userPhone = userInfo.phone || defaultAddress?.phone || ""
      const userEmail = userInfo.email || ""
      const userName = userInfo.name || ""

      // Format phone number (remove non-digits, take last 10 digits)
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)

      console.log("?? User info for payment:", {
        name: userName,
        email: userEmail,
        phone: formattedPhone
      })

      // Get company name for Razorpay
      const companyName = await getCompanyNameAsync()

      // Initialize Razorpay payment
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount, // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: companyName,
        description: `Order ${order.orderId} - ?${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order.orderId,
          userId: userInfo.id || "",
          cafeId: cafeId || "unknown"
        },
        handler: async (response) => {
          try {
            console.log("? Payment successful, verifying...", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })

            // Verify payment with backend
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            console.log("? Payment verification response:", verifyResponse.data)

            if (verifyResponse.data.success) {
              // Payment successful
              console.log("?? Order placed successfully:", {
                orderId: order.orderId,
                paymentId: verifyResponse.data.data?.payment?.paymentId
              })
              setPlacedOrderId(order.orderId)
              setShowOrderSuccess(true)
              clearCart()
              setIsPlacingOrder(false)
            } else {
              throw new Error(verifyResponse.data.message || "Payment verification failed")
            }
          } catch (error) {
            console.error("? Payment verification error:", error)
            const errorMessage = error?.response?.data?.message || error?.message || "Payment verification failed. Please contact support."
            alert(errorMessage)
            setIsPlacingOrder(false)
          }
        },
        onError: (error) => {
          console.error("? Razorpay payment error:", error)
          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || "Payment failed. Please try again."
            alert(errorMessage)
          }
          setIsPlacingOrder(false)
        },
        onClose: () => {
          console.log("?? Payment modal closed by user")
          setIsPlacingOrder(false)
        }
      })
    } catch (error) {
      console.error("? Order creation error:", error)

      let errorMessage = "Failed to create order. Please try again."

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const backendUrl = API_BASE_URL.replace('/api', '');
        errorMessage = `Network Error: Cannot connect to backend server.\n\n` +
          `Expected backend URL: ${backendUrl}\n\n` +
          `Please check:\n` +
          `1. Backend server is running\n` +
          `2. Backend is accessible at ${backendUrl}\n` +
          `3. Check browser console (F12) for more details\n\n` +
          `If backend is not running, start it with:\n` +
          `cd appzetofood/backend && npm start`

        console.error("?? Network Error Details:", {
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config?.baseURL + error.config?.url,
            method: error.config?.method
          },
          backendUrl: backendUrl,
          apiBaseUrl: API_BASE_URL
        })

        // Try to test backend connectivity
        try {
          fetch(backendUrl + '/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
            .then(response => {
              if (response.ok) {
                console.log("? Backend health check passed - server is running")
              } else {
                console.warn("?? Backend health check returned:", response.status)
              }
            })
            .catch(fetchError => {
              console.error("? Backend health check failed:", fetchError.message)
              console.error("?? Make sure backend server is running at:", backendUrl)
            })
        } catch (fetchTestError) {
          console.error("? Could not test backend connectivity:", fetchTestError.message)
        }
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond. Please try again."
      }
      // Handle other axios errors
      else if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
      }
      // Handle other errors
      else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)
      setIsPlacingOrder(false)
    }
  }

  const handleGoToOrders = () => {
    setShowOrderSuccess(false)
    navigate(`/user/orders/${placedOrderId}?confirmed=true`)
  }

  // Empty cart state - but don't show if order success or placing order modal is active
  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return (
      <AnimatedPage className="min-h-screen bg-background">
        <div className="bg-card border-b border-border sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link onClick={() => navigate(-1)}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </Button>
            </Link>
            <span className="font-semibold text-foreground">Cart</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mb-4 text-center">Add items from a cafe to start a new order</p>
          <Link to="/">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Browse Cafes</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header - Sticky at top */}
      <div className="bg-card border-b border-border sticky top-0 z-20 flex-shrink-0">
        <div className="w-full lg:max-w-[1100px] mx-auto">
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Link onClick={() => navigate(-1)}>
                <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0">
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
                </Button>
              </Link>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground">{cafeName}</p>
                <p className="text-sm md:text-base font-medium text-foreground truncate">
                  {cafeData?.estimatedDeliveryTime || "10-15 mins"} to <span className="font-semibold">Location</span>
                  <span className="text-muted-foreground ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" onClick={handleShareCart}>
              <Share2 className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-32">
        {/* Savings Banner */}
        {((appliedCoupon || pricing?.appliedCoupon) && savings > 0) && (
          <div className="bg-primary/10 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
            <div className="w-full lg:max-w-[1100px] mx-auto">
              <p className="text-sm md:text-base font-medium text-primary">
                You saved ₹{formatAmount(savings)} on this order
              </p>
            </div>
          </div>
        )}

        <div className="w-full lg:max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 px-4 md:px-6 py-4 md:py-6">
            {/* Left Column - Cart Items and Details */}
            <div className="lg:col-span-2 space-y-2 md:space-y-4 lg:space-y-5">
              {/* Cart Items */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl lg:border lg:border-border lg:shadow-sm">
                <div className="space-y-3 md:space-y-4">
                  {cart.map((item) => {
                    const resolvedCategoryId = resolveCategoryIdForItem(item)
                    return (
                      <div key={item.id} className="flex items-start gap-3 md:gap-4">
                        {/* Veg/Non-veg indicator */}
                        <div className={`w-4 h-4 md:w-5 md:h-5 border-2 ${item.isVeg !== false ? 'border-green-600' : 'border-red-600'} flex items-center justify-center mt-1 flex-shrink-0`}>
                          <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${item.isVeg !== false ? 'bg-green-600' : 'bg-red-600'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base font-medium text-foreground leading-tight">{item.name}</p>
                          {(item.selectedAddons || item.addons) && (item.selectedAddons || item.addons).length > 0 && (
                            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                              {(item.selectedAddons || item.addons).map(a => a.name).join(", ")}
                            </p>
                          )}
                          {resolvedCategoryId && (
                            <button
                              onClick={() => handleOpenAddons(item, resolvedCategoryId)}
                              className="text-[10px] md:text-xs text-orange-600 font-bold flex items-center gap-1 mt-1.5 hover:text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 transition-all active:scale-95"
                            >
                              <Sparkles className="h-3 w-3" />
                              Customize
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                          {/* Quantity controls */}
                          <div className="flex items-center border border-primary rounded">
                            <button
                              className="px-2 md:px-3 py-1 text-primary hover:bg-primary/10"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                            <span className="px-2 md:px-3 text-sm md:text-base font-semibold text-primary min-w-[20px] md:min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              className="px-2 md:px-3 py-1 text-primary hover:bg-primary/10"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                          </div>

                          <p className="text-sm md:text-base font-medium text-foreground min-w-[50px] md:min-w-[70px] text-right">
                            ₹{Math.round((item.price || 0) * (item.quantity || 1))}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add more items */}
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 mt-4 md:mt-6 text-primary"
                >
                  <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-sm md:text-base font-medium">Add more items</span>
                </button>
              </div>


              {/* Note & Cutlery */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <div className="flex-1 flex flex-col">
                    <button
                      onClick={() => setShowNoteInput(!showNoteInput)}
                      className="w-full flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-border rounded-lg md:rounded-xl text-sm md:text-base text-muted-foreground hover:bg-muted"
                    >
                      <FileText className="h-4 w-4 md:h-5 md:w-5" />
                      <span className="truncate">{note || "Add a note for the cafe"}</span>
                    </button>

                    {/* Note Input (opens right below the note button) */}
                    {showNoteInput && (
                      <div className="mt-3">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add cooking instructions, allergies, etc."
                          className="w-full border border-border rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-primary bg-background text-foreground"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSendCutlery(!sendCutlery)}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-border text-muted-foreground' : 'border-primary text-primary bg-primary/10'}`}
                  >
                    <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="whitespace-nowrap">{sendCutlery ? "Don't send cutlery" : "No cutlery"}</span>
                  </button>
                </div>
              </div>

              {/* Complete your meal section - Approved Addons */}
              {addons.length > 0 && (
                <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-muted rounded flex items-center justify-center">
                      <span className="text-xs md:text-base">???</span>
                    </div>
                    <span className="text-sm md:text-base font-semibold text-foreground">Complete your meal with</span>
                  </div>
                  {loadingAddons ? (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                          <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {addons.map((addon) => (
                        <div key={addon.id || addon._id} className="flex-shrink-0 w-28 md:w-36">
                          <div className="relative bg-muted rounded-lg md:rounded-xl overflow-hidden">
                            <img
                              src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                              alt={addon.name}
                              className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl"
                              onError={(e) => {
                                e.target.onerror = null
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                              }}
                            />
                            <div className="absolute top-1 md:top-2 left-1 md:left-2">
                              {/* Veg Indicator */}
                              <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-white border border-green-600 flex items-center justify-center rounded">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-600" />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // Use cafe info from existing cart items to ensure format consistency
                                const cartCafeId = cart[0]?.cafeId || cafeId;
                                const cartCafeName = cart[0]?.cafe || cafeName;

                                if (!cartCafeId || !cartCafeName) {
                                  console.error('? Cannot add addon: Missing cafe information', {
                                    cartCafeId,
                                    cartCafeName,
                                    cafeId,
                                    cafeName,
                                    cartItem: cart[0]
                                  });
                                  toast.error('Cafe information is missing. Please refresh the page.');
                                  return;
                                }

                                addToCart({
                                  id: addon.id || addon._id,
                                  name: addon.name,
                                  price: addon.price,
                                  image: addon.image || (addon.images && addon.images[0]) || "",
                                  description: addon.description || "",
                                  isVeg: true,
                                  cafe: cartCafeName,
                                  cafeId: cartCafeId
                                });
                              }}
                              className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-card border border-primary rounded flex items-center justify-center shadow-sm hover:bg-primary/10 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm font-medium text-foreground mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                          {addon.description && (
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-1">{addon.description}</p>
                          )}
                          <p className="text-xs md:text-sm text-foreground font-semibold mt-0.5">₹{formatAmount(addon.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg md:rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Tag className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      <div>
                        <p className="text-sm md:text-base font-medium text-primary">'{appliedCoupon.code}' applied</p>
                        <p className="text-xs md:text-sm text-primary/80">You saved ₹{formatAmount(discount)}</p>
                      </div>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-muted-foreground text-xs md:text-sm font-medium">Remove</button>
                  </div>
                ) : loadingCoupons ? (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <p className="text-sm md:text-base text-muted-foreground">Loading coupons...</p>
                  </div>
                ) : availableCoupons.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Percent className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm md:text-base font-medium text-foreground">
                            Save ₹{formatAmount(availableCoupons[0].discount)} with '{availableCoupons[0].code}'
                          </p>
                          {availableCoupons.length > 1 && (
                            <button onClick={() => setShowCoupons(!showCoupons)} className="text-xs md:text-sm text-primary font-medium">
                              View all coupons ?
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-xs md:text-sm border-primary text-primary hover:bg-primary/10"
                        onClick={() => handleApplyCoupon(availableCoupons[0])}
                        disabled={subtotal < availableCoupons[0].minOrder}
                      >
                        {subtotal < availableCoupons[0].minOrder ? `Min ₹${formatAmount(availableCoupons[0].minOrder)}` : 'APPLY'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <p className="text-sm md:text-base text-muted-foreground">No coupons available</p>
                  </div>
                )}

                {/* Coupons List */}
                {showCoupons && !appliedCoupon && availableCoupons.length > 0 && (
                  <div className="mt-3 md:mt-4 space-y-2 md:space-y-3 border-t border-border pt-3 md:pt-4">
                    {availableCoupons.map((coupon) => (
                      <div key={coupon.code} className="flex items-center justify-between py-2 md:py-3 border-b border-dashed border-border last:border-0">
                        <div>
                          <p className="text-sm md:text-base font-medium text-foreground">{coupon.code}</p>
                          <p className="text-xs md:text-sm text-muted-foreground">{coupon.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 md:h-7 text-xs md:text-sm border-primary text-primary hover:bg-primary/10"
                          onClick={() => handleApplyCoupon(coupon)}
                          disabled={subtotal < coupon.minOrder}
                        >
                          {subtotal < coupon.minOrder ? `Min ₹${formatAmount(coupon.minOrder)}` : 'APPLY'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Time */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm md:text-base text-foreground">Delivery in <span className="font-semibold">{cafeData?.estimatedDeliveryTime || "10-15 mins"}</span></p>
                  </div>
                </div>
              </div>


              {/* Delivery Address */}
              <div
                className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={openLocationSelector}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4 w-full">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between w-full">
                        <p className="text-sm md:text-base text-foreground">
                          Delivery at <span className="font-semibold">{selectedAddressLabel}</span>
                        </p>
                        <span className="text-primary font-medium text-xs md:text-sm">Edit</span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Add delivery address") : "Add delivery address"}
                      </p>
                      {/* Address Selection Buttons */}
                      <div className="flex gap-2 mt-2">
                        {["Home", "Office", "Other"].map((label) => {
                          const addressExists = addresses.some(addr => addr.label === label)
                          const isActive = selectedAddressLabel === label
                          return (
                            <button
                              key={label}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleSelectAddressByLabel(label)
                              }}

                              className={`text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md border transition-all duration-200 ${isActive
                                ? 'border-primary text-primary bg-primary/10 shadow-sm scale-110'
                                : addressExists
                                  ? 'border-border text-foreground hover:bg-muted bg-card'
                                  : 'border-border/30 text-muted-foreground/60 bg-muted/50 hover:bg-muted'
                                }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <Link to="/user/profile" className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <p className="text-sm md:text-base text-foreground">
                      {userProfile?.name || "Your Name"}, <span className="font-medium">{userProfile?.phone || "+91-XXXXXXXXXX"}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </Link>
              </div>

              {/* Bill Details */}
              <div className="bg-card px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 md:gap-4">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base text-foreground">Total Bill</span>
                        {discount > 0 && (
                          <span className="text-sm md:text-base text-muted-foreground line-through">₹{formatAmount(totalBeforeDiscount)}</span>
                        )}
                        <span className="text-sm md:text-base font-semibold text-foreground">₹{formatAmount(total)}</span>
                        {(appliedCoupon || pricing?.appliedCoupon) && savings > 0 && (
                          <span className="text-xs md:text-sm bg-primary/10 text-primary px-1.5 md:px-2 py-0.5 rounded font-medium">You saved ₹{formatAmount(savings)}</span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">Incl. taxes and charges</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column - Order Summary (Desktop) */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6">
                {/* Bill Summary Card */}
                <div className="bg-card px-4 md:px-6 py-4 md:py-5 rounded-lg md:rounded-xl border border-border lg:shadow-sm">
                  <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Order Summary</h3>
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Item Total</span>
                      <span className="text-foreground">₹{formatAmount(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className={deliveryFee === 0 ? "text-primary font-bold" : "text-foreground"}>
                        {deliveryFee === 0 ? "FREE" : `₹${formatAmount(deliveryFee)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="text-foreground">₹{formatAmount(platformFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">GST</span>
                      <span className="text-foreground">₹{formatAmount(gstCharges)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-primary">
                        <span>Discount</span>
                        <span>-₹{formatAmount(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base md:text-lg font-bold pt-3 md:pt-4 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary">₹{formatAmount(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky - Place Order */}
      <div className="bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 shadow-lg z-30 flex-shrink-0 fixed bottom-0 left-0 right-0">
        <div className="w-full lg:max-w-[1100px] mx-auto">
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="w-full max-w-md md:max-w-lg mx-auto">
              {/* Pay Using */}
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div className="leading-tight">
                    <p className="text-[11px] md:text-xs uppercase tracking-wide text-muted-foreground/80">
                      PAY USING
                    </p>
                    <p className="text-sm md:text-base font-medium text-foreground">
                      {selectedPaymentMethod === "razorpay"
                        ? "Razorpay"
                        : selectedPaymentMethod === "wallet"
                          ? "Wallet"
                          : "Cash on Delivery"}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="appearance-none bg-muted border border-border text-foreground rounded-lg px-3 py-2 pr-9 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="razorpay">Razorpay</option>
                    <option value="wallet">Wallet {walletBalance > 0 ? `(₹${formatAmount(walletBalance)})` : ''}</option>
                    <option value="cash">COD</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button
                size="lg"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < total)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 md:px-10 h-14 md:h-16 rounded-lg md:rounded-xl text-base md:text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(selectedPaymentMethod === "razorpay" || selectedPaymentMethod === "wallet") && (
                  <div className="text-left mr-3 md:mr-4">
                    <p className="text-sm md:text-base opacity-90">₹{formatAmount(total)}</p>
                    <p className="text-xs md:text-sm opacity-75">TOTAL</p>
                  </div>
                )}
                <span className="font-bold text-base md:text-lg">
                  {isPlacingOrder
                    ? "Processing..."
                    : selectedPaymentMethod === "razorpay"
                      ? "Select Payment"
                      : selectedPaymentMethod === "wallet"
                        ? walletBalance >= total
                          ? "Place Order"
                          : "Insufficient Balance"
                        : "Place Order"}
                </span>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Placing Order Modal */}
      {showPlacingOrder && (
        <div className="fixed inset-0 z-[60] h-screen w-screen overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="px-6 py-8">
              {/* Title */}
              <h2 className="text-2xl font-bold text-foreground mb-6">Placing your order</h2>

              {/* Payment Info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl border border-border flex items-center justify-center bg-card shadow-sm">
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedPaymentMethod === "razorpay"
                      ? `Pay ₹${total.toFixed(2)} online (Razorpay)`
                      : selectedPaymentMethod === "wallet"
                        ? `Pay ₹${total.toFixed(2)} from Wallet`
                        : `Pay on delivery (COD)`}
                  </p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl border border-border flex items-center justify-center bg-muted">
                  <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Delivering to Location</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Address") : "Add address"}
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    {defaultAddress ? (formatFullAddress(defaultAddress) || "Address") : "Address"}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative mb-6">
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${orderProgress}%`,
                      boxShadow: '0 0 10px rgba(255, 112, 81, 0.5)'
                    }}
                  />
                </div>
                {/* Animated shimmer effect */}
                <div
                  className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    animation: 'shimmer 1.5s infinite',
                    width: `${orderProgress}%`
                  }}
                />
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowPlacingOrder(false)
                  setIsPlacingOrder(false)
                }}
                className="w-full text-right"
              >
                <span className="text-primary font-semibold text-base hover:text-primary/80 transition-colors">
                  CANCEL
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
            >
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4 border-primary"
                style={{
                  animation: 'ringPulse 1.5s ease-out infinite',
                  opacity: 0.3
                }}
              />
              {/* Main circle */}
              <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center shadow-2xl">
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
                >
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-primary">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {defaultAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-muted-foreground text-base">
                {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address") : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
            >
              <h3 className="text-3xl font-bold text-primary mb-2">Order Placed!</h3>
              <p className="text-muted-foreground">Your delicious food is on its way</p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToOrders}
              className="mt-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
            >
              Track Your Order
            </button>
          </div>
        </div>
      )}

      {/* Addon Customization Modal */}
      <AnimatePresence>
        {showAddonModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddonModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-card sticky top-0 z-10">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-foreground">Customize Item</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{selectedItemForAddons?.name}</p>
                </div>
                <button
                  onClick={() => setShowAddonModal(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {loadingCategoryAddons ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Fetching best addons for you...</p>
                  </div>
                ) : categoryAddons.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Select Addons</p>
                    {categoryAddons.map((addon) => (
                      <div
                        key={addon.id || addon._id}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.98] ${selectedAddonsMap[addon.id || addon._id]
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                          : 'border-border hover:border-border/80 bg-card'
                          }`}
                        onClick={() => handleToggleAddon(addon.id || addon._id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedAddonsMap[addon.id || addon._id] ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                            }`}>
                            {selectedAddonsMap[addon.id || addon._id] && <Check className="h-4 w-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-base">{addon.name}</p>
                            <p className="text-sm text-primary font-bold mt-0.5">₹{formatAmount(addon.price)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No addons available for this category</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 md:p-6 border-t border-border bg-card sticky bottom-0 z-10">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Total Addons Price</span>
                    <span className="text-xl font-bold text-foreground">₹{formatAmount(currentAddonsTotal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Final Item Price</span>
                    <span className="text-xl font-bold text-primary block">₹{formatAmount((selectedItemForAddons?.basePrice || selectedItemForAddons?.price || 0) + currentAddonsTotal)}</span>
                  </div>
                </div>
                <Button
                  onClick={handleSaveAddons}
                  disabled={loadingCategoryAddons}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Save Customization
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInBackdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUpBannerSmooth {
          from {
            transform: translateY(100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUpBanner {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmerBanner {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes checkMarkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes slideUpFull {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slideUpModal {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>
  )
}
