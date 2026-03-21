import { useState, useMemo, useRef, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images"
import api from "@/lib/api"
import { cafeAPI, adminAPI } from "@/lib/api"
import { useCart } from "../context/CartContext"
import { useProfile } from "../context/ProfileContext"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]

// Mock data removed - using backend data only

const getCafeDeduplicationKey = (cafe) =>
  String(cafe?.cafeId || cafe?.id || cafe?.slug || cafe?.name || "")

const dedupeCafeCards = (cafes) => {
  const uniqueCafes = new Map()

  cafes.forEach((cafe) => {
    const cafeKey = getCafeDeduplicationKey(cafe)
    if (!cafeKey) {
      return
    }

    const currentDish = cafe.categoryDish
      ? {
          itemId: cafe.categoryDish.itemId || cafe.dishId || cafe.id,
          name: cafe.categoryDishName || cafe.categoryDish.name,
          price: cafe.categoryDishPrice ?? cafe.categoryDish.price ?? 0,
          image: cafe.categoryDishImage || cafe.categoryDish.image || null,
          foodType: cafe.categoryDish.foodType || null,
        }
      : null

    if (!uniqueCafes.has(cafeKey)) {
      uniqueCafes.set(cafeKey, {
        ...cafe,
        id: cafe.cafeId || cafe.id,
        matchedDishes: currentDish
          ? [currentDish]
          : (Array.isArray(cafe.matchedDishes) ? cafe.matchedDishes : []),
      })
      return
    }

    if (!currentDish) {
      return
    }

    const existingCafe = uniqueCafes.get(cafeKey)
    const existingDishes = Array.isArray(existingCafe.matchedDishes) ? existingCafe.matchedDishes : []
    const currentDishKey = String(currentDish.itemId || `${currentDish.name}-${currentDish.price}`)
    const alreadyAdded = existingDishes.some(
      (dish) => String(dish.itemId || `${dish.name}-${dish.price}`) === currentDishKey
    )

    if (!alreadyAdded) {
      existingCafe.matchedDishes = [...existingDishes, currentDish]
    }
  })

  return Array.from(uniqueCafes.values())
}

