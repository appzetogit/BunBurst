import { Link, useNavigate } from "react-router-dom"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Star, Clock, MapPin, ArrowRight, Bookmark, Share2, Plus, Minus, X, Search, Mic, UtensilsCrossed } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import AnimatedPage from "../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useLocationSelector, useSearchOverlay } from "../components/UserLayout"
import { useProfile } from "../context/ProfileContext"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"
import { useCart } from "../context/CartContext"
import PageNavbar from "../components/PageNavbar"
import { foodImages } from "@/constants/images"
import appzetoFoodLogo from "@/assets/appzetologo.png"
import AddToCartAnimation from "../components/AddToCartAnimation"
import OptimizedImage from "@/components/OptimizedImage"
import api from "@/lib/api"
import { cafeAPI } from "@/lib/api"
import { isModuleAuthenticated } from "@/lib/utils/auth"
import UserBannerCarousel from "../components/UserBannerCarousel"
import UserTopHeader from "../components/UserTopHeader"

const placeholders = [
  "Search \"burger\"",
  "Search \"biryani\"",
  "Search \"pizza\"",
  "Search \"desserts\"",
  "Search \"chinese\"",
  "Search \"thali\"",
  "Search \"momos\"",
  "Search \"dosa\""
]

export default function Under250() {
  const { location } = useLocation()
  const { zoneId, zoneStatus, isInService, isOutOfService } = useZone(location)
  const navigate = useNavigate()
  const { openSearch } = useSearchOverlay()
  const { vegMode, handleVegModeChange } = useProfile()
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart()
  const [activeCategory, setActiveCategory] = useState("all")
  const [showAllCategoriesPopup, setShowAllCategoriesPopup] = useState(false)
  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [bookmarkedItems, setBookmarkedItems] = useState(new Set())
  const [viewCartButtonBottom, setViewCartButtonBottom] = useState("bottom-20")
  const lastScrollY = useRef(0)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [bannerImage, setBannerImage] = useState(null)
  const [loadingBanner, setLoadingBanner] = useState(true)
  const [under250Cafes, setUnder250Cafes] = useState([])
  const [loadingCafes, setLoadingCafes] = useState(true)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  const isVegItem = (item) => {
    if (item?.isVeg === true) return true
    const foodType = String(item?.foodType || item?.dishType || "").toLowerCase()
    if (!foodType) return false
    if (foodType.includes("non")) return false
    return foodType.includes("veg")
  }

  const filterVegItems = (items) => {
    const safeItems = Array.isArray(items) ? items : []
    return vegMode ? safeItems.filter(isVegItem) : safeItems
  }

  // Animated placeholder cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Prevent background scrolling when any modal/sheet is open
  useEffect(() => {
    const isAnyModalOpen =
      showItemDetail ||
      showAllCategoriesPopup;

    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showItemDetail, showAllCategoriesPopup]);

  const handleAllCategoriesClick = () => {
    setActiveCategory("all")
    setShowAllCategoriesPopup(true)
  }

  const sortedAndFilteredCafes = useMemo(() => {
    return [...under250Cafes]
  }, [under250Cafes])

  // Keep existing sorting/filtering and additionally filter menu items by selected category
  const cafesByCategory = useMemo(() => {
    if (activeCategory === "all") {
      const vegFiltered = sortedAndFilteredCafes.map((cafe) => ({
        ...cafe,
        menuItems: filterVegItems(cafe.menuItems),
      }))
      return vegMode ? vegFiltered.filter((cafe) => cafe.menuItems.length > 0) : vegFiltered
    }

    const selectedCategoryObj = categories.find((cat) => cat.id === activeCategory)
    if (!selectedCategoryObj) return sortedAndFilteredCafes

    const normalizeCategory = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()

    const selectedName = normalizeCategory(selectedCategoryObj.name)
    const selectedSlug = normalizeCategory(selectedCategoryObj.slug || selectedCategoryObj.name)

    const matchesCategory = (itemCategoryRaw) => {
      const itemCategory = normalizeCategory(itemCategoryRaw)
      if (!itemCategory) return false
      return (
        itemCategory === selectedName ||
        itemCategory === selectedSlug ||
        itemCategory.includes(selectedName) ||
        selectedName.includes(itemCategory)
      )
    }

    return sortedAndFilteredCafes
      .map((cafe) => ({
        ...cafe,
        menuItems: filterVegItems((cafe.menuItems || []).filter((item) => matchesCategory(item.category))),
      }))
      .filter((cafe) => cafe.menuItems.length > 0)
  }, [sortedAndFilteredCafes, activeCategory, categories, vegMode])

  // State to handle multiple banners if array returned
  const [bannersData, setBannersData] = useState([])

  // Fetch under 250 banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoadingBanner(true)
        const response = await api.get('/hero-banners/under-250/public')
        if (response.data.success && response.data.data.banners) {
          setBannersData(response.data.data.banners)
          if (response.data.data.banners.length > 0) {
            setBannerImage(response.data.data.banners[0])
          }
        }
      } catch (error) {
        console.error('Error fetching under 250 banners:', error)
      } finally {
        setLoadingBanner(false)
      }
    }
    fetchBanners()
  }, [])

  // Fetch cafes with dishes under ₹250 from backend
  useEffect(() => {
    const fetchCafesUnder250 = async () => {
      try {
        setLoadingCafes(true)
        // Optional: Add zoneId if available (for sorting/filtering, but show all cafes)
        const response = await cafeAPI.getCafesUnder250(zoneId)
        if (response.data.success && response.data.data.cafes) {
          setUnder250Cafes(response.data.data.cafes)
        } else {
          setUnder250Cafes([])
        }
      } catch (error) {
        console.error('Error fetching cafes under 250:', error)
        setUnder250Cafes([])
      } finally {
        setLoadingCafes(false)
      }
    }

    fetchCafesUnder250()
  }, [zoneId, isOutOfService])

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await api.get('/categories/public')
        if (response.data.success && response.data.data.categories) {
          const adminCategories = response.data.data.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            image: cat.image || foodImages[0], // Fallback to default image if not provided
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')
          }))
          setCategories(adminCategories)
        } else {
          // Fallback to default categories if API fails
          const defaultCategories = [
            { id: 1, name: "Biryani", image: foodImages[0] },
            { id: 2, name: "Cake", image: foodImages[1] },
            { id: 3, name: "Chhole Bhature", image: foodImages[2] },
            { id: 4, name: "Chicken Tanduri", image: foodImages[3] },
          ]
          setCategories(defaultCategories)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
        // Fallback to default categories on error
        const defaultCategories = [
          { id: 1, name: "Biryani", image: foodImages[0] },
          { id: 2, name: "Cake", image: foodImages[1] },
          { id: 3, name: "Chhole Bhature", image: foodImages[2] },
        ]
        setCategories(defaultCategories)
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  // Sync quantities from cart on mount
  useEffect(() => {
    const cartQuantities = {}
    cart.forEach((item) => {
      cartQuantities[item.id] = item.quantity || 0
    })
    setQuantities(cartQuantities)
  }, [cart])

  // Scroll detection for view cart button positioning
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = Math.abs(currentScrollY - lastScrollY.current)

      // Only update if scroll difference is significant (avoid flickering)
      if (scrollDifference < 5) {
        return
      }

      // Scroll down -> bottom-0, Scroll up -> bottom-20
      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setViewCartButtonBottom("bottom-0")
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up
        setViewCartButtonBottom("bottom-20")
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Helper function to update item quantity in bothlocal state and cart
  const updateItemQuantity = (item, newQuantity, event = null, cafeName = null) => {
    // Check authentication
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/sign-in', { state: { from: location.pathname } })
      return
    }

    // CRITICAL: Check if user is in service zone
    if (isOutOfService) {
      toast.error('You are outside the service zone. Please select a location within the service area.')
      return
    }

    // Update local state
    setQuantities((prev) => ({
      ...prev,
      [item.id]: newQuantity,
    }))

    // Find cafe name from the item or use provided parameter
    const cafe = cafeName || item.cafe || "Under 250"

    // Prepare cart item with all required properties
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      cafe: cafe,
      description: item.description || "",
      originalPrice: item.originalPrice || item.price,
    }

    // Get source position for animation from event target
    let sourcePosition = null
    if (event) {
      let buttonElement = event.currentTarget
      if (!buttonElement && event.target) {
        buttonElement = event.target.closest('button') || event.target
      }

      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect()
        const scrollX = window.pageXOffset || window.scrollX || 0
        const scrollY = window.pageYOffset || window.scrollY || 0

        sourcePosition = {
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          scrollX: scrollX,
          scrollY: scrollY,
          itemId: item.id,
        }
      }
    }

    // Update cart context
    if (newQuantity <= 0) {
      const productInfo = {
        id: item.id,
        name: item.name,
        imageUrl: item.image,
      }
      removeFromCart(item.id, sourcePosition, productInfo)
    } else {
      const existingCartItem = getCartItem(item.id)
      if (existingCartItem) {
        const productInfo = {
          id: item.id,
          name: item.name,
          imageUrl: item.image,
        }

        if (newQuantity > existingCartItem.quantity && sourcePosition) {
          addToCart(cartItem, sourcePosition)
          if (newQuantity > existingCartItem.quantity + 1) {
            updateQuantity(item.id, newQuantity)
          }
        } else if (newQuantity < existingCartItem.quantity && sourcePosition) {
          updateQuantity(item.id, newQuantity, sourcePosition, productInfo)
        } else {
          updateQuantity(item.id, newQuantity)
        }
      } else {
        addToCart(cartItem, sourcePosition)
        if (newQuantity > 1) {
          updateQuantity(item.id, newQuantity)
        }
      }
    }
  }

  const handleItemClick = (item, cafe) => {
    // Add cafe info to item for display
    const itemWithCafe = {
      ...item,
      cafe: cafe.name,
      description: item.description || `${item.name} from ${cafe.name}`,
      customisable: item.customisable || false,
      notEligibleForCoupons: item.notEligibleForCoupons || false,
    }
    setSelectedItem(itemWithCafe)
    setShowItemDetail(true)
  }

  const handleBookmarkClick = (itemId) => {
    setBookmarkedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Check if should show grayscale (only when user is out of service)
  const shouldShowGrayscale = isOutOfService

  return (

    <div className={`relative min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Desktop Search Bar Row (Hidden on Mobile) */}
      <div className="hidden md:block sticky top-16 z-40 bg-background/95 backdrop-blur-md pt-4 pb-4 mt-16 px-0 border-b border-border shadow-sm transition-all duration-300">
        <div className="max-w-[1100px] mx-auto flex items-center gap-6">
          {/* Search Input Container */}
          <div className="flex-1 relative">
            <div
              className="flex items-center gap-4 px-6 py-3 bg-white dark:bg-zinc-900 border border-[#F5F5F5] dark:border-zinc-800 rounded-2xl shadow-md hover:shadow-lg hover:border-[#e53935]/30 transition-all duration-300 group cursor-pointer"
              onClick={() => openSearch()}
            >
              <Search className="h-5 w-5 text-slate-400 group-hover:text-[#e53935] transition-colors" />
              <div className="flex-1 relative h-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 text-slate-500 font-medium flex items-center"
                  >
                    {placeholders[placeholderIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openSearch(true)
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <Mic className="h-5 w-5 text-[#e53935]" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile-only Top Header — DesktopNavbar handles md+ screens */}
      <UserTopHeader
        className="md:hidden"
        vegMode={vegMode}
        onVegModeChange={handleVegModeChange}
        showVegToggle={false}
      />

      {/* Hero Banner Section - Reusable Carousel matching Home Page layout */}
      <div className="w-[92%] sm:w-[95%] md:w-full max-w-[1100px] mx-auto mb-6 px-0">
        <UserBannerCarousel
          banners={bannersData.length > 0 ? bannersData : (bannerImage ? [bannerImage] : [])}
          loading={loadingBanner}
        />
      </div>

      {/* Content Section */}
      <div className="relative w-[92%] sm:w-[95%] md:w-full max-w-[1100px] mx-auto px-0 space-y-5 sm:space-y-3 md:space-y-0 pt-4 sm:pt-4 lg:pt-6 pb-32 sm:pb-28 md:pb-12 lg:pb-14">

        <section className="space-y-1 sm:space-y-1.5">
          <div
            className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto md:overflow-x-visible overflow-y-visible scrollbar-hide scroll-smooth px-2 sm:px-3 py-2 sm:py-3 md:py-4"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              touchAction: "pan-x pan-y pinch-zoom",
              overflowY: "hidden",
            }}
          >
            {/* All Button */}
            <div className="flex-shrink-0">
              <motion.div
                className="flex flex-col items-center gap-1.5 w-[56px] sm:w-20 md:w-24 border-none bg-transparent"
                onClick={handleAllCategoriesClick}
                whileHover={{ scale: 1.1, y: -4 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden transition-all flex items-center justify-center border-2 ${
                    activeCategory === "all"
                      ? "border-[#e53935] ring-4 ring-[#e53935]/10 bg-white"
                      : "border-transparent bg-white shadow-sm"
                  }`}
                >
                  <UtensilsCrossed className={`h-6 w-6 sm:h-8 sm:w-8 ${activeCategory === "all" ? "text-[#e53935]" : "text-slate-400 font-medium"}`} />
                </div>
                <span className={`text-[11px] sm:text-xs md:text-sm font-medium text-center pb-1 ${activeCategory === "all" ? 'text-[#e53935]' : 'text-slate-600'}`}>
                  All
                </span>
              </motion.div>
            </div>
            {categories.map((category) => {
              const isActive = activeCategory === category.id
              return (
                <div key={category.id} className="flex-shrink-0">
                  <motion.button
                    type="button"
                    className="flex flex-col items-center gap-1.5 w-[56px] sm:w-20 md:w-24 border-none bg-transparent"
                    onClick={() => setActiveCategory(category.id)}
                    whileHover={{ scale: 1.1, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden transition-all border-2 ${
                      isActive ? "border-[#e53935] ring-4 ring-[#e53935]/10" : "border-transparent shadow-sm"
                    }`}>
                      <OptimizedImage
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full bg-white rounded-full object-cover"
                        sizes="(max-width: 640px) 56px, (max-width: 768px) 64px, 80px"
                        placeholder="blur"
                      />
                    </div>
                    <span className={`text-[11px] sm:text-xs md:text-sm font-medium text-center pb-1 ${isActive ? 'text-[#e53935]' : 'text-slate-600'}`}>
                      {category.name}
                    </span>
                  </motion.button>
                </div>
              )
            })}
          </div>
        </section>



        {/* Cafe Menu Sections */}
        {loadingCafes ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading cafes...</div>
          </div>
        ) : cafesByCategory.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              {under250Cafes.length === 0
                ? "No cafes with dishes under ₹250 found."
                : activeCategory === "all"
                  ? "No cafes match the selected filters."
                  : "No items found in this category for current filters."}
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-300 dark:border-white/20"></div>
              <h2 className="flex-shrink mx-4 text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                Explore Menu
              </h2>
              <div className="flex-grow border-t border-slate-300 dark:border-white/20"></div>
            </div>
            
            {cafesByCategory.map((cafe) => {
            const cafeSlug = cafe.slug || cafe.name.toLowerCase().replace(/\s+/g, "-")
            return (
                <div 
                  key={cafe.id} 
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-4 sm:p-5 md:p-6 mb-6 transition-all hover:shadow-md"
                >
                {/* Cafe Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                      {cafe.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <Clock className="h-4 w-4" />
                      <span>{cafe.deliveryTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#e53935] text-white px-2 py-1 rounded-full shadow-sm">
                    <Star className="h-4 w-4 fill-white" />
                    <span className="text-sm font-bold">{cafe.rating || '0'}</span>
                  </div>
                </div>

                {/* Menu Items Horizontal Scroll */}
                {cafe.menuItems && cafe.menuItems.length > 0 && (
                  <div className="space-y-2 md:space-y-3 lg:space-y-4">
                    <div
                      className="flex md:grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto md:overflow-x-visible overflow-y-visible scrollbar-hide scroll-smooth pb-2 md:pb-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        touchAction: "pan-x pan-y pinch-zoom",
                        overflowY: "hidden",
                      }}
                    >
                      {cafe.menuItems.map((item, itemIndex) => {
                        const quantity = quantities[item.id] || 0
                        return (
                          <motion.div
                            key={item.id}
                            className="flex-shrink-0 w-[180px] sm:w-[200px] md:w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden"
                            onClick={() => handleItemClick(item, cafe)}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3 }}
                            whileHover={{ y: -4 }}
                          >
                            <div className="relative aspect-square w-full overflow-hidden">
                              <OptimizedImage
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                sizes="(max-width: 640px) 180px, 200px"
                                placeholder="blur"
                              />
                              {/* Veg Icon Layer Overlay */}
                              {item.isVeg && (
                                <div className="absolute top-2 left-2 h-5 w-5 bg-white/90 rounded-sm flex items-center justify-center shadow-sm z-10">
                                  <div className="h-4 w-4 rounded-sm border-2 border-green-600 flex items-center justify-center">
                                    <div className="h-2 w-2 rounded-full bg-green-600" />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="p-3">
                              <div className="flex items-center gap-1.5 mb-3">
                                <div className="h-3 w-3 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                                </div>
                                <span className="text-[11px] sm:text-xs text-slate-700 dark:text-zinc-300 font-medium truncate">
                                  1 x {item.name}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                                  ₹{Math.round(item.price)}
                                </span>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={shouldShowGrayscale}
                                  className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all ${
                                    quantity > 0 
                                      ? 'bg-red-50 text-[#e53935] border-[#e53935] hover:bg-red-100' 
                                      : 'bg-white text-[#e53935] border-[#e53935]/20 hover:border-[#e53935] hover:bg-red-50'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!shouldShowGrayscale) {
                                      updateItemQuantity(item, quantity + 1, e, cafe.name)
                                    }
                                  }}
                                >
                                  {quantity > 0 ? `× ${quantity}` : 'Add'}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* View Full Menu Button */}
                    <div className="flex justify-center mt-6">
                      <Link to={`/user/cafes/${cafeSlug}?under250=true`}>
                        <Button
                          variant="outline"
                          className="rounded-xl border-[#e53935] bg-[#e53935] text-white hover:bg-[#d32f2f] h-12 px-10 text-base font-bold transition-all shadow-md group"
                        >
                          View full menu 
                          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                </div>
            )
            })}
          </div>
        )}
      </div>

      {/* All Categories Popup */}
      <AnimatePresence>
        {showAllCategoriesPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowAllCategoriesPopup(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[115]"
            />

            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-sm sm:max-w-md bg-card rounded-2xl border border-border shadow-2xl z-[120] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">All Categories</h2>
                <button
                  type="button"
                  onClick={() => setShowAllCategoriesPopup(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close all categories"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-x-4 gap-y-5">
                  {categories.map((category) => (
                    <button
                      key={`all-category-${category.id}`}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category.id)
                        setShowAllCategoriesPopup(false)
                      }}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm bg-white">
                        <OptimizedImage
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full rounded-full"
                          objectFit="cover"
                          sizes="56px"
                          placeholder="blur"
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground/90 leading-tight">
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Detail Popup */}
      <AnimatePresence>
        {showItemDetail && selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowItemDetail(false)}
            />

            {/* Item Detail Bottom Sheet */}
            <motion.div
              className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-2xl lg:max-w-4xl xl:max-w-5xl z-[10000] bg-card rounded-t-3xl shadow-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col"
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
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-foreground flex items-center justify-center hover:bg-foreground/80 transition-colors shadow-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
                </motion.button>
              </div>

              {/* Image Section */}
              <div className="relative w-full h-64 md:h-80 lg:h-96 xl:h-[500px] overflow-hidden rounded-t-3xl">
                <OptimizedImage
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-full h-full"
                  objectFit="cover"
                  sizes="100vw"
                  priority={true}
                  placeholder="blur"
                />
                {/* Bookmark and Share Icons Overlay */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBookmarkClick(selectedItem.id)
                    }}
                    className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/90 text-muted-foreground hover:bg-card"
                      }`}
                  >
                    <Bookmark
                      className={`h-5 w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-primary" : ""
                        }`}
                    />
                  </button>
                  <button className="h-10 w-10 rounded-full border border-border bg-card/90 text-muted-foreground hover:bg-card flex items-center justify-center transition-colors">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-6 lg:py-8">
                {/* Item Name and Indicator */}
                <div className="flex items-start justify-between mb-3 md:mb-4 lg:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    {selectedItem.isVeg && (
                      <div className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 rounded border-2 border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <div className="h-2.5 w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5 rounded-full bg-primary" />
                      </div>
                    )}
                    <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground">
                      {selectedItem.name}
                    </h2>
                  </div>
                  {/* Bookmark and Share Icons (Desktop) */}
                  <div className="hidden md:flex items-center gap-2 lg:gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBookmarkClick(selectedItem.id)
                      }}
                      className={`h-8 w-8 lg:h-10 lg:w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Bookmark
                        className={`h-4 w-4 lg:h-5 lg:w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-primary" : ""
                          }`}
                      />
                    </button>
                    <button className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                      <Share2 className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm md:text-base lg:text-lg text-muted-foreground mb-4 md:mb-6 lg:mb-8 leading-relaxed">
                  {selectedItem.description || `${selectedItem.name} from ${selectedItem.cafe || 'Under 250'}`}
                </p>

                {/* Highly Reordered Progress Bar */}
                {selectedItem.customisable && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '50%' }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      highly reordered
                    </span>
                  </div>
                )}

                {/* Not Eligible for Coupons */}
                {selectedItem.notEligibleForCoupons && (
                  <p className="text-xs text-muted-foreground/60 font-medium mb-4">
                    NOT ELIGIBLE FOR COUPONS
                  </p>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="border-t border-border px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-5 lg:py-6 bg-card">
                <div className="flex items-center gap-4 md:gap-5 lg:gap-6">
                  {/* Quantity Selector */}
                  <div className={`flex items-center gap-3 md:gap-4 lg:gap-5 border-2 rounded-lg md:rounded-xl px-3 md:px-4 lg:px-5 h-[44px] md:h-[50px] lg:h-[56px] ${shouldShowGrayscale
                    ? 'border-border opacity-50'
                    : 'border-border'
                    }`}>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          updateItemQuantity(selectedItem, Math.max(0, (quantities[selectedItem.id] || 0) - 1), e)
                        }
                      }}
                      disabled={(quantities[selectedItem.id] || 0) === 0 || shouldShowGrayscale}
                      className={`${shouldShowGrayscale
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : 'text-muted-foreground hover:text-foreground disabled:text-muted-foreground/30 disabled:cursor-not-allowed'
                        }`}
                    >
                      <Minus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                    <span className={`text-lg md:text-xl lg:text-2xl font-semibold min-w-[2rem] md:min-w-[2.5rem] lg:min-w-[3rem] text-center ${shouldShowGrayscale
                      ? 'text-muted-foreground/40'
                      : 'text-foreground'
                      }`}>
                      {quantities[selectedItem.id] || 0}
                    </span>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          updateItemQuantity(selectedItem, (quantities[selectedItem.id] || 0) + 1, e)
                        }
                      }}
                      disabled={shouldShowGrayscale}
                      className={shouldShowGrayscale
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    >
                      <Plus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                  </div>

                  {/* Add Item Button */}
                  <Button
                    className={`flex-1 h-[44px] md:h-[50px] lg:h-[56px] rounded-lg md:rounded-xl font-semibold flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg ${shouldShowGrayscale
                      ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    onClick={(e) => {
                      if (!shouldShowGrayscale) {
                        updateItemQuantity(selectedItem, (quantities[selectedItem.id] || 0) + 1, e)
                        setShowItemDetail(false)
                      }
                    }}
                    disabled={shouldShowGrayscale}
                  >
                    <span>Add item</span>
                    <div className="flex items-center gap-1 md:gap-2">
                      {selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price && (
                        <span className="text-sm md:text-base lg:text-lg line-through text-primary-foreground/60">
                          ₹{Math.round(selectedItem.originalPrice)}
                        </span>
                      )}
                      <span className="text-base md:text-lg lg:text-xl font-bold">
                        ₹{Math.round(selectedItem.price)}
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Cart Animation */}
      <AddToCartAnimation dynamicBottom={viewCartButtonBottom} />
    </div>
  )
}
