import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef, createContext, useContext, lazy, Suspense } from "react"
import { ProfileProvider } from "../context/ProfileContext"
import LocationPrompt from "./LocationPrompt"
import { CartProvider } from "../context/CartContext"
import { OrdersProvider } from "../context/OrdersContext"
import { CustomerThemeProvider, useCustomerTheme } from "../context/CustomerThemeContext"
// Lazy load overlays to reduce initial bundle size
const SearchOverlay = lazy(() => import("./SearchOverlay"))
const LocationSelectorOverlay = lazy(() => import("./LocationSelectorOverlay"))
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"

// Create SearchOverlay context with default value
const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  shouldStartVoice: false,
  setSearchValue: () => {
    console.warn("SearchOverlayProvider not available")
  },
  openSearch: (startVoice = false) => {
    console.warn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  // Always return context, even if provider is not available (will use default values)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [shouldStartVoice, setShouldStartVoice] = useState(false)

  const openSearch = (startVoice = false) => {
    setIsSearchOpen(true)
    setShouldStartVoice(startVoice)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
    setShouldStartVoice(false)
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch, shouldStartVoice }}>
      {children}
      <Suspense fallback={null}>
        {isSearchOpen && (
          <SearchOverlay
            isOpen={isSearchOpen}
            onClose={closeSearch}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            autoStartVoice={shouldStartVoice}
          />
        )}
      </Suspense>
    </SearchOverlayContext.Provider>
  )
}

// Create LocationSelector context with default value
const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => {
    console.warn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const navigate = useNavigate()
  const lastPathRef = useRef(window.location.pathname)

  const openLocationSelector = () => {
    lastPathRef.current = window.location.pathname || "/"
    setIsLocationSelectorOpen(true)
    // Push a history entry so browser back can close the overlay cleanly
    try {
      window.history.pushState({ locationSelectorOpen: true }, "", window.location.pathname)
    } catch {
      // Ignore history failures (e.g., Safari private mode)
    }
  }

  const closeLocationSelector = () => {
    setIsLocationSelectorOpen(false)
  }

  const value = {
    isLocationSelectorOpen,
    openLocationSelector,
    closeLocationSelector
  }

  useEffect(() => {
    if (!isLocationSelectorOpen) return

    const handlePopState = () => {
      if (window.__locationSelectorFormOpen) {
        return
      }
      setIsLocationSelectorOpen(false)
      const targetPath = lastPathRef.current || "/"
      navigate(targetPath, { replace: true })
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [isLocationSelectorOpen, navigate])

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {isLocationSelectorOpen && (
          <LocationSelectorOverlay
            isOpen={isLocationSelectorOpen}
            onClose={closeLocationSelector}
          />
        )}
      </Suspense>
    </LocationSelectorContext.Provider>
  )
}

import { LocationProvider } from "../context/LocationContext"

function UserLayoutContent() {
  const { theme } = useCustomerTheme()
  const location = useLocation()

  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (!viewportMeta) return

    const originalContent = viewportMeta.getAttribute("content") || ""
    const lockedContent = "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no"

    if (originalContent !== lockedContent) {
      viewportMeta.setAttribute("content", lockedContent)
    }

    return () => {
      viewportMeta.setAttribute("content", originalContent)
    }
  }, [])

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search, location.hash])

  // Note: Authentication checks and redirects are handled by ProtectedRoute components
  // UserLayout should not interfere with authentication redirects

  // Show bottom navigation only on home page, orders page, under-250 page, and profile page
  const showBottomNav = location.pathname === "/" ||
    location.pathname === "/user" ||
    // location.pathname === "/dining" ||
    // location.pathname === "/user/dining" ||
    location.pathname === "/under-250" ||
    location.pathname === "/user/under-250" ||
    location.pathname === "/orders" ||
    location.pathname === "/user/orders" ||
    location.pathname.startsWith("/orders/") ||
    location.pathname.startsWith("/user/orders/") ||
    location.pathname === "/profile" ||
    location.pathname === "/user/profile" ||
    location.pathname.startsWith("/user/profile")

  return (
    <div
      className={`min-h-screen bg-background transition-colors duration-200 ${theme === "dark" ? "dark user-desktop-dark" : ""}`}
    >
      <CartProvider>
        <ProfileProvider>
          <OrdersProvider>
            <LocationProvider>
              <SearchOverlayProvider>
                <LocationSelectorProvider>
                  {/* <Navbar /> */}
                  {showBottomNav && <DesktopNavbar />}
                  <LocationPrompt />
                  <main>
                    <Outlet />
                  </main>
                  {showBottomNav && <BottomNavigation />}
                </LocationSelectorProvider>
              </SearchOverlayProvider>
            </LocationProvider>
          </OrdersProvider>
        </ProfileProvider>
      </CartProvider>
    </div>
  )
}

export default function UserLayout() {
  return (
    <CustomerThemeProvider>
      <UserLayoutContent />
    </CustomerThemeProvider>
  )
}
