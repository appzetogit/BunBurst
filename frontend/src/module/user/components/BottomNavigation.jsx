import { Link, useLocation } from "react-router-dom"
import { UtensilsCrossed, Compass, User, Truck, FileText } from "lucide-react"
import { motion } from "framer-motion"

export default function BottomNavigation() {
  const location = useLocation()

  // Check active routes - support both /user/* and /* paths
  const isDining = location.pathname === "/dining" || location.pathname === "/user/dining"
  const isOrders = location.pathname === "/orders" || location.pathname === "/user/orders" || location.pathname.startsWith("/orders/") || location.pathname.startsWith("/user/orders/")
  const isUnder250 = location.pathname === "/under-250" || location.pathname === "/user/under-250"
  const isProfile = location.pathname.startsWith("/profile") || location.pathname.startsWith("/user/profile")
  const isDelivery = !isDining && !isUnder250 && !isOrders && !isProfile && (location.pathname === "/" || location.pathname === "/user" || (location.pathname.startsWith("/") && !location.pathname.startsWith("/cafe") && !location.pathname.startsWith("/delivery") && !location.pathname.startsWith("/admin") && !location.pathname.startsWith("/usermain")))

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-center justify-around h-[64px] px-2">
        {/* Explore Tab */}
        <Link
          to="/user"
          className={`flex flex-col items-center justify-center gap-1 min-w-[70px] py-1 transition-all duration-300 relative ${isDelivery
            ? "text-accent"
            : "text-muted-foreground"
            }`}
        >
          <Compass className={`h-6 w-6 transition-transform duration-300 ${isDelivery ? "text-accent fill-accent/10 scale-110" : "text-muted-foreground"}`} strokeWidth={isDelivery ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-bold transition-all duration-300 ${isDelivery ? "text-accent" : "text-muted-foreground"}`}>
            Explore
          </span>
          {isDelivery && (
            <motion.div
              layoutId="navTab"
              className="absolute -top-[1px] left-4 right-4 h-1 bg-accent rounded-b-xl shadow-md shadow-accent/40"
            />
          )}
        </Link>

        {/* Menu Tab */}
        <Link
          to="/user/under-250"
          className={`flex flex-col items-center justify-center gap-1 min-w-[70px] py-1 transition-all duration-300 relative ${isUnder250
            ? "text-accent"
            : "text-muted-foreground"
            }`}
        >
          <UtensilsCrossed className={`h-6 w-6 transition-transform duration-300 ${isUnder250 ? "text-accent fill-accent/10 scale-110" : "text-muted-foreground"}`} strokeWidth={isUnder250 ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-bold transition-all duration-300 ${isUnder250 ? "text-accent" : "text-muted-foreground"}`}>
            Menu
          </span>
          {isUnder250 && (
            <motion.div
              layoutId="navTab"
              className="absolute -top-[1px] left-4 right-4 h-1 bg-accent rounded-b-xl shadow-md shadow-accent/40"
            />
          )}
        </Link>

        {/* My Orders Tab */}
        <Link
          to="/user/orders"
          className={`flex flex-col items-center justify-center gap-1 min-w-[70px] py-1 transition-all duration-300 relative ${isOrders
            ? "text-accent"
            : "text-muted-foreground"
            }`}
        >
          <FileText className={`h-6 w-6 transition-transform duration-300 ${isOrders ? "text-accent fill-accent/10 scale-110" : "text-muted-foreground"}`} strokeWidth={isOrders ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-bold transition-all duration-300 ${isOrders ? "text-accent" : "text-muted-foreground"}`}>
            My Orders
          </span>
          {isOrders && (
            <motion.div
              layoutId="navTab"
              className="absolute -top-[1px] left-4 right-4 h-1 bg-accent rounded-b-xl shadow-md shadow-accent/40"
            />
          )}
        </Link>

        {/* Profile Tab */}
        <Link
          to="/user/profile"
          className={`flex flex-col items-center justify-center gap-1 min-w-[70px] py-1 transition-all duration-300 relative ${isProfile
            ? "text-accent"
            : "text-muted-foreground"
            }`}
        >
          <User className={`h-6 w-6 transition-transform duration-300 ${isProfile ? "text-accent fill-accent/10 scale-110" : "text-muted-foreground"}`} strokeWidth={isProfile ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-bold transition-all duration-300 ${isProfile ? "text-accent" : "text-muted-foreground"}`}>
            Profile
          </span>
          {isProfile && (
            <motion.div
              layoutId="navTab"
              className="absolute -top-[1px] left-4 right-4 h-1 bg-accent rounded-b-xl shadow-md shadow-accent/40"
            />
          )}
        </Link>
      </div>
    </div>
  )
}
