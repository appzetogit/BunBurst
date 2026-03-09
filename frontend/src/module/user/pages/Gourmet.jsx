import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Star, Clock, Bookmark, BadgePercent, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { heroBannerAPI } from "@/lib/api"
import { toast } from "sonner"

// Import banner
import gourmetBanner from "@/assets/groumetpagebanner.png"

export default function Gourmet() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState(new Set())
  const [gourmetCafes, setGourmetCafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGourmetCafes = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await heroBannerAPI.getGourmetCafes()
      const data = response?.data?.data

      if (data && data.cafes) {
        setGourmetCafes(data.cafes)
      } else {
        setGourmetCafes([])
      }
    } catch (err) {
      console.error('Error fetching Gourmet cafes:', err)
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load Gourmet cafes'
      setError(errorMessage)
      toast.error(errorMessage)
      setGourmetCafes([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch Gourmet cafes from API
  useEffect(() => {
    fetchGourmetCafes()
  }, [])

  const handleRetry = () => {
    fetchGourmetCafes()
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Banner Section */}
      <div className="relative w-full overflow-hidden min-h-[25vh] md:min-h-[30vh]">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-20 w-10 h-10 md:w-12 md:h-12 bg-gray-800/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-800/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
        </button>

        {/* Banner Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={gourmetBanner}
            alt="Gourmet Dining"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10 space-y-4 md:space-y-6">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          {/* Header */}
          <div className="mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Premium Gourmet Cafes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Exquisite dining experiences delivered to your doorstep</p>
          </div>

          {/* Cafe Count */}
          <p className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
            {loading ? '...' : gourmetCafes.length} GOURMET CAFES
          </p>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading Gourmet cafes...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-red-500 dark:text-red-400 text-center">{error}</p>
              <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
            </div>
          )}

          {/* Cafe Cards */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {gourmetCafes.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No Gourmet cafes available at the moment</p>
                </div>
              ) : (
                gourmetCafes.map((cafe) => {
                  const cafeSlug = cafe.slug || cafe.name?.toLowerCase().replace(/\s+/g, "-") || ""
                  const cafeId = cafe._id || cafe.cafeId || cafe.id
                  const isFavorite = favorites.has(cafeId)

                  // Get cafe cover image with priority: coverImages > menuImages > profileImage
                  const coverImages = cafe.coverImages && cafe.coverImages.length > 0
                    ? cafe.coverImages.map(img => img.url || img).filter(Boolean)
                    : []

                  const menuImages = cafe.menuImages && cafe.menuImages.length > 0
                    ? cafe.menuImages.map(img => img.url || img).filter(Boolean)
                    : []

                  const cafeImage = coverImages.length > 0
                    ? coverImages[0]
                    : (menuImages.length > 0
                      ? menuImages[0]
                      : (cafe.profileImage?.url || cafe.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"))

                  return (
                    <Link key={cafeId} to={`/user/cafes/${cafeSlug}`}>
                      <Card className="overflow-hidden cursor-pointer border-0 group bg-white dark:bg-[#1a1a1a] shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-2xl mb-4">
                        {/* Image Section */}
                        <div className="relative h-44 sm:h-52 md:h-56 w-full overflow-hidden rounded-t-2xl">
                          <img
                            src={cafeImage}
                            alt={cafe.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Fallback to placeholder if image fails
                              e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"
                            }}
                          />

                          {/* Bookmark Icon - Top Right */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-3 right-3 h-9 w-9 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleFavorite(cafeId)
                            }}
                          >
                            <Bookmark className={`h-5 w-5 ${isFavorite ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
                          </Button>
                        </div>

                        {/* Content Section */}
                        <CardContent className="p-3 sm:p-4">
                          {/* Cafe Name & Rating */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                                {cafe.name}
                              </h3>
                            </div>
                            <div className="flex-shrink-0 bg-green-600 text-white px-2 py-1 rounded-lg flex items-center gap-1">
                              <span className="text-sm font-bold">{cafe.rating?.toFixed(1) || '0.0'}</span>
                              <Star className="h-3 w-3 fill-white text-white" />
                            </div>
                          </div>

                          {/* Delivery Time & Distance */}
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <Clock className="h-4 w-4" strokeWidth={1.5} />
                            <span className="font-medium">{cafe.estimatedDeliveryTime || cafe.deliveryTime || '25-30 mins'}</span>
                            <span className="mx-1">|</span>
                            <span className="font-medium">{cafe.distance || '1.2 km'}</span>
                          </div>

                          {/* Offer Badge */}
                          {cafe.offer && (
                            <div className="flex items-center gap-2 text-sm">
                              <BadgePercent className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{cafe.offer}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

