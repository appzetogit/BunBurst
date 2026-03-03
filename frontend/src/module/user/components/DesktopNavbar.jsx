import { Link, useLocation } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, ShoppingCart, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocation as useLocationHook } from "../hooks/useLocation"
import { useCart } from "../context/CartContext"
import { useLocationSelector } from "./UserLayout"
import { FaLocationDot } from "react-icons/fa6"
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings"
import appzetoFoodLogo from "@/assets/appzetologo.png"

export default function DesktopNavbar() {
  const location = useLocation()
  const { location: userLocation, loading: locationLoading } = useLocationHook()
  const { getCartCount } = useCart()
  const { openLocationSelector } = useLocationSelector()
  const cartCount = getCartCount()
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const [logoUrl, setLogoUrl] = useState(appzetoFoodLogo)
  const [companyName, setCompanyName] = useState("")

  // Load business settings logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        let cached = getCachedSettings()
        if (cached) {
          if (cached.logo?.url) setLogoUrl(cached.logo.url)
          if (cached.companyName) setCompanyName(cached.companyName)
        }

        const settings = await loadBusinessSettings()
        if (settings) {
          if (settings.logo?.url) setLogoUrl(settings.logo.url)
          if (settings.companyName) setCompanyName(settings.companyName)
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    loadLogo()

    const handleSettingsUpdate = () => {
      const cached = getCachedSettings()
      if (cached) {
        if (cached.logo?.url) setLogoUrl(cached.logo.url)
        if (cached.companyName) setCompanyName(cached.companyName)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
    }
  }, [])

  // Show area if available, otherwise show city
  // Priority: area > city > "Select"
  const areaName = userLocation?.area && userLocation?.area.trim() ? userLocation.area.trim() : null
  const cityName = userLocation?.city || null
  const stateName = userLocation?.state || null
  // Main location name: Show area if available, otherwise show city, otherwise "Select"
  const mainLocationName = areaName || cityName || "Select"
  // Secondary location: Show only city when area is available (as per design image)
  const secondaryLocation = areaName
    ? (cityName || "")  // Show only city when area is available
    : (cityName && stateName ? `${cityName}, ${stateName}` : cityName || stateName || "")

  const handleLocationClick = () => {
    // Open location selector overlay
    openLocationSelector()
  }

  // Check active routes - support both /user/* and /* paths
  const isDining = location.pathname === "/dining" || location.pathname === "/user/dining" || location.pathname.startsWith("/dining/") || location.pathname.startsWith("/user/dining/")
  const isUnder250 = location.pathname === "/under-250" || location.pathname === "/user/under-250"
  const isProfile = location.pathname.startsWith("/profile") || location.pathname.startsWith("/user/profile")
  const isDelivery = !isDining && !isUnder250 && !isProfile && (location.pathname === "/" || location.pathname === "/user" || (location.pathname.startsWith("/") && !location.pathname.startsWith("/restaurant") && !location.pathname.startsWith("/delivery") && !location.pathname.startsWith("/admin") && !location.pathname.startsWith("/usermain")))

  // Reset visibility and scroll position when route changes
  useEffect(() => {
    setIsVisible(true)
  }, [location.pathname])

  return (
    <nav
      className="hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-background/95 backdrop-blur-md border-b border-border shadow-sm" />

      {/* Content */}
      <div className="relative">
        <div className={`${location.pathname === "/" || location.pathname === "/user" || isUnder250 || isDining || isProfile ? "max-w-[1100px] px-0" : "max-w-7xl px-4 sm:px-6 lg:px-8"} mx-auto`}>
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo and Location */}
            <div className="flex items-center gap-8 lg:gap-12 min-w-0">
              <Link to="/user" className="flex-shrink-0">
                <img
                  src={logoUrl}
                  alt={companyName || "Logo"}
                  className="h-10 w-auto object-contain"
                  onError={(e) => { e.target.src = appzetoFoodLogo }}
                />
              </Link>
              <Button
                variant="ghost"
                onClick={handleLocationClick}
                disabled={locationLoading}
                className="h-auto px-0 py-0 hover:bg-transparent transition-colors flex-shrink-0"
              >
                {locationLoading ? (
                  <span className="text-sm font-bold text-black">
                    Loading...
                  </span>
                ) : (
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      <FaLocationDot
                        className="h-5 w-5 lg:h-6 lg:w-6 text-[#e53935] flex-shrink-0"
                        strokeWidth={2.5}
                      />
                      <span className="text-sm lg:text-base font-bold text-[#1E1E1E] whitespace-nowrap">
                        {mainLocationName}
                      </span>
                      <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 text-[#1E1E1E]/60 flex-shrink-0" strokeWidth={2.5} />
                    </div>
                    {secondaryLocation && (
                      <span className="text-[10px] lg:text-[11px] font-medium text-[#1E1E1E]/50 whitespace-nowrap">
                        {secondaryLocation}
                      </span>
                    )}
                  </div>
                )}
              </Button>
            </div>

            {/* Center: Navigation Tabs */}
            <div className="flex items-center space-x-1">
              {/* Delivery Tab */}
              <Link
                to="/user"
                className={`px-4 lg:px-6 py-2.5 text-sm lg:text-base font-medium transition-all duration-200 relative ${isDelivery
                  ? "text-[#e53935]"
                  : "text-[#1E1E1E]/60 hover:text-[#e53935] transition-colors"
                  }`}
              >
                <span className="relative z-10">Delivery</span>
                {isDelivery && (
                  <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[#e53935] rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-[#F5F5F5]" />

              {/* Under 250 Tab */}
              <Link
                to="/user/under-250"
                className={`px-4 lg:px-6 py-2.5 text-sm lg:text-base font-medium transition-all duration-200 relative ${isUnder250
                  ? "text-[#e53935]"
                  : "text-[#1E1E1E]/60 hover:text-[#e53935] transition-colors"
                  }`}
              >
                <span className="relative z-10">Under 250</span>
                {isUnder250 && (
                  <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[#e53935] rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-[#F5F5F5]" />

              {/* Dining Tab */}
              <Link
                to="/user/dining"
                className={`px-4 lg:px-6 py-2.5 text-sm lg:text-base font-medium transition-all duration-200 relative ${isDining
                  ? "text-[#e53935]"
                  : "text-[#1E1E1E]/60 hover:text-[#e53935] transition-colors"
                  }`}
              >
                <span className="relative z-10">Dining</span>
                {isDining && (
                  <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[#e53935] rounded-t-full" />
                )}
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-[#F5F5F5]" />

              {/* Profile Tab */}
              <Link
                to="/user/profile"
                className={`px-4 lg:px-6 py-2.5 text-sm lg:text-base font-medium transition-all duration-200 relative ${isProfile
                  ? "text-[#e53935]"
                  : "text-[#1E1E1E]/60 hover:text-[#e53935] transition-colors"
                  }`}
              >
                <span className="relative z-10">Profile</span>
                {isProfile && (
                  <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[#e53935] rounded-t-full" />
                )}
              </Link>
            </div>

            {/* Right: Wallet and Cart Icons */}
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {/* Wallet Icon */}
              <Link to="/user/wallet">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Wallet"
                >
                  <Wallet className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                </Button>
              </Link>

              {/* Cart Icon */}
              <Link to="/user/cart">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Cart"
                >
                  <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center ring-2 ring-card">
                      <span className="text-[10px] font-bold text-primary-foreground">{cartCount > 99 ? "99+" : cartCount}</span>
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

