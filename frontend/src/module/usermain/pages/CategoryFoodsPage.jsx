import { useState, useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Search,
  Clock,
  Star,
  Plus,
  Filter,
  Heart
} from "lucide-react"
import Toast from "../components/Toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cafeAPI } from "@/lib/api"

export default function CategoryFoodsPage() {
  const navigate = useNavigate()
  const { categoryName } = useParams()
  const [activeFilter, setActiveFilter] = useState("Popular")
  const [searchQuery, setSearchQuery] = useState("")
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('wishlist')
    return saved ? JSON.parse(saved) : []
  })
  const [toast, setToast] = useState({ show: false, message: '' })
  const [foods, setFoods] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Show toast notification
  const showToast = (message) => {
    setToast({ show: true, message })
    setTimeout(() => {
      setToast({ show: false, message: '' })
    }, 3000)
  }

  // Toggle wishlist item
  const toggleWishlist = (item, type = 'food') => {
    const itemId = type === 'food' ? `food-${item.id}` : `cafe-${item.id}`
    const { id, ...restItem } = item
    const wishlistItem = {
      id: itemId,
      type,
      originalId: item.id,
      ...restItem
    }

    setWishlist((prev) => {
      const isInWishlist = prev.some((w) => w.id === itemId)
      if (isInWishlist) {
        const updated = prev.filter((w) => w.id !== itemId)
        localStorage.setItem('wishlist', JSON.stringify(updated))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('wishlistUpdated'))
        return updated
      } else {
        // Show toast notification
        setToast({
          show: true,
          message: `Your food item "${item.name}" is added to wishlist`
        })
        setTimeout(() => {
          setToast({ show: false, message: '' })
        }, 3000)
        const updated = [...prev, wishlistItem]
        localStorage.setItem('wishlist', JSON.stringify(updated))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('wishlistUpdated'))
        return updated
      }
    })
  }

  // Check if item is in wishlist
  const isInWishlist = (item, type = 'food') => {
    const itemId = type === 'food' ? `food-${item.id}` : `cafe-${item.id}`
    return wishlist.some((w) => w.id === itemId)
  }

  // Filter tabs
  const filters = ["Nearby", "Popular", "Cuisines"]

  const normalizedCategory = useMemo(() => {
    if (!categoryName) return ""
    try {
      return decodeURIComponent(categoryName).trim()
    } catch (err) {
      return String(categoryName).trim()
    }
  }, [categoryName])

  const isAllCategory = !normalizedCategory || normalizedCategory.toLowerCase() === "all"

  const extractMenuItems = (menu, cafe) => {
    if (!menu || !Array.isArray(menu.sections)) return []

    const cuisine = Array.isArray(cafe?.cuisines)
      ? cafe.cuisines.join(", ")
      : (cafe?.cuisines || "")
    const deliveryTime = cafe?.estimatedDeliveryTime || cafe?.deliveryTime || cafe?.eta || ""

    const flattenItems = []
    menu.sections.forEach((section) => {
      const sectionItems = Array.isArray(section.items) ? section.items : []
      const subsectionItems = Array.isArray(section.subsections)
        ? section.subsections.flatMap((subsection) => (Array.isArray(subsection.items) ? subsection.items : []))
        : []

      [...sectionItems, ...subsectionItems].forEach((item) => {
        const itemPrice = typeof item.price === "number" ? item.price : Number(item.price) || 0
        const originalPrice = item.originalPrice !== null && item.originalPrice !== undefined
          ? Number(item.originalPrice) || 0
          : itemPrice

        let discountLabel = null
        if (item.discountType === "Percent" && item.discountAmount > 0) {
          discountLabel = `${item.discountAmount}% OFF`
        } else if (item.discountType === "Fixed" && item.discountAmount > 0) {
          discountLabel = `${item.discountAmount} OFF`
        } else if (originalPrice > itemPrice && originalPrice > 0) {
          const percent = Math.round(((originalPrice - itemPrice) / originalPrice) * 100)
          discountLabel = percent > 0 ? `${percent}% OFF` : null
        }

        flattenItems.push({
          id: item.id,
          name: item.name,
          image: (Array.isArray(item.images) && item.images.length > 0)
            ? item.images[0]
            : (item.image || ""),
          discount: discountLabel,
          deliveryTime,
          rating: item.rating || 0,
          cuisine,
          price: itemPrice,
          originalPrice,
          cafeId: cafe?.cafeId || cafe?._id || null,
          cafeName: cafe?.name || "Cafe",
        })
      })
    })

    return flattenItems
  }

  useEffect(() => {
    let isMounted = true

    const fetchCategoryFoods = async () => {
      try {
        setIsLoading(true)
        setError("")

        const cafesResponse = await cafeAPI.getCafes()
        const cafes = cafesResponse?.data?.data?.cafes || []

        if (!cafes.length) {
          if (isMounted) {
            setFoods([])
          }
          return
        }

        const menuPromises = cafes.map(async (cafe) => {
          const cafeId = cafe.cafeId || cafe._id
          if (!cafeId) return []

          try {
            const params = isAllCategory ? {} : { category: normalizedCategory }
            const menuResponse = await cafeAPI.getMenuByCafeId(cafeId, params)
            const menu = menuResponse?.data?.data?.menu
            return extractMenuItems(menu, cafe)
          } catch (err) {
            return []
          }
        })

        const menuResults = await Promise.all(menuPromises)
        const allItems = menuResults.flat()

        if (isMounted) {
          setFoods(allItems)
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load dishes. Please try again.")
          setFoods([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCategoryFoods()

    return () => {
      isMounted = false
    }
  }, [normalizedCategory, isAllCategory])

  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return foods
    return foods.filter((food) => (food.name || "").toLowerCase().includes(query))
  }, [foods, searchQuery])

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-20">
      {/* Toast Notification */}
      <Toast show={toast.show} message={toast.message} />
      {/* Top Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-100">
        <div className="px-4 py-3">
          {/* Back Button and Search Bar Row */}
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>

            {/* Search Bar - Using Input Component */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input
                type="text"
                placeholder="Would you like to eat something?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 w-full bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:border-[#ff8100] transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="relative flex gap-2 overflow-x-auto scrollbar-hide flex-1 -mx-4 px-4">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeFilter === filter
                    ? 'text-white'
                    : 'text-gray-700 border border-gray-200 bg-white'
                  }`}
              >
                {activeFilter === filter && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="relative z-10">{filter}</span>
              </button>
            ))}
          </div>

          {/* Filter Button */}
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors flex-shrink-0">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Food Items List */}
      <div className="px-4 py-4 space-y-4">
        {isLoading && (
          <div className="text-center text-sm text-gray-500 py-12">
            Loading dishes...
          </div>
        )}
        {!isLoading && error && (
          <div className="text-center text-sm text-red-600 py-12">
            {error}
          </div>
        )}
        {!isLoading && !error && filteredFoods.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-12">
            No dishes found for {normalizedCategory || "this category"}.
          </div>
        )}
        {!isLoading && !error && filteredFoods.map((food) => (
          <div
            key={`${food.cafeId || 'cafe'}-${food.id}`}
            className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/usermain/food/${food.id}`)}
          >
            <div className="flex gap-3 p-3">
              {/* Food Image */}
              <div className="relative flex-shrink-0">
                <img
                  src={food.image}
                  alt={food.name}
                  className="w-24 h-24 rounded-lg object-cover"
                />
                {/* Heart Icon - Top Right */}
                <button
                  className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-full hover:scale-110 transition-transform z-10"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWishlist(food, 'food')
                  }}
                >
                  <Heart
                    className={`w-4 h-4 transition-all ${isInWishlist(food, 'food')
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-400 hover:text-red-500'
                      }`}
                  />
                </button>
              </div>

              {/* Food Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-900 flex-1 truncate">{food.name}</h3>
                  {/* Discount Tag */}
                  {food.discount && (
                    <div className="bg-[#ff8100] text-white text-xs font-bold px-2 py-0.5 rounded ml-2 flex-shrink-0">
                      {food.discount}
                    </div>
                  )}
                </div>

                {/* Delivery Time */}
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                  <Clock className="w-3 h-3" />
                  {food.deliveryTime && <span>{food.deliveryTime}</span>}
                </div>

                {/* Rating and Cuisine */}
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span>{food.rating}</span>
                  {food.cuisine && <span className="ml-1">{food.cuisine}</span>}
                </div>

                {/* Price and Add Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-gray-900">${Number(food.price || 0).toFixed(2)}</span>
                    {food.originalPrice > food.price && (
                      <span className="text-xs text-gray-400 line-through">${Number(food.originalPrice || 0).toFixed(2)}</span>
                    )}
                  </div>

                  {/* Add Button */}
                  <Button
                    className="bg-[#ff8100] hover:bg-[#e67300] text-white rounded-lg px-4 py-1.5 h-auto flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      showToast("Item added to the cart")
                      // Handle add to cart logic here
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-semibold">Add</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
