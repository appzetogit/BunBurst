import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { X, Search, Clock, UtensilsCrossed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images"
import VoiceSearchOverlay from "./VoiceSearchOverlay"
import { adminAPI, cafeAPI } from "@/lib/api"
import { useProfile } from "../context/ProfileContext"

// Local storage key for recent searches
const RECENT_SEARCHES_KEY = 'bun_burst_recent_searches';

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange, autoStartVoice }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { vegMode } = useProfile()
  const inputRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [filteredFoods, setFilteredFoods] = useState([])
  const [cafes, setCafes] = useState([])
  const [filteredCafes, setFilteredCafes] = useState([])
  const [recentSuggestions, setRecentSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingCafes, setLoadingCafes] = useState(false)

  const normalizeRestaurantType = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")

  const isCafeAllowedByVegMode = (cafe) => {
    if (!vegMode) return true
    const type = normalizeRestaurantType(cafe?.restaurantType)
    return type !== "nonveg"
  }
  const [isListening, setIsListening] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }

    if (isOpen && autoStartVoice) {
      const timer = setTimeout(() => {
        startVoiceSearch()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoStartVoice])

  useEffect(() => {
    if (!isOpen) return

    // Push a history entry so back closes the overlay instead of showing it again
    try {
      window.history.pushState({ searchOverlayOpen: true }, "", window.location.pathname)
    } catch {
      // Ignore history failures
    }

    const handlePopState = () => {
      onClose()
      if (location.pathname === "/") {
        navigate("/", { replace: true })
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [isOpen, navigate, onClose, location.pathname])

  const handleClose = () => {
    onClose()
    if (location.pathname === "/") {
      navigate("/", { replace: true })
    }
  }

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      toast.error("Voice search is not supported in this browser.")
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.interimResults = true
      recognition.continuous = false

      recognition.onstart = () => {
        setIsListening(true)
        setShowVoiceModal(true)
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('')

        onSearchChange(transcript)
      }

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error)
        setIsListening(false)
        setShowVoiceModal(false)
        if (event.error !== 'aborted') {
          // Suppress microphone permission warnings as requested
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        // Give a small delay for user to see the last words
        setTimeout(() => {
          setShowVoiceModal(false)
        }, 1500)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (error) {
      console.error("Failed to start speech recognition:", error)
      setIsListening(false)
      setShowVoiceModal(false)
    }
  }

  const closeVoiceModal = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setShowVoiceModal(false)
  }

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"

      // Load categories from API
      const fetchCategories = async () => {
        try {
          setLoading(true)
          const response = await adminAPI.getPublicCategories()
          if (response.data?.success && response.data?.data?.categories) {
            const apiCategories = response.data.data.categories.map(cat => ({
              id: cat._id || cat.id,
              name: cat.name,
              image: cat.image || foodImages[0]
            }))
            setCategories(apiCategories)
            setFilteredFoods(apiCategories)
          }
        } catch (error) {
          console.error("Error fetching categories for search:", error)
        } finally {
          setLoading(false)
        }
      }

      const fetchCafes = async () => {
        try {
          setLoadingCafes(true)
          const params = {}
          const cachedZoneId = localStorage.getItem("userZoneId")
          if (cachedZoneId) {
            params.zoneId = cachedZoneId
          }

          const response = await cafeAPI.getCafes(params)
          if (response.data?.success && response.data?.data?.cafes) {
            const cafesArray = response.data.data.cafes
            const transformed = cafesArray
              .filter((cafe) => cafe?.name && cafe.name.trim().length > 0)
              .map((cafe) => {
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

                return {
                  id: cafe.cafeId || cafe._id,
                  name: cafe.name,
                  slug: cafe.slug || cafe.name?.toLowerCase().replace(/\s+/g, '-'),
                  image: allImages[0] || null,
                  restaurantType: cafe.restaurantType || cafe.restaurant_type || null,
                }
              })

            const vegFiltered = vegMode ? transformed.filter(isCafeAllowedByVegMode) : transformed
            setCafes(vegFiltered)
            setFilteredCafes(vegFiltered)
          }
        } catch (error) {
          console.error("Error fetching cafes for search:", error)
        } finally {
          setLoadingCafes(false)
        }
      }

      // Load recent searches from localStorage
      const loadRecentSearches = () => {
        const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
        if (saved) {
          try {
            setRecentSuggestions(JSON.parse(saved))
          } catch (e) {
            setRecentSuggestions([])
          }
        } else {
          // Default suggestions if none saved
          setRecentSuggestions(["Biryani", "Burger", "Pizza", "Dosa", "Momos"])
        }
      }

      fetchCategories()
      fetchCafes()
      loadRecentSearches()
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isOpen, onClose, vegMode])

  useEffect(() => {
    const baseCafes = vegMode ? cafes.filter(isCafeAllowedByVegMode) : cafes
    if (searchValue.trim() === "") {
      setFilteredFoods(categories)
      setFilteredCafes(baseCafes)
    } else {
      const filtered = categories.filter((food) =>
        food.name.toLowerCase().includes(searchValue.toLowerCase())
      )
      setFilteredFoods(filtered)

      const filteredCafeList = baseCafes.filter((cafe) =>
        cafe.name?.toLowerCase().includes(searchValue.toLowerCase())
      )
      setFilteredCafes(filteredCafeList)
    }
  }, [searchValue, categories, cafes, vegMode])

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion)
    inputRef.current?.focus()
  }

  const addToRecentSearches = (query) => {
    if (!query.trim()) return

    const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
    let recent = []
    try {
      recent = saved ? JSON.parse(saved) : []
    } catch (e) {
      recent = []
    }

    // Remove if already exists and add to front
    recent = [query, ...recent.filter(s => s.toLowerCase() !== query.toLowerCase())].slice(0, 10)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent))
    setRecentSuggestions(recent)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      addToRecentSearches(searchValue.trim())
      navigate(`/user/search?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }

  const handleFoodClick = (food) => {
    addToRecentSearches(food.name)
    navigate(`/user/search?q=${encodeURIComponent(food.name)}`)
    onClose()
    onSearchChange("")
  }

  const handleCafeClick = (cafe) => {
    addToRecentSearches(cafe.name)
    navigate(`/user/cafes/${cafe.slug || cafe.name.toLowerCase().replace(/\s+/g, '-')}`)
    onClose()
    onSearchChange("")
  }

  const showNoResults =
    searchValue.trim() &&
    !loading &&
    !loadingCafes &&
    filteredFoods.length === 0 &&
    filteredCafes.length === 0

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isListening ? "Listening..." : "Search for food, cafes..."}
                className={cn(
                  "pl-12 pr-12 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-all",
                  isListening && "border-primary-orange ring-2 ring-primary-orange/20"
                )}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {/* Suggestions Row */}
        <div
          className="mb-6"
          style={{
            animation: 'slideDown 0.3s ease-out 0.1s both'
          }}
        >
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary-orange" />
            Recent Searches
          </h3>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            {recentSuggestions.slice(0, 8).map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 text-gray-700 dark:text-gray-300 hover:text-primary-orange dark:hover:text-orange-400 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md"
                style={{
                  animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both`
                }}
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary-orange flex-shrink-0" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cafes */}
        {searchValue.trim() && (
          <div
            className="mb-8"
            style={{
              animation: 'fadeInUp 0.3s ease-out 0.15s both'
            }}
          >
            <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-primary-orange" />
              Cafes
            </h3>

            {loadingCafes ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary-orange" />
                <p className="text-sm text-gray-500">Loading cafes...</p>
              </div>
            ) : filteredCafes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredCafes.slice(0, 12).map((cafe, index) => (
                  <button
                    key={cafe.id || index}
                    onClick={() => handleCafeClick(cafe)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141414] hover:border-primary-orange/40 hover:shadow-md transition-all duration-200 text-left"
                    style={{
                      animation: `fadeInUp 0.3s ease-out ${0.2 + index * 0.04}s both`
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {cafe.image ? (
                        <img
                          src={cafe.image}
                          alt={cafe.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">
                        {cafe.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">View cafe</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Food Grid */}
        <div
          style={{
            animation: 'fadeInUp 0.3s ease-out 0.2s both'
          }}
        >
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-primary-orange" />
            {searchValue.trim() ? "Search Results" : "All Dishes"}
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary-orange" />
              <p className="text-sm text-gray-500">Loading dishes...</p>
            </div>
          ) : filteredFoods.length > 0 ? (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 sm:gap-6">
              {filteredFoods.map((food, index) => (
                <button
                  key={food.id || index}
                  onClick={() => handleFoodClick(food)}
                  className="flex flex-col items-center gap-2.5 group focus:outline-none"
                  style={{
                    animation: `fadeInUp 0.3s ease-out ${0.2 + index * 0.05}s both`
                  }}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full overflow-hidden flex-shrink-0 bg-white ring-1 ring-gray-100 group-hover:ring-primary-orange shadow-sm group-hover:shadow-md transition-all duration-300 transform group-hover:scale-110 p-1.5 flex items-center justify-center">
                    <img
                      src={food.image}
                      alt={food.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-primary-orange transition-colors duration-200 text-center line-clamp-2 leading-tight">
                    {food.name}
                  </span>
                </button>
              ))}
            </div>
          ) : showNoResults ? (
            <div className="text-center py-12 sm:py-16">
              <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">No results found for "{searchValue}"</p>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mt-2">Try a different search term</p>
            </div>
          ) : null}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <VoiceSearchOverlay
        isOpen={showVoiceModal}
        onClose={closeVoiceModal}
        transcript={searchValue}
        isListening={isListening}
      />
    </div>
  )
}
