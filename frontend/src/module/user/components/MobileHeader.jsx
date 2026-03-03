import { Link } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { ChevronDown, ShoppingCart, Search, Mic, MapPin, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLocation } from "../hooks/useLocation"
import { useCart } from "../context/CartContext"
import { useProfile } from "../context/ProfileContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

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

export default function MobileHeader({
    className = "",
    sticky = true,
    onVegModeChange,
    vegMode = false,
    showVegToggle = true
}) {
    const { location } = useLocation()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { openSearch, setSearchValue } = useSearchOverlay()
    const cartCount = getCartCount()
    const [logoUrl, setLogoUrl] = useState(null)
    const [companyName, setCompanyName] = useState(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [placeholderIndex, setPlaceholderIndex] = useState(0)

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

    // Animated placeholder cycling
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [])

    // Get location display
    const getLocationText = () => {
        if (!location) return "Select location"

        // Priority: area > city > formattedAddress
        if (location.area && location.area.trim() !== "") {
            return location.area
        }
        if (location.city && location.city.trim() !== "" && location.city !== "Unknown City") {
            return location.city
        }
        if (location.formattedAddress && location.formattedAddress !== "Select location") {
            // Take first part of formatted address
            const parts = location.formattedAddress.split(',')
            return parts[0]?.trim() || "Select location"
        }
        return "Select location"
    }

    const handleSearchFocus = (triggerVoice = false) => {
        if (searchQuery) {
            setSearchValue(searchQuery)
        }
        openSearch(triggerVoice)
    }

    const handleVoiceSearch = (e) => {
        e.stopPropagation()
        handleSearchFocus(true)
    }

    const handleLocationClick = () => {
        openLocationSelector()
    }

    return (
        <header
            className={cn(
                "w-full bg-background border-b border-border z-50",
                sticky && "sticky top-0",
                className
            )}
        >
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
                {/* Main Header Row */}
                <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
                    <div className="flex items-center flex-shrink-0">
                        <Link to="/user" className="flex-shrink-0 group">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={companyName || "Logo"}
                                    className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 object-contain rounded-lg hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 bg-primary rounded-lg flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300">
                                    <span className="text-primary-foreground font-bold text-2xl sm:text-3xl lg:text-4xl">
                                        {companyName?.[0] || "F"}
                                    </span>
                                </div>
                            )}
                        </Link>
                    </div>

                    {/* Center: Location Selector */}
                    <div className="flex-1 flex justify-center">
                        <button
                            onClick={handleLocationClick}
                            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-muted transition-all duration-200 max-w-[200px] sm:max-w-[280px] hover:shadow-sm"
                        >
                            <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-sm sm:text-base lg:text-lg font-semibold text-foreground truncate max-w-full">
                                    {getLocationText()}
                                </span>
                                {location?.state && (
                                    <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
                                        {location.state}
                                    </span>
                                )}
                            </div>
                            <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                        </button>
                    </div>

                    {/* Right: VEG Toggle + Icons */}
                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                        {/* VEG Toggle */}
                        {showVegToggle && (
                            <div className="hidden sm:flex flex-col items-center gap-1">
                                <span className="text-[10px] sm:text-xs font-bold text-foreground leading-none">VEG</span>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={onVegModeChange}
                                    aria-label="Toggle Veg Mode"
                                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted w-10 h-5"
                                />
                            </div>
                        )}

                        {/* Profile Icon */}
                        <Link to="/user/profile" className="hidden sm:block">
                            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                                <AvatarFallback className="bg-muted text-primary text-sm">
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                        </Link>

                        {/* Cart Icon */}
                        <Link to="/user/cart" className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 sm:h-11 sm:w-11 relative hover:bg-muted"
                            >
                                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md border-2 border-background">
                                        {cartCount > 9 ? "9+" : cartCount}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>


                {/* Mobile Search Row (Below main header on mobile only) */}
                <div className="md:hidden pb-3 px-1">
                    <div className="flex items-center gap-2.5">
                        {/* Search Bar - Enhanced */}
                        <div className="flex-1 relative bg-muted rounded-2xl border-2 border-border hover:border-primary transition-all duration-200 shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-2.5 px-4 py-2.5">
                                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 relative">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={handleSearchFocus}
                                        className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                                    />
                                    {!searchQuery && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none h-5 overflow-hidden">
                                            <AnimatePresence mode="wait">
                                                <motion.span
                                                    key={placeholderIndex}
                                                    initial={{ y: 16, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: -16, opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="text-sm font-medium text-muted-foreground inline-block"
                                                >
                                                    {placeholders[placeholderIndex]}
                                                </motion.span>
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleVoiceSearch}
                                    className="p-1.5 hover:bg-muted rounded-lg transition-all duration-200"
                                >
                                    <Mic className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                </button>
                            </div>
                        </div>

                        {/* VEG Toggle - Enhanced Design */}
                        {showVegToggle && (
                            <motion.div
                                className="flex flex-col items-center gap-1 px-3 py-2 bg-muted rounded-2xl border-2 border-border shadow-sm hover:shadow-md transition-all duration-200"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="text-[9px] font-extrabold text-primary leading-none tracking-wide">VEG</span>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={onVegModeChange}
                                    aria-label="Toggle Veg Mode"
                                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted w-9 h-5"
                                />
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
