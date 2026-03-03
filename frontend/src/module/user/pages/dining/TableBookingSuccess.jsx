import { useLocation, useNavigate } from "react-router-dom"
import { CheckCircle2, Calendar, Clock, Users, MapPin, Share2, Home, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import AnimatedPage from "../../components/AnimatedPage"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { useEffect } from "react"

export default function TableBookingSuccess() {
    const location = useLocation()
    const navigate = useNavigate()
    const { booking } = location.state || {}

    useEffect(() => {
        // Trigger confetti on mount
        const duration = 3 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

        const randomInRange = (min, max) => Math.random() * (max - min) + min

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now()

            if (timeLeft <= 0) {
                return clearInterval(interval)
            }

            const particleCount = 50 * (timeLeft / duration)
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 250)

        return () => clearInterval(interval)
    }, [])

    if (!booking) {
        navigate("/dining")
        return null
    }

    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <AnimatedPage className="bg-background min-h-screen flex flex-col items-center justify-center p-6 pb-24">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6"
            >
                <CheckCircle2 className="w-12 h-12 text-primary" />
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-2 mb-10"
            >
                <h1 className="text-3xl font-black text-foreground">Seat Confirmed!</h1>
                <p className="text-muted-foreground font-medium tracking-wide italic">Your table is ready for you</p>
                <div className="pt-2">
                    <span className="bg-highlight text-highlight-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-highlight/20">
                        BOOKING ID: {booking.bookingId}
                    </span>
                </div>
            </motion.div>

            {/* Ticket Card */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-full max-w-sm bg-card rounded-3xl border border-border overflow-hidden shadow-xl shadow-muted/20"
            >
                <div className="p-6 space-y-6 relative">
                    {/* Circle cutouts for ticket look */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background rounded-full border border-border"></div>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background rounded-full border border-border"></div>

                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-card border border-border flex-shrink-0 p-1">
                            <img
                                src={booking.restaurant?.image || booking.restaurant?.profileImage?.url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80"}
                                className="w-full h-full object-cover rounded-xl"
                                alt="restaurant"
                            />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-black text-lg text-foreground truncate">{booking.restaurant?.name || "The Great Indian Restaurant"}</h2>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">
                                    {typeof booking.restaurant?.location === 'string'
                                        ? booking.restaurant.location
                                        : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-6 border-y border-dashed border-border">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Date</p>
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Time</p>
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>{booking.timeSlot}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Guests</p>
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Users className="w-4 h-4 text-primary" />
                                <span>{booking.guests} People</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</p>
                            <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded-lg text-xs font-bold w-fit">
                                CONFIRMED
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-primary">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                            <span className="font-bold text-sm">10% Cashback with Tastizo Pay</span>
                        </div>
                        <Share2 className="w-5 h-5 cursor-pointer hover:scale-110 transition-transform" />
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 w-full max-w-sm space-y-3"
            >
                <Button
                    onClick={() => navigate("/dining/my-bookings")}
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                >
                    <List className="w-5 h-5" />
                    View My Bookings
                </Button>
                <Button
                    onClick={() => navigate("/")}
                    variant="outline"
                    className="w-full h-14 bg-card border-2 border-border text-muted-foreground font-bold text-lg rounded-2xl hover:bg-muted flex items-center justify-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Go to Home
                </Button>
            </motion.div>

            <p className="fixed bottom-10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-10 text-center opacity-50">
                Show this ticket at the restaurant for a smooth entry
            </p>
        </AnimatedPage>
    )
}