export default function CategoryPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(category?.toLowerCase() || 'all')
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const [sortBy, setSortBy] = useState(null)
  const [selectedCuisine, setSelectedCuisine] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [activeScrollSection, setActiveScrollSection] = useState('sort')
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false)
  const [expandedCafeId, setExpandedCafeId] = useState(null)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)
  const categoryScrollRef = useRef(null)

  // State for categories from admin
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  // State for cafes from backend
  const [cafesData, setCafesData] = useState([])
  const [loadingCafes, setLoadingCafes] = useState(true)
  const [categoryKeywords, setCategoryKeywords] = useState({})

  const normalizeRestaurantType = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")

  const isCafeAllowedByVegMode = (cafe) => {
    if (!vegMode) return true
    const type = normalizeRestaurantType(cafe?.restaurantType)
    return type !== "nonveg"
  }

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await adminAPI.getPublicCategories()

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: null, slug: 'all' },
            ...categoriesArray
              .filter(cat => {
                const slug = cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-')
                return slug !== 'all' && cat.name?.toLowerCase() !== 'all'
              })
              .map((cat) => ({
                id: cat.slug || cat.id,
                name: cat.name,
                image: cat.image || foodImages[0],
                slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
                type: cat.type,
              }))
          ]

          setCategories(transformedCategories)

          // Generate category keywords dynamically from category names
          const keywordsMap = {}
          categoriesArray.forEach((cat) => {
            const categoryId = cat.slug || cat.id
            const categoryName = cat.name.toLowerCase()

            // Generate keywords from category name
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        } else {
          // Keep default "All" category on error
          setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
        // Keep default "All" category on error
        setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  // Helper function to check if menu has dishes matching category keywords
  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false
    }

    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return false
    }

    for (const section of menu.sections) {
      const sectionNameLower = (section.name || '').toLowerCase()
      if (keywords.some(keyword => sectionNameLower.includes(keyword))) {
        return true
      }

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.category || '').toLowerCase()

          if (keywords.some(keyword =>
            itemNameLower.includes(keyword) || itemCategoryLower.includes(keyword)
          )) {
            return true
          }
        }
      }
    }

    return false
  }

  // Helper function to get ALL dishes matching a category from menu (returns array of dish info)
  const getAllCategoryDishesFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return []
    }

    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return []
    }

    const matchingDishes = []

    for (const section of menu.sections) {
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.category || '').toLowerCase()

          if (keywords.some(keyword =>
            itemNameLower.includes(keyword) || itemCategoryLower.includes(keyword)
          )) {
            // Calculate final price considering discounts
            const originalPrice = item.originalPrice || item.price || 0
            const discountPercent = item.discountPercent || 0
            const finalPrice = discountPercent > 0
              ? Math.round(originalPrice * (1 - discountPercent / 100))
              : originalPrice

            // Get dish image (prioritize item image, then section image)
            const dishImage = item.image?.url || item.image || section.image?.url || section.image || null

            matchingDishes.push({
              name: item.name,
              price: finalPrice,
              image: dishImage,
              originalPrice: originalPrice,
              itemId: item._id || item.id || `${item.name}-${finalPrice}`,
              foodType: item.foodType, // Include foodType for vegMode filtering
            })
          }
        }
      }
    }

    return matchingDishes
  }

  // Helper function to get FIRST featured dish for a category from menu (for backward compatibility)
  const getCategoryDishFromMenu = (menu, categoryId) => {
    const allDishes = getAllCategoryDishesFromMenu(menu, categoryId)
    return allDishes.length > 0 ? allDishes[0] : null
  }

  const getPreviewDishesFromMenu = (menu, options = {}) => {
    const { limit = Infinity, vegOnly = false } = options

    if (!menu || !Array.isArray(menu.sections)) {
      return []
    }

    const previewDishes = []

    for (const section of menu.sections) {
      const sectionItems = Array.isArray(section.items) ? section.items : []

      for (const item of sectionItems) {
        if (vegOnly && item.foodType !== "Veg") {
          continue
        }

        const originalPrice = item.originalPrice || item.price || 0
        const discountPercent = item.discountPercent || 0
        const finalPrice = discountPercent > 0
          ? Math.round(originalPrice * (1 - discountPercent / 100))
          : originalPrice

        previewDishes.push({
          name: item.name,
          price: finalPrice,
          image: item.image?.url || item.image || section.image?.url || section.image || null,
          originalPrice,
          itemId: item._id || item.id || `${item.name}-${finalPrice}`,
          foodType: item.foodType || null,
        })

        if (previewDishes.length >= limit) {
          return previewDishes
        }
      }
    }

    return previewDishes
  }

  // Fetch cafes from API
  useEffect(() => {
    const fetchCafes = async () => {
      try {
        setLoadingCafes(true)
        const params = {}
        if (zoneId) {
          params.zoneId = zoneId
        }

        // Add dietary preference filter
        if (vegMode) {
          params.dietaryPreference = 'veg'
        } else {
          params.dietaryPreference = 'non-veg'
        }

        const response = await cafeAPI.getCafes(params)

        if (response.data && response.data.success && response.data.data && response.data.data.cafes) {
          const cafesArray = response.data.data.cafes

          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false

            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"
            ]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249

            if (fieldName === 'offer' && defaultOffers.includes(value)) return true
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) return true
            if (fieldName === 'distance' && defaultDistances.includes(value)) return true
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) return true

            return false
          }

          // Transform cafes - filter out default values
          const cafesWithIds = cafesArray
            .filter((cafe) => {
              const hasName = cafe.name && cafe.name.trim().length > 0
              const hasRealImage = cafe.profileImage?.url ||
                (cafe.coverImages && cafe.coverImages.length > 0) ||
                (cafe.menuImages && cafe.menuImages.length > 0)
              return hasName && hasRealImage
            })
            .map((cafe) => {
              let deliveryTime = cafe.estimatedDeliveryTime || null
              let distance = cafe.distance || null
              let offer = cafe.offer || null

              if (isDefaultValue(deliveryTime, 'deliveryTime')) deliveryTime = null
              if (isDefaultValue(distance, 'distance')) distance = null
              if (isDefaultValue(offer, 'offer')) offer = null

              const cuisine = cafe.cuisines && cafe.cuisines.length > 0
                ? cafe.cuisines.join(", ")
                : null

              const coverImages = cafe.coverImages && cafe.coverImages.length > 0
                ? cafe.coverImages.map(img => img.url || img).filter(Boolean)
                : []

              const fallbackImages = cafe.menuImages && cafe.menuImages.length > 0
                ? cafe.menuImages.map(img => img.url || img).filter(Boolean)
                : []

              const allImages = coverImages.length > 0
                ? coverImages
                : (fallbackImages.length > 0
                  ? fallbackImages
                  : (cafe.profileImage?.url ? [cafe.profileImage.url] : []))

              const image = allImages[0] || null
              const profileImage = cafe.profileImage?.url || cafe.profileImage || null
              const cafeId = cafe.cafeId || cafe._id

              let featuredDish = cafe.featuredDish || null
              let featuredPrice = cafe.featuredPrice || null

              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
                featuredPrice = null
              }

              return {
                id: cafeId,
                name: cafe.name,
                cuisine: cuisine,
                rating: cafe.rating || null,
                deliveryTime: deliveryTime,
                distance: distance,
                profileImage: profileImage,
                image: image,
                images: allImages,
                priceRange: cafe.priceRange || null,
                featuredDish: featuredDish,
                featuredPrice: featuredPrice,
                offer: offer,
                slug: cafe.slug || cafe.name?.toLowerCase().replace(/\s+/g, '-'),
                cafeId: cafeId,
                hasPaneer: false,
                category: 'all',
                restaurantType: cafe.restaurantType || cafe.restaurant_type || null,
              }
            })

          // Fetch menus for all cafes
          const menuPromises = cafesWithIds.map(async (cafe) => {
            try {
              const menuResponse = await cafeAPI.getMenuByCafeId(cafe.cafeId)
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const menu = menuResponse.data.data.menu
                const hasPaneer = checkCategoryInMenu(menu, 'paneer-tikka')

                let featuredDish = cafe.featuredDish
                let featuredPrice = cafe.featuredPrice

                if (!featuredDish || !featuredPrice) {
                  for (const section of (menu.sections || [])) {
                    if (section.items && section.items.length > 0) {
                      const firstItem = section.items[0]
                      if (!featuredDish) featuredDish = firstItem.name
                      if (!featuredPrice) {
                        const originalPrice = firstItem.originalPrice || firstItem.price || 0
                        const discountPercent = firstItem.discountPercent || 0
                        featuredPrice = discountPercent > 0
                          ? Math.round(originalPrice * (1 - discountPercent / 100))
                          : originalPrice
                      }
                      break
                    }
                  }
                }

                return {
                  ...cafe,
                  menu: menu,
                  hasPaneer: hasPaneer,
                  featuredDish: featuredDish || null,
                  featuredPrice: featuredPrice || null,
                  categoryMatches: {},
                }
              }
              return {
                ...cafe,
                menu: null,
                hasPaneer: false,
                categoryMatches: {},
              }
            } catch (error) {
              console.warn(`Failed to fetch menu for cafe ${cafe.cafeId}:`, error)
              return {
                ...cafe,
                menu: null,
                hasPaneer: false,
                categoryMatches: {},
              }
            }
          })

          const transformedCafes = await Promise.all(menuPromises)
          setCafesData(transformedCafes)
        } else {
          setCafesData([])
        }
      } catch (error) {
        console.error('Error fetching cafes:', error)
        setCafesData([])
      } finally {
        setLoadingCafes(false)
      }
    }

    fetchCafes()
  }, [zoneId, isOutOfService, vegMode])

  // Update selected category when URL changes
  useEffect(() => {
    if (category && categories && categories.length > 0) {
      const categorySlug = category.toLowerCase()
      const matchedCategory = categories.find(cat =>
        cat.slug === categorySlug ||
        cat.id === categorySlug ||
        cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.slug || matchedCategory.id)
      } else {
        setSelectedCategory(categorySlug)
      }
    } else if (category) {
      setSelectedCategory(category.toLowerCase())
    }
  }, [category, categories])

  const toggleFilter = (filterId) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
    // Show loading when filter is toggled
    setIsLoadingFilterResults(true)
    setTimeout(() => {
      setIsLoadingFilterResults(false)
    }, 500)
  }

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setActiveScrollSection(sectionId)
            setActiveFilterTab(sectionId)
          }
        }
      })
    }, observerOptions)

    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isFilterOpen])

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleCategoryDishAddToCart = (event, dish, cafe) => {
    event.stopPropagation()

    if (selectedCategory === 'all') {
      return
    }

    if (!cafe?.name) {
      toast.error("Cafe information is missing. Please refresh the page.")
      return
    }

    const validCafeId = cafe?.cafeId || cafe?._id || cafe?.id
    if (!validCafeId) {
      toast.error("Cafe information is missing. Please refresh the page.")
      return
    }

    const itemId = dish?.itemId || `${validCafeId}-${dish?.name || "dish"}`
    const rect = event.currentTarget.getBoundingClientRect()
    const sourcePosition = {
      viewportX: rect.left + rect.width / 2,
      viewportY: rect.top + rect.height / 2,
      scrollX: window.pageXOffset || window.scrollX || 0,
      scrollY: window.pageYOffset || window.scrollY || 0,
      itemId,
    }

    const cartItem = {
      id: itemId,
      baseItemId: itemId,
      name: dish?.name,
      price: Number(dish?.price || 0),
      basePrice: Number(dish?.price || 0),
      image: dish?.image || null,
      cafe: cafe.name,
      cafeId: validCafeId,
      category: dish?.category || selectedCategory || null,
      categoryName: dish?.category || selectedCategory || null,
      description: dish?.description || `${dish?.name || "Dish"} from ${cafe.name}`,
      originalPrice: dish?.originalPrice || null,
      isVeg: dish?.foodType ? String(dish.foodType).toLowerCase() === "veg" : undefined,
      foodType: dish?.foodType || null,
    }

    try {
      addToCart(cartItem, sourcePosition)
    } catch (error) {
      toast.error(error?.message || "Error adding item to cart")
    }
  }

  // Filter cafes based on active filters and selected category
  // If category is selected, expand cafes into dish cards (one card per matching dish)
  const filteredRecommended = useMemo(() => {
    const sourceData = cafesData.length > 0 ? cafesData : []
    let filtered = [...sourceData]

    if (vegMode) {
      filtered = filtered.filter(isCafeAllowedByVegMode)
    }

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              // Create one card per dish
              categoryDishes.forEach((dish, index) => {
                expandedDishes.push({
                  ...r,
                  // Unique ID for each dish card
                  id: `${r.id}-dish-${dish.itemId || index}`,
                  dishId: dish.itemId || `${r.id}-dish-${index}`,
                  // Category dish info for this specific dish
                  categoryDish: dish,
                  categoryDishName: dish.name,
                  categoryDishPrice: dish.price,
                  categoryDishImage: dish.image,
                })
              })
            } else {
              // If no dishes found but menu exists, skip this cafe
            }
          }
        } else {
          // No menu - check other criteria
          if (r.category === selectedCategory) {
            expandedDishes.push(r)
          } else if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
            expandedDishes.push(r)
          } else {
            const keywords = categoryKeywords[selectedCategory] || []
            if (keywords.length > 0) {
              const featuredDishLower = (r.featuredDish || '').toLowerCase()
              const cuisineLower = (r.cuisine || '').toLowerCase()
              const nameLower = (r.name || '').toLowerCase()

              if (keywords.some(keyword =>
                featuredDishLower.includes(keyword) ||
                cuisineLower.includes(keyword) ||
                nameLower.includes(keyword)
              )) {
                expandedDishes.push(r)
              }
            }
          }
        }
      })

      filtered = expandedDishes
    }

    // Apply filters
    if (activeFilters.has('under-30-mins')) {
      filtered = filtered.filter(r => {
        if (!r.deliveryTime) return false
        const timeMatch = r.deliveryTime.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1]) <= 30
      })
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter(r => r.rating && r.rating >= 4.0)
    }
    if (activeFilters.has('flat-50-off')) {
      filtered = filtered.filter(r => r.offer && r.offer.includes('50%'))
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(query) ||
        r.cuisine?.toLowerCase().includes(query) ||
        r.featuredDish?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [selectedCategory, activeFilters, searchQuery, cafesData, categoryKeywords, vegMode])

  const filteredAllCafes = useMemo(() => {
    const sourceData = cafesData.length > 0 ? cafesData : []
    let filtered = [...sourceData]

    if (vegMode) {
      filtered = filtered.filter(isCafeAllowedByVegMode)
    }

    // Filter by category - Dynamic filtering based on menu items
    // If category is selected, expand cafes into dish cards (one card per matching dish)
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              // Create one card per dish
              categoryDishes.forEach((dish, index) => {
                // Filter by vegMode if enabled
                if (vegMode && dish.foodType !== "Veg") {
                  return // Skip non-veg dishes when vegMode is ON
                }

                expandedDishes.push({
                  ...r,
                  // Unique ID for each dish card
                  id: `${r.id}-dish-${dish.itemId || index}`,
                  dishId: dish.itemId || `${r.id}-dish-${index}`,
                  // Category dish info for this specific dish
                  categoryDish: dish,
                  categoryDishName: dish.name,
                  categoryDishPrice: dish.price,
                  categoryDishImage: dish.image,
                })
              })
            }
          }
        } else {
          // No menu - check other criteria
          if (r.category === selectedCategory) {
            expandedDishes.push(r)
          } else if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
            expandedDishes.push(r)
          } else {
            const keywords = categoryKeywords[selectedCategory] || []
            if (keywords.length > 0) {
              const featuredDishLower = (r.featuredDish || '').toLowerCase()
              const cuisineLower = (r.cuisine || '').toLowerCase()
              const nameLower = (r.name || '').toLowerCase()

              if (keywords.some(keyword =>
                featuredDishLower.includes(keyword) ||
                cuisineLower.includes(keyword) ||
                nameLower.includes(keyword)
              )) {
                expandedDishes.push(r)
              }
            }
          }
        }
      })

      filtered = expandedDishes
    }

    // Apply filters
    if (activeFilters.has('under-30-mins')) {
      filtered = filtered.filter(r => {
        if (!r.deliveryTime) return false
        const timeMatch = r.deliveryTime.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1]) <= 30
      })
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter(r => r.rating && r.rating >= 4.0)
    }
    if (activeFilters.has('under-250')) {
      filtered = filtered.filter(r => r.featuredPrice && r.featuredPrice <= 250)
    }
    if (activeFilters.has('flat-50-off')) {
      filtered = filtered.filter(r => r.offer && r.offer.includes('50%'))
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(query) ||
        r.cuisine?.toLowerCase().includes(query) ||
        r.featuredDish?.toLowerCase().includes(query)
      )
    }

    return dedupeCafeCards(filtered)
  }, [selectedCategory, activeFilters, searchQuery, cafesData, categoryKeywords, vegMode])

  useEffect(() => {
    if (expandedCafeId && !filteredAllCafes.some((cafe) => cafe.id === expandedCafeId)) {
      setExpandedCafeId(null)
    }
  }, [filteredAllCafes, expandedCafeId])

  // Get unique cuisines from cafe data for filters
  const availableCuisines = useMemo(() => {
    const cuisinesSet = new Set()
    cafesData.forEach(r => {
      if (r.cuisine) {
        r.cuisine.split(',').forEach(c => {
          const trimmed = c.trim()
          if (trimmed) cuisinesSet.add(trimmed)
        })
      }
    })

    // Fallback cuisines if none found in data
    const fallbacks = ['North Indian', 'Chinese', 'South Indian', 'Italian', 'Continental', 'Desserts', 'Fast Food', 'Beverages']
    const result = Array.from(cuisinesSet).sort()

    return result.length > 0 ? result : fallbacks
  }, [cafesData])

  const handleCategorySelect = (category) => {
    const categorySlug = category.slug || category.id
    setSelectedCategory(categorySlug)
    // Update URL to reflect category change
    if (categorySlug === 'all') {
      navigate('/user/category/all')
    } else {
      navigate(`/user/category/${categorySlug}`)
    }
  }

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = isOutOfService

  return (
    <div className={`min-h-screen bg-background ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-card shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar with Back Button */}
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-border">
            <button
              onClick={() => navigate('/user')}
              className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>

            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cafe name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11 md:h-12 rounded-lg border-border bg-muted focus:bg-card focus:border-primary text-sm md:text-base text-foreground placeholder:text-muted-foreground"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2">
              </button>
            </div>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-6 py-3 bg-card border-b border-border"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {loadingCategories ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading categories...</span>
              </div>
            ) : (
              categories && categories.length > 0 ? categories.map((cat) => {
                const categorySlug = cat.slug || cat.id
                const isSelected = selectedCategory === categorySlug || selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-primary' : ''
                      }`}
                  >
                    {cat.image && cat.id !== 'all' ? (
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-primary shadow-lg' : 'border-transparent'
                        }`}>
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to default image if category image fails to load
                            e.target.src = foodImages[0] || 'https://via.placeholder.com/100'
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted flex items-center justify-center border-2 transition-all ${isSelected ? 'border-primary shadow-lg bg-primary/10' : 'border-transparent'
                        }`}>
                        {cat.id === 'all' ? (
                          <UtensilsCrossed className={`h-7 w-7 md:h-9 md:w-9 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        ) : (
                          <span className="text-xl md:text-2xl">🍽️</span>
                        )}
                      </div>
                    )}
                    <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                      {cat.name}
                    </span>
                  </button>
                )
              }) : (
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm text-muted-foreground">No categories available</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {false && (
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:flex-wrap gap-2 px-4 md:px-6 py-3">
            {/* Row 2 */}
            <div
              className="flex items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide pb-1 md:pb-0"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {[
                { id: 'distance-under-1km', label: 'Under 1km', icon: MapPin },
                { id: 'distance-under-2km', label: 'Under 2km', icon: MapPin },
                { id: 'flat-50-off', label: 'Flat 50% OFF' },
                { id: 'under-250', label: 'Under ₹250' },
              ].map((filter) => {
                const Icon = filter.icon
                const isActive = activeFilters.has(filter.id)
                return (
                  <Button
                    key={filter.id}
                    variant="outline"
                    onClick={() => toggleFilter(filter.id)}
                    className={`h-7 md:h-8 px-2.5 md:px-3 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${isActive
                      ? 'bg-primary text-primary-foreground border border-primary hover:bg-primary/90'
                      : 'bg-card border border-border hover:bg-muted text-muted-foreground'
                      }`}
                  >
                    {Icon && <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isActive ? 'text-primary-foreground' : 'text-foreground'}`} />}
                    <span className={`text-xs md:text-sm font-bold ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>{filter.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
        <div className="max-w-7xl mx-auto">
          {/* RECOMMENDED FOR YOU Section */}
          {false && filteredRecommended.length > 0 && selectedCategory === 'all' && (
            <section>
              <h2 className="text-xs sm:text-sm md:text-base font-semibold text-muted-foreground tracking-widest uppercase mb-4 md:mb-6">
                RECOMMENDED FOR YOU
              </h2>

              {/* Small Cafe Cards - Grid - Show all dishes when category is selected */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                {(selectedCategory && selectedCategory !== 'all'
                  ? filteredRecommended
                  : filteredRecommended.slice(0, 6)
                ).map((cafe) => {
                  return (
                    <Link
                      key={cafe.id}
                      to={`/user/cafes/${cafe.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="block"
                    >
                      <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                        {/* Image Container */}
                        <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden mb-2">
                          {/* Use category dish image if available, otherwise cafe image */}
                          {cafe.categoryDishImage ? (
                            <img
                              src={cafe.categoryDishImage}
                              alt={cafe.categoryDishName || cafe.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Fallback to cafe image if dish image fails
                                if (cafe.image) {
                                  e.target.src = cafe.image
                                } else {
                                  // Show emoji placeholder
                                  e.target.style.display = 'none'
                                  const placeholder = document.createElement('div')
                                  placeholder.className = 'w-full h-full flex items-center justify-center bg-muted text-6xl'
                                  placeholder.textContent = '🍽️'
                                  e.target.parentElement.appendChild(placeholder)
                                }
                              }}
                            />
                          ) : cafe.image ? (
                            <img
                              src={cafe.image}
                              alt={cafe.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-muted text-6xl'
                                placeholder.textContent = '🍽️'
                                e.target.parentElement.appendChild(placeholder)
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted text-6xl">
                              🍽️
                            </div>
                          )}

                          {/* Offer Badge */}
                          {cafe.offer && (
                            <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded">
                              {cafe.offer}
                            </div>
                          )}

                          {/* Rating Badge (NOW ON IMAGE, bottom-left with white border) */}
                          <div className="absolute bottom-0 left-0 bg-primary border-[4px] rounded-md border-background text-primary-foreground text-[11px] md:text-xs font-bold px-1.5 py-0.5 flex items-center gap-0.5">
                            {cafe.rating}
                            <Star className="h-2.5 w-2.5 md:h-3 md:w-3 fill-primary-foreground" />
                          </div>
                        </div>

                        {/* Cafe Info - Show category dish name if available, otherwise cafe name */}
                        <h3 className="font-semibold text-foreground text-xs md:text-sm line-clamp-1">
                          {cafe.categoryDishName || cafe.name}
                        </h3>
                        <div className="flex items-center gap-1 text-muted-foreground text-[10px] md:text-xs">
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span>{cafe.deliveryTime || 'Not available'}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ALL CAFES Section */}
          <section className="relative">
            <h2 className="text-xs sm:text-sm md:text-base font-semibold text-muted-foreground tracking-widest uppercase mb-4 md:mb-6">
              RECOMMENDED FOR YOU
            </h2>

            {/* Loading Overlay */}
            {isLoadingFilterResults && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-foreground">Loading cafes...</span>
                </div>
              </div>
            )}

            {/* Large Cafe Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6 xl:gap-7 items-stretch ${isLoadingFilterResults ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}>
              {filteredAllCafes.map((cafe) => {
                const cafeSlug = cafe.name.toLowerCase().replace(/\s+/g, "-")
                const matchedDishes = selectedCategory === 'all'
                  ? getPreviewDishesFromMenu(cafe.menu, { vegOnly: vegMode })
                  : (Array.isArray(cafe.matchedDishes) ? cafe.matchedDishes : [])
                const hasDynamicRating = cafe.rating !== null && cafe.rating !== undefined && cafe.rating !== ""
                const isCategoryCafeCard = matchedDishes.length > 0
                const isExpanded = expandedCafeId === cafe.id
                const cardHeroImage = cafe.profileImage || cafe.image

                const cardContent = (
                  <Card className={`overflow-hidden cursor-pointer gap-0 border border-[#f3d8ad] group bg-gradient-to-b from-[#fffaf4] via-white to-[#fff8ef] shadow-[0_16px_40px_rgba(222,116,34,0.14)] hover:shadow-[0_20px_48px_rgba(222,116,34,0.2)] transition-all duration-300 py-0 rounded-[22px] h-full flex flex-col w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''
                    }`}>
                    {/* Image Section */}
                      <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-[22px] flex-shrink-0">
                        {cardHeroImage ? (
                          <img
                            src={cardHeroImage}
                            alt={cafe.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              if (cafe.image && cardHeroImage !== cafe.image) {
                                e.target.src = cafe.image
                              } else {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-muted text-6xl'
                                placeholder.textContent = '🍽️'
                                e.target.parentElement.appendChild(placeholder)
                              }
                            }}
                          />
                        ) : cafe.image ? (
                          <img
                            src={cafe.image}
                            alt={cafe.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Show emoji placeholder
                              e.target.style.display = 'none'
                              const placeholder = document.createElement('div')
                              placeholder.className = 'w-full h-full flex items-center justify-center bg-muted text-6xl'
                              placeholder.textContent = '🍽️'
                              e.target.parentElement.appendChild(placeholder)
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted text-6xl">
                            🍽️
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />

                        {/* Ad Badge */}
                        {cafe.isAd && (
                          <div className="absolute top-3 right-14 bg-white/90 backdrop-blur-sm text-[#9a3412] text-[10px] md:text-xs px-2 py-0.5 rounded-full border border-[#f3d8ad] shadow-sm">
                            Ad
                          </div>
                        )}

                      </div>

                      {/* Content Section */}
                      <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6 gap-0 flex-1 flex flex-col bg-[#f8f4ee]">
                        <div className="rounded-[26px] border border-[#efe5d7] bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(30,18,8,0.06)]">
                          {isCategoryCafeCard && (
                            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#eadfce] pb-4">
                              <div className="min-w-0">
                                <h3 className="text-lg sm:text-xl font-semibold text-[#24160b] line-clamp-1">
                                  {cafe.name}
                                </h3>
                                <p className="mt-1 text-sm text-[#8b5e34] line-clamp-2">
                                  {cafe.cuisine || 'Cafe details'}
                                </p>
                              </div>
                              <div className="inline-flex items-center gap-1 rounded-full bg-[#fff5e9] px-3 py-1 text-xs font-semibold text-[#ba3f19] whitespace-nowrap">
                                {isExpanded ? 'Hide dishes' : 'Show dishes'}
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          )}

                          <div className={`grid grid-cols-3 gap-3 ${isCategoryCafeCard ? 'pt-4' : 'border-b border-dashed border-[#eadfce] pb-4'}`}>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[#b6a18a]">Rating</p>
                              <div className="mt-1 inline-flex items-center gap-1 text-[#24160b]">
                                <span className="text-base sm:text-lg font-bold">{hasDynamicRating ? cafe.rating : "N/A"}</span>
                                {hasDynamicRating && (
                                  <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[#b6a18a]">Time</p>
                              <div className="mt-1 inline-flex items-center gap-1.5 text-[#24160b]">
                                <Clock className="h-4 w-4 text-[#8b5e34]" strokeWidth={1.8} />
                                <span className="text-sm sm:text-base font-semibold">{cafe.deliveryTime || 'N/A'}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[#b6a18a]">Dishes</p>
                              <p className="mt-1 text-sm sm:text-base font-semibold text-[#24160b]">
                                {matchedDishes.length}
                              </p>
                            </div>
                          </div>

                        {isCategoryCafeCard && isExpanded && matchedDishes.length > 0 && (
                          <div className="pt-4">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[#b6a18a] mb-3">
                              Related Dishes
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {matchedDishes.map((dish, index) => (
                                <div
                                  key={`${dish.itemId || `${cafe.id}-matched`}-${index}`}
                                  className={`overflow-hidden rounded-[22px] border border-[#f1e5d3] bg-[#fffaf4] shadow-[0_10px_24px_rgba(25,17,8,0.06)] ${selectedCategory !== 'all' ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''}`}
                                  onClick={selectedCategory !== 'all' ? (event) => handleCategoryDishAddToCart(event, dish, cafe) : undefined}
                                >
                                  <div className="relative aspect-[1.05] w-full overflow-hidden bg-[#f4eadc]">
                                    {dish.image ? (
                                      <img
                                        src={dish.image}
                                        alt={dish.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-5xl">
                                        🍽️
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-3">
                                    <p className="text-sm font-semibold text-[#2a180c] line-clamp-2">
                                      {dish.name}
                                    </p>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <span className="text-base font-bold text-[#ba3f19] whitespace-nowrap">
                                        ₹{Number(dish.price || 0).toLocaleString('en-IN')}
                                      </span>
                                      {dish.foodType && (
                                        <span className="inline-flex items-center rounded-full bg-[#f6fff0] px-2 py-0.5 text-[11px] text-[#5b7f2b] whitespace-nowrap border border-[#d9efb9]">
                                          {dish.foodType}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-4">
                              <Link
                                to={`/user/cafes/${cafeSlug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center rounded-full border border-[#e6d2b4] bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#9a3412] transition-colors hover:bg-[#fff1dd]"
                              >
                                Open cafe
                              </Link>
                            </div>
                          </div>
                        )}

                        </div>
                      </CardContent>
                    </Card>
                )

                return isCategoryCafeCard ? (
                  <div key={cafe.id} className="h-full flex">
                    <div
                      className="h-full w-full"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedCafeId((currentId) => currentId === cafe.id ? null : cafe.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedCafeId((currentId) => currentId === cafe.id ? null : cafe.id)
                        }
                      }}
                    >
                      {cardContent}
                    </div>
                  </div>
                ) : (
                  <Link key={cafe.id} to={`/user/cafes/${cafeSlug}`} className="h-full flex">
                    {cardContent}
                  </Link>
                )
              })}
            </div>

            {/* Empty State */}
            {filteredAllCafes.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <p className="text-muted-foreground text-sm md:text-base">
                  {searchQuery
                    ? `No cafes found for "${searchQuery}"`
                    : "No cafes found with selected filters"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 md:mt-6"
                  onClick={() => {
                    setActiveFilters(new Set())
                    setSearchQuery("")
                    setSelectedCategory('all')
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isFilterOpen && (
              <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-background/50"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-card rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
                    <h2 className="text-lg md:text-xl font-bold text-foreground">Filters and sorting</h2>
                    <button
                      onClick={() => {
                        setActiveFilters(new Set())
                        setSortBy(null)
                        setSelectedCuisine(null)
                      }}
                      className="text-primary font-medium text-sm md:text-base"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 md:w-32 bg-muted/30 border-r border-border flex flex-col">
                      {[
                        { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                        { id: 'time', label: 'Time', icon: Timer },
                        { id: 'rating', label: 'Rating', icon: Star },
                        { id: 'distance', label: 'Distance', icon: MapPin },
                        { id: 'price', label: 'Dish Price', icon: IndianRupee },
                        { id: 'cuisine', label: 'Cuisine', icon: UtensilsCrossed },
                        { id: 'offers', label: 'Offers', icon: BadgePercent },
                        { id: 'trust', label: 'Trust', icon: ShieldCheck },
                      ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveFilterTab(tab.id)
                              const section = filterSectionRefs.current[tab.id]
                              if (section) {
                                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-card text-primary' : 'text-muted-foreground hover:bg-muted'
                              }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                            )}
                            <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                            <span className="text-xs md:text-sm font-medium leading-tight">{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Right Content Area - Scrollable */}
                    <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
                      {/* Sort By Tab */}
                      <div
                        ref={el => filterSectionRefs.current['sort'] = el}
                        data-section-id="sort"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Sort by</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { id: null, label: 'Relevance' },
                            { id: 'price-low', label: 'Price: Low to High' },
                            { id: 'price-high', label: 'Price: High to Low' },
                            { id: 'rating-high', label: 'Rating: High to Low' },
                            { id: 'rating-low', label: 'Rating: Low to High' },
                          ].map((option) => (
                            <button
                              key={option.id || 'relevance'}
                              onClick={() => setSortBy(option.id)}
                              className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${sortBy === option.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary'
                                }`}
                            >
                              <span className={`text-sm md:text-base font-medium ${sortBy === option.id ? 'text-primary' : 'text-foreground'}`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div
                        ref={el => filterSectionRefs.current['time'] = el}
                        data-section-id="time"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Delivery Time</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('under-30-mins')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('under-30-mins')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('under-30-mins') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-30-mins') ? 'text-primary' : 'text-foreground'}`}>Under 30 mins</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('delivery-under-45')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('delivery-under-45') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('delivery-under-45') ? 'text-primary' : 'text-foreground'}`}>Under 45 mins</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div
                        ref={el => filterSectionRefs.current['rating'] = el}
                        data-section-id="rating"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Cafe Rating</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('rating-35-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-35-plus') ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-35-plus') ? 'text-primary' : 'text-foreground'}`}>Rated 3.5+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-4-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-4-plus') ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-4-plus') ? 'text-primary' : 'text-foreground'}`}>Rated 4.0+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-45-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-45-plus') ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-45-plus') ? 'text-primary' : 'text-foreground'}`}>Rated 4.5+</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div
                        ref={el => filterSectionRefs.current['distance'] = el}
                        data-section-id="distance"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Distance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('distance-under-1km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-1km') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-1km') ? 'text-primary' : 'text-foreground'}`}>Under 1 km</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('distance-under-2km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-2km') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-2km') ? 'text-primary' : 'text-foreground'}`}>Under 2 km</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div
                        ref={el => filterSectionRefs.current['price'] = el}
                        data-section-id="price"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Dish Price</h3>
                        <div className="flex flex-col gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('price-under-200')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-200') ? 'text-primary' : 'text-foreground'}`}>Under ₹200</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('under-250')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('under-250')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-250') ? 'text-primary' : 'text-foreground'}`}>Under ₹250</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-under-500')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-500') ? 'text-primary' : 'text-foreground'}`}>Under ₹500</span>
                          </button>
                        </div>
                      </div>

                      {/* Cuisine Tab */}
                      <div
                        ref={el => filterSectionRefs.current['cuisine'] = el}
                        data-section-id="cuisine"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Cuisine</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                          {availableCuisines.map((cuisine) => (
                            <button
                              key={cuisine}
                              onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
                              className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-center transition-colors ${selectedCuisine === cuisine
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary'
                                }`}
                            >
                              <span className={`text-sm md:text-base font-medium ${selectedCuisine === cuisine ? 'text-primary' : 'text-foreground'}`}>
                                {cuisine}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Offers Tab */}
                      <div
                        ref={el => filterSectionRefs.current['offers'] = el}
                        data-section-id="offers"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4">Offers</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('flat-50-off')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('flat-50-off')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('flat-50-off') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('flat-50-off') ? 'text-primary' : 'text-foreground'}`}>Flat 50% OFF</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-match')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('price-match')
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('price-match') ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-match') ? 'text-primary' : 'text-foreground'}`}>Price Match</span>
                          </button>
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' && (
                        <div className="space-y-4">
                          <h3 className="text-lg md:text-xl font-semibold text-foreground">Trust Markers</h3>
                          <div className="flex flex-col gap-3 md:gap-4">
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-border hover:border-primary text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-foreground">Top Rated</span>
                            </button>
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-border hover:border-primary text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-foreground">Trusted by 1000+ users</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-t border-border bg-card">
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 py-3 md:py-4 text-center font-semibold text-foreground text-sm md:text-base"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true)
                        setIsFilterOpen(false)
                        // Simulate loading for 500ms
                        setTimeout(() => {
                          setIsLoadingFilterResults(false)
                        }, 500)
                      }}
                      className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${activeFilters.size > 0 || sortBy || selectedCuisine
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground'
                        }`}
                    >
                      {activeFilters.size > 0 || sortBy || selectedCuisine
                        ? 'Show results'
                        : 'Show results'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
