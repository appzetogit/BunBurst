import { useState, useMemo, useRef, useEffect } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, Mic, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import StickyCartCard from "../components/StickyCartCard"
import { useProfile } from "../context/ProfileContext"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"
import { cafeAPI, adminAPI } from "@/lib/api"

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images"

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]

// Mock data removed - using backend data only

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get("q") || ""
  const navigate = useNavigate()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const { vegMode } = useProfile()
  const [searchQuery, setSearchQuery] = useState(query)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const categoryScrollRef = useRef(null)
  const [cafesData, setCafesData] = useState([])
  const [loadingCafes, setLoadingCafes] = useState(true)
  const [categories, setCategories] = useState([
    { id: 'all', name: "All", image: foodImages[7] }
  ])
  const [loadingCategories, setLoadingCategories] = useState(true)
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
            { id: 'all', name: "All", image: foodImages[7] },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || foodImages[0],
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
            // Split by common separators and use individual words
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
        // Keep default "All" category on error
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

    // Get keywords for this category
    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return false
    }

    // Check sections and items for category keywords
    for (const section of menu.sections) {
      // Check section name
      const sectionNameLower = (section.name || '').toLowerCase()
      if (keywords.some(keyword => sectionNameLower.includes(keyword))) {
        return true
      }

      // Check items in section
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          // Check item name
          const itemNameLower = (item.name || '').toLowerCase()
          if (keywords.some(keyword => itemNameLower.includes(keyword))) {
            return true
          }
          // Check item category
          const itemCategoryLower = (item.category || '').toLowerCase()
          if (keywords.some(keyword => itemCategoryLower.includes(keyword))) {
            return true
          }
        }
      }
    }

    return false
  }

  // Helper function to get featured dish for a category from menu
  const getCategoryDishFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return null
    }

    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return null
    }

    // Find first matching item
    for (const section of menu.sections) {
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.category || '').toLowerCase()

          if (keywords.some(keyword =>
            itemNameLower.includes(keyword) || itemCategoryLower.includes(keyword)
          )) {
            return item.name
          }
        }
      }
    }

    return null
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

            // Common default values from backend model
            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"
            ]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249

            if (fieldName === 'offer' && defaultOffers.includes(value)) {
              return true
            }
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) {
              return true
            }
            if (fieldName === 'distance' && defaultDistances.includes(value)) {
              return true
            }
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) {
              return true
            }

            return false
          }

          // First transform cafes without menu data - USE ONLY BACKEND DATA
          // Filter out cafes with only default/mock data
          const cafesWithIds = cafesArray
            .filter((cafe) => {
              // Only require a valid name to allow search by cafe name
              const hasName = cafe.name && cafe.name.trim().length > 0
              return hasName
            })
            .map((cafe) => {
              // Use backend data directly - filter out default values
              let deliveryTime = cafe.estimatedDeliveryTime || null
              let distance = cafe.distance || null
              let offer = cafe.offer || null

              // Filter out default values
              if (isDefaultValue(deliveryTime, 'deliveryTime')) {
                deliveryTime = null
              }
              if (isDefaultValue(distance, 'distance')) {
                distance = null
              }
              if (isDefaultValue(offer, 'offer')) {
                offer = null
              }

              const cuisine = cafe.cuisines && cafe.cuisines.length > 0
                ? cafe.cuisines.join(", ")
                : null

              // Get images from backend only
              const coverImages = cafe.coverImages && cafe.coverImages.length > 0
                ? cafe.coverImages.map(img => img.url || img).filter(Boolean)
                : []

              const fallbackImages = cafe.menuImages && cafe.menuImages.length > 0
                ? cafe.menuImages.map(img => img.url || img).filter(Boolean)
                : []

              // Use backend images only - no fallback placeholder
              const allImages = coverImages.length > 0
                ? coverImages
                : (fallbackImages.length > 0
                  ? fallbackImages
                  : (cafe.profileImage?.url ? [cafe.profileImage.url] : []))

              const image = allImages[0] || null // Will be handled in UI
              const cafeId = cafe.cafeId || cafe._id

              let featuredDish = cafe.featuredDish || null
              let featuredPrice = cafe.featuredPrice || null

              // Filter out default featured price
              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
                featuredPrice = null
              }

              return {
                id: cafeId,
                name: cafe.name,
                cuisine: cuisine,
                rating: cafe.rating || null, // Use backend rating or null
                deliveryTime: deliveryTime,
                distance: distance,
                image: image,
                images: allImages,
                priceRange: cafe.priceRange || null,
                featuredDish: featuredDish, // Will be set from menu if available
                featuredPrice: featuredPrice, // Will be set from menu if available
                offer: offer, // Use backend offer or null (defaults filtered out)
                slug: cafe.slug || cafe.name?.toLowerCase().replace(/\s+/g, '-'),
                cafeId: cafeId,
                hasPaneer: false, // Will be updated after menu fetch
                category: 'all',
                restaurantType: cafe.restaurantType || cafe.restaurant_type || null,
              }
            })

          // Fetch menus for all cafes in parallel
          const menuPromises = cafesWithIds.map(async (cafe) => {
            try {
              const menuResponse = await cafeAPI.getMenuByCafeId(cafe.cafeId)
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const menu = menuResponse.data.data.menu

                // Store menu data for dynamic filtering
                const hasPaneer = checkCategoryInMenu(menu, 'paneer-tikka')

                // Get featured dish and price from menu if not set in cafe
                let featuredDish = cafe.featuredDish
                let featuredPrice = cafe.featuredPrice

                // If featured dish/price not set, get from first available menu item
                if (!featuredDish || !featuredPrice) {
                  for (const section of (menu.sections || [])) {
                    if (section.items && section.items.length > 0) {
                      const firstItem = section.items[0]
                      if (!featuredDish) featuredDish = firstItem.name
                      if (!featuredPrice) {
                        // Calculate final price considering discounts
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
              // If menu fetch fails, keep cafe without menu data
              console.warn(`Failed to fetch menu for cafe ${cafe.cafeId}:`, error)
              return {
                ...cafe,
                menu: null,
                hasPaneer: false,
                categoryMatches: {},
              }
            }
          })

          // Wait for all menu fetches to complete
          const transformedCafes = await Promise.all(menuPromises)

          setCafesData(transformedCafes)
        } else {
          console.warn('⚠️ No cafes in API response. Response structure:', {
            hasData: !!response.data,
            hasSuccess: response.data?.success,
            hasDataField: !!response.data?.data,
            hasCafes: !!response.data?.data?.cafes,
            fullResponse: response.data
          })
          setCafesData([])
        }
      } catch (error) {
        console.error('❌ Error fetching cafes:', error)
        console.error('❌ Error response:', error.response?.data)
        setCafesData([])
      } finally {
        setLoadingCafes(false)
      }
    }

    fetchCafes()
  }, [zoneId, isOutOfService, vegMode])

  // Update search query when URL changes
  useEffect(() => {
    if (query) {
      setSearchQuery(query)
      // Try to match query to a category
      const matchedCategory = categories.find(cat =>
        cat.name.toLowerCase() === query.toLowerCase() ||
        cat.id === query.toLowerCase().replace(/\s+/g, '-')
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id)
      }
    }
  }, [query])

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
  }

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

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim() })
    }
  }

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId)
    // Update search query to match category name
    const category = categories.find(c => c.id === catId)
    if (category && category.id !== 'all') {
      setSearchQuery(category.name)
      setSearchParams({ q: category.name })
    } else {
      setSearchQuery("")
      setSearchParams({})
    }
  }

  // Filter cafes based on search query, selected category, and filters
  const filteredRecommended = useMemo(() => {
    // Use ONLY backend data - no hardcoded fallback
    const sourceData = cafesData.length > 0 ? cafesData : []
    let filtered = [...sourceData]

    if (vegMode) {
      filtered = filtered.filter(isCafeAllowedByVegMode)
    }

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(lowerQuery) ||
        r.cuisine?.toLowerCase().includes(lowerQuery) ||
        r.featuredDish?.toLowerCase().includes(lowerQuery) ||
        r.category === selectedCategory
      )
    }

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(r => {
        // If cafe has menu data, check menu for category items
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Update featured dish for this category
            const categoryDish = getCategoryDishFromMenu(r.menu, selectedCategory)
            if (categoryDish && !r.categoryFeaturedDish) {
              r.categoryFeaturedDish = categoryDish
            }
            return true
          }
          // If menu exists but no match, don't show (menu was checked)
          return false
        }

        // Fallback for hardcoded data or cafes without menu
        // Check if cafe matches category (hardcoded data)
        if (r.category === selectedCategory) {
          return true
        }

        // For paneer-tikka (backward compatibility)
        if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
          return true
        }

        // Check featured dish and cuisine for category keywords
        const keywords = categoryKeywords[selectedCategory] || []
        if (keywords.length > 0) {
          const featuredDishLower = (r.featuredDish || '').toLowerCase()
          const cuisineLower = (r.cuisine || '').toLowerCase()
          const nameLower = (r.name || '').toLowerCase()

          const matches = keywords.some(keyword =>
            featuredDishLower.includes(keyword) ||
            cuisineLower.includes(keyword) ||
            nameLower.includes(keyword)
          )

          if (matches) return true
        }

        // If no match found, don't show cafe for this category
        return false
      })
    } else if (!query.trim()) {
      // Show all cafes when no category selected (category is 'all')
      // Don't filter - show all cafes
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

    return filtered
  }, [query, selectedCategory, activeFilters, cafesData, categoryKeywords, loadingCategories, vegMode])

  const filteredAllCafes = useMemo(() => {
    // Use ONLY backend data - no hardcoded fallback
    const sourceData = cafesData.length > 0 ? cafesData : []
    let filtered = [...sourceData]

    if (vegMode) {
      filtered = filtered.filter(isCafeAllowedByVegMode)
    }

    // Filter by search query - Search in name, cuisine, featured dish
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(r => {
        const nameMatch = r.name?.toLowerCase().includes(lowerQuery)
        const cuisineMatch = r.cuisine?.toLowerCase().includes(lowerQuery)
        const dishMatch = r.featuredDish?.toLowerCase().includes(lowerQuery)

        // Also search in menu items if menu is available
        let menuMatch = false
        if (r.menu && r.menu.sections) {
          for (const section of r.menu.sections) {
            if (section.items) {
              for (const item of section.items) {
                if (item.name?.toLowerCase().includes(lowerQuery) ||
                  item.category?.toLowerCase().includes(lowerQuery)) {
                  menuMatch = true
                  break
                }
              }
            }
            if (menuMatch) break
          }
        }

        return nameMatch || cuisineMatch || dishMatch || menuMatch || r.category === selectedCategory
      })
    }

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(r => {
        // If cafe has menu data, check menu for category items
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Update featured dish for this category
            const categoryDish = getCategoryDishFromMenu(r.menu, selectedCategory)
            if (categoryDish && !r.categoryFeaturedDish) {
              r.categoryFeaturedDish = categoryDish
            }
            return true
          }
          // If menu exists but no match, don't show (menu was checked)
          return false
        }

        // Fallback for hardcoded data or cafes without menu
        // Check if cafe matches category (hardcoded data)
        if (r.category === selectedCategory) {
          return true
        }

        // For paneer-tikka (backward compatibility)
        if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
          return true
        }

        // Check featured dish and cuisine for category keywords
        const keywords = categoryKeywords[selectedCategory] || []
        if (keywords.length > 0) {
          const featuredDishLower = (r.featuredDish || '').toLowerCase()
          const cuisineLower = (r.cuisine || '').toLowerCase()
          const nameLower = (r.name || '').toLowerCase()

          const matches = keywords.some(keyword =>
            featuredDishLower.includes(keyword) ||
            cuisineLower.includes(keyword) ||
            nameLower.includes(keyword)
          )

          if (matches) return true
        }

        // If no match found, don't show cafe for this category
        return false
      })
    } else if (!query.trim()) {
      // Show all cafes when no category selected (category is 'all')
      // Don't filter - show all cafes
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

    return filtered
  }, [query, selectedCategory, activeFilters, cafesData, categoryKeywords, loadingCategories, vegMode])

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = isOutOfService

  return (
    <div className={`min-h-screen bg-background ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-card shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar with Back Button */}
          <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 border-b border-border">
            <button
              onClick={() => navigate('/user')}
              className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-foreground/80" />
            </button>

            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cafe name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-lg border-border bg-muted focus:bg-card focus:border-primary text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Mic className="h-4 w-4 text-muted-foreground" />
              </button>
            </form>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-card border-b border-border"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-primary' : ''
                    }`}
                >
                  {cat.image ? (
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-primary shadow-lg' : 'border-transparent'
                      }`}>
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 transition-all ${isSelected ? 'border-primary shadow-lg bg-primary/10' : 'border-transparent'
                      }`}>
                      <span className="text-xl">🍽️</span>
                    </div>
                  )}
                  <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filters */}
          <div
            className="flex items-center gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-card border-b border-border"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {/* Filter Button */}
            <Button
              variant="outline"
              className="h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-medium bg-card border border-border hover:bg-muted text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm font-bold">Filters</span>
              <ChevronDown className="h-3 w-3" />
            </Button>

            {/* Filter Options */}
            {filterOptions.map((filter) => {
              const isActive = activeFilters.has(filter.id)
              return (
                <Button
                  key={filter.id}
                  variant="outline"
                  onClick={() => toggleFilter(filter.id)}
                  className={`h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-all font-medium ${isActive
                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                    : 'bg-card border border-border hover:bg-muted text-muted-foreground'
                    }`}
                >
                  {filter.hasIcon && filter.id === 'price-match' && (
                    <span className={`text-xs ${isActive ? 'text-primary-foreground' : 'text-primary'}`}>✓</span>
                  )}
                  {filter.hasIcon && filter.id === 'flat-50-off' && (
                    <span className={`text-xs ${isActive ? 'text-primary-foreground' : 'text-primary'}`}>★</span>
                  )}
                  <span className={`text-sm font-bold ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>{filter.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Loading State */}
        {loadingCafes && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading cafes...</span>
          </div>
        )}

        {/* RECOMMENDED FOR YOU Section */}
        {!loadingCafes && filteredRecommended.length > 0 && (
          <section>
            <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground tracking-widest uppercase mb-4">
              RECOMMENDED FOR YOU
            </h2>

            {/* Small Cafe Cards - Horizontal Scroll */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
              {filteredRecommended.slice(0, 6).map((cafe) => {
                return (
                  <Link
                    key={cafe.id}
                    to={`/user/cafes/${cafe.slug || cafe.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className="block"
                  >
                    <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                      {/* Image Container */}
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-muted">
                        {cafe.image ? (
                          <img
                            src={cafe.image}
                            alt={cafe.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl">🍽️</span>
                          </div>
                        )}
                        {/* Offer Badge - Only show if offer exists */}
                        {cafe.offer && (
                          <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            {cafe.offer}
                          </div>
                        )}
                      </div>

                      {/* Rating Badge - Only show if rating exists */}
                      {cafe.rating && (
                        <div className="flex items-center gap-1 mb-1">
                          <div className="bg-primary text-primary-foreground text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            {cafe.rating}
                            <Star className="h-2.5 w-2.5 fill-primary-foreground" />
                          </div>
                        </div>
                      )}

                      {/* Cafe Info */}
                      <h3 className="font-semibold text-foreground text-xs line-clamp-1">
                        {cafe.name}
                      </h3>
                      {cafe.deliveryTime && (
                        <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{cafe.deliveryTime}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ALL CAFES Section */}
        <section>
          <h2 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4">
            ALL CAFES
          </h2>

          {/* Large Cafe Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {filteredAllCafes.map((cafe) => {
              const cafeSlug = cafe.name.toLowerCase().replace(/\s+/g, "-")
              const isFavorite = favorites.has(cafe.id)

              return (
                <Link key={cafe.id} to={`/user/cafes/${cafe.slug || cafeSlug}`} className="h-full flex">
                  <Card className={`overflow-hidden cursor-pointer border-0 group bg-card shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-md flex flex-col h-full w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''
                    }`}>
                    {/* Image Section */}
                    <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0 bg-muted">
                      {cafe.image ? (
                        <img
                          src={cafe.image}
                          alt={cafe.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <span className="text-4xl">🍽️</span>
                        </div>
                      )}

                      {/* Featured Dish Badge - Top Left - Only show if data exists */}
                      {(() => {
                        let displayText = null

                        // If category is selected and cafe has menu, show category-specific dish
                        if (selectedCategory && selectedCategory !== 'all' && cafe.menu) {
                          const categoryDish = getCategoryDishFromMenu(cafe.menu, selectedCategory)
                          if (categoryDish && cafe.featuredPrice) {
                            displayText = `${categoryDish} · ₹${cafe.featuredPrice}`
                          }
                        }

                        // Fallback to featured dish
                        if (!displayText && cafe.featuredDish && cafe.featuredPrice) {
                          displayText = `${cafe.featuredDish} · ₹${cafe.featuredPrice}`
                        }

                        return displayText ? (
                          <div className="absolute top-3 left-3">
                            <div className="bg-card/80 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium">
                              {displayText}
                            </div>
                          </div>
                        ) : null
                      })()}

                      {/* Ad Badge */}
                      {cafe.isAd && (
                        <div className="absolute top-3 right-14 bg-muted/80 text-muted-foreground text-[10px] px-2 py-0.5 rounded">
                          Ad
                        </div>
                      )}

                      {/* Bookmark Icon - Top Right */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 h-9 w-9 bg-card/90 backdrop-blur-sm rounded-lg hover:bg-card transition-colors"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(cafe.id)
                        }}
                      >
                        <Bookmark className={`h-5 w-5 ${isFavorite ? "fill-primary text-primary" : "text-muted-foreground"}`} strokeWidth={2} />
                      </Button>
                    </div>

                    {/* Content Section */}
                    <CardContent className="p-3 sm:p-4 lg:p-5 flex flex-col flex-grow">
                      {/* Cafe Name & Rating */}
                      <div className="flex items-start justify-between gap-2 mb-2 lg:mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground line-clamp-1 lg:line-clamp-2">
                            {cafe.name}
                          </h3>
                        </div>
                        {cafe.rating && (
                          <div className="flex-shrink-0 bg-primary text-primary-foreground px-2 py-1 lg:px-3 lg:py-1.5 rounded-lg flex items-center gap-1">
                            <span className="text-sm lg:text-base font-bold">{cafe.rating}</span>
                            <Star className="h-3 w-3 lg:h-4 lg:w-4 fill-primary-foreground text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Delivery Time & Distance - Only show if data exists */}
                      {(cafe.deliveryTime || cafe.distance) && (
                        <div className="flex items-center gap-1 text-sm lg:text-base text-muted-foreground mb-2 lg:mb-3">
                          {cafe.deliveryTime && (
                            <>
                              <Clock className="h-4 w-4 lg:h-5 lg:w-5" strokeWidth={1.5} />
                              <span className="font-medium">{cafe.deliveryTime}</span>
                            </>
                          )}
                          {cafe.deliveryTime && cafe.distance && (
                            <span className="mx-1">|</span>
                          )}
                          {cafe.distance && (
                            <span className="font-medium">{cafe.distance}</span>
                          )}
                        </div>
                      )}

                      {/* Offer Badge */}
                      {cafe.offer && (
                        <div className="flex items-center gap-2 text-sm lg:text-base mt-auto">
                          <BadgePercent className="h-4 w-4 lg:h-5 lg:w-5 text-primary" strokeWidth={2} />
                          <span className="text-foreground/80 font-medium">{cafe.offer}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            {/* Empty State */}
            {filteredAllCafes.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {query
                    ? `No cafes found for "${query}"`
                    : "No cafes found with selected filters"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => {
                    setActiveFilters(new Set())
                    setSearchQuery("")
                    setSelectedCategory('all')
                    setSearchParams({})
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </section>
      </div >
      <StickyCartCard />
    </div >
  )
}
