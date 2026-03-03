import { Link, useNavigate, useLocation as useRouteLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { ChevronDown, ShoppingCart, Search, Mic, MapPin, User, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLocation } from "../hooks/useLocation"
import { useCart } from "../context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const DEFAULT_PLACEHOLDERS = [
    "Search \"burger\"",
    "Search \"biryani\"",
    "Search \"pizza\"",
    "Search \"desserts\"",
    "Search \"chinese\"",
    "Search \"thali\"",
    "Search \"momos\"",
    "Search \"dosa\""
]

export default function UserTopHeader({
    className = "",
    sticky = true,
    onVegModeChange,
    vegMode = false,
    showVegToggle = true,
    placeholders = DEFAULT_PLACEHOLDERS,
    showSearchAlways = false, // If true, search is visible on desktop too
}) {
    const navigate = useNavigate()
    const { location } = useLocation()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { openSearch, setSearchValue } = useSearchOverlay()
    const cartCount = getCartCount()
    const [logoUrl, setLogoUrl] = useState(null)
    const [companyName, setCompanyName] = useState(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [placeholderIndex, setPlaceholderIndex] = useState(0)
    const routeLocation = useRouteLocation()

    const isDining = routeLocation.pathname.startsWith("/dining") || routeLocation.pathname.startsWith("/user/dining")
    const isUnder250 = routeLocation.pathname.startsWith("/under-250") || routeLocation.pathname.startsWith("/user/under-250")
    const isProfile = routeLocation.pathname.startsWith("/profile") || routeLocation.pathname.startsWith("/user/profile")
    const useNarrowWidth = isDining || isUnder250 || isProfile || routeLocation.pathname === "/" || routeLocation.pathname === "/user"

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
    }, [placeholders.length])

    // Get location display
    const getLocationText = () => {
        if (!location) return "Select location"
        if (location.area && location.area.trim() !== "") return location.area
        if (location.city && location.city.trim() !== "" && location.city !== "Unknown City") return location.city
        if (location.formattedAddress && location.formattedAddress !== "Select location") {
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

    return (
        <header
            className={cn(
                "w-full bg-background/95 backdrop-blur-md border-b-2 border-border shadow-md z-[60] transition-colors duration-300",
                "sticky top-0",
                className
            )}
        >
            <div className={cn("mx-auto", useNarrowWidth ? "max-w-[1100px] px-3 sm:px-0" : "max-w-7xl px-3 sm:px-4 lg:px-6")}>
                {/* Main Header Row */}
                <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
                    {/* Left: Logo */}
                    <div className="flex items-center flex-shrink-0 ml-4 lg:ml-2">
                        <Link to="/user" className="flex-shrink-0 group">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={companyName || "Logo"}
                                    className="h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 object-contain rounded-lg hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 bg-primary rounded-lg flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300">
                                    <span className="text-primary-foreground font-bold text-xl sm:text-2xl lg:text-3xl">
                                        {companyName?.[0] || "B"}
                                    </span>
                                </div>
                            )}
                        </Link>
                    </div>

                    {/* Desktop Search Center (NEW) */}
                    {(showSearchAlways) && (
                        <div className="hidden md:flex flex-1 max-w-xl mx-4">
                            <div className="w-full relative bg-muted rounded-2xl border-2 border-border hover:border-primary transition-all duration-200 shadow-sm hover:shadow-md">
                                <div className="flex items-center gap-2.5 px-4 py-2">
                                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <div className="flex-1 relative">
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onFocus={handleSearchFocus}
                                            placeholder=" "
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && searchQuery.trim()) {
                                                    navigate(`/user/search?q=${encodeURIComponent(searchQuery.trim())}`)
                                                }
                                            }}
                                            className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-transparent"
                                        />
                                        {!searchQuery && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <AnimatePresence mode="wait">
                                                    <motion.span
                                                        key={placeholderIndex}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.4 }}
                                                        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
                                                    >
                                                        {placeholders[placeholderIndex]}
                                                    </motion.span>
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={handleVoiceSearch} className="p-1.5 hover:bg-muted rounded-lg transition-all">
                                        <Mic className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={cn("hidden lg:flex items-center", showSearchAlways ? "flex-shrink-0" : "flex-1 justify-center")}>
                        <button
                            onClick={() => openLocationSelector()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted transition-all duration-200 max-w-[300px]"
                        >
                            <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-sm font-bold text-foreground truncate max-w-full leading-tight">
                                    {getLocationText()}
                                </span>
                                {location?.state && (
                                    <span className="text-[10px] text-muted-foreground truncate leading-tight">
                                        {location.state}
                                    </span>
                                )}
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Mobile Only Location (Compact) */}
                    <div className="lg:hidden flex-1 flex justify-center min-w-0">
                        <button onClick={() => openLocationSelector()} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted rounded-lg max-w-[150px]">
                            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-sm font-bold truncate">{getLocationText()}</span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* VEG Toggle */}
                        {showVegToggle && (
                            <div className="hidden sm:flex flex-col items-center gap-0.5">
                                <span className="text-[9px] font-black text-primary leading-none">VEG</span>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={onVegModeChange}
                                    className="scale-90 data-[state=checked]:bg-primary"
                                />
                            </div>
                        )}

                        {/* Actions Icons */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Link to="/user/wallet" className="hidden sm:block">
                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted">
                                    <Wallet className="h-5 w-5 text-foreground" />
                                </Button>
                            </Link>
                            <Link to="/user/cart" className="relative">
                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted">
                                    <ShoppingCart className="h-5 w-5 text-foreground" />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
                                            {cartCount > 9 ? "9+" : cartCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                            <Link to="/user/profile">
                                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-border">
                                    <AvatarFallback className="bg-muted text-primary text-xs">
                                        <User className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Search Bar Row (Visible on Mobile/Tablet, hidden on Desktop if search is in header) */}
                <div className="md:hidden pb-3 px-1 flex items-center gap-3">
                    <div className="flex-1 relative bg-muted rounded-2xl transition-all duration-200 shadow-sm">
                        <div className="flex items-center gap-2.5 px-4 py-2.5">
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 relative">
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={handleSearchFocus}
                                    placeholder=" "
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchQuery.trim()) {
                                            navigate(`/user/search?q=${encodeURIComponent(searchQuery.trim())}`)
                                        }
                                    }}
                                    className="h-6 w-full px-0 border-0 outline-none ring-0 bg-transparent text-sm font-medium text-foreground placeholder:text-transparent"
                                />
                                {!searchQuery && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <AnimatePresence mode="wait">
                                            <motion.span
                                                key={placeholderIndex}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="text-sm font-medium text-muted-foreground whitespace-nowrap"
                                            >
                                                {placeholders[placeholderIndex]}
                                            </motion.span>
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={handleVoiceSearch} className="p-1.5 hover:bg-muted rounded-lg transition-all">
                                <Mic className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Veg Toggle */}
                    {showVegToggle && (
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <span className="text-[9px] font-black text-primary leading-none">VEG</span>
                            <Switch
                                checked={vegMode}
                                onCheckedChange={onVegModeChange}
                                className="scale-90 data-[state=checked]:bg-primary shadow-sm border border-border"
                            />
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
