import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { diningAPI } from "@/lib/api"
import {
    ArrowLeft,
    Star,
    CheckCircle2,
    UtensilsCrossed,
    CalendarDays,
    Clock,
    Users,
    Ticket
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function DiningCafeDetails() {
    const { slug } = useParams()
    const navigate = useNavigate()

    const [cafe, setCafe] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [selectedGuests, setSelectedGuests] = useState(2)
    const [bookingLoading, setBookingLoading] = useState(false)
    const [latestBooking, setLatestBooking] = useState(null)

    useEffect(() => {
        const fetchCafe = async () => {
            if (!slug) return
            try {
                setLoading(true)
                const response = await diningAPI.getCafeBySlug(slug)

                if (response.data && response.data.success) {
                    const apiCafe = response.data.data
                    const actualCafe = apiCafe?.cafe || apiCafe
                    setCafe(actualCafe)
                } else {
                    setCafe(null)
                    setError("Cafe not found")
                }
            } catch (err) {
                console.error("Failed to load cafe", err)

                try {
                    const listResp = await diningAPI.getCafes()
                    if (Array.isArray(listResp.data?.data)) {
                        const match = listResp.data.data.find(r =>
                            r.slug === slug ||
                            r.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
                        )
                        if (match) {
                            const actualMatch = match?.cafe || match
                            setCafe(actualMatch)
                            setError(null)
                        } else {
                            setError("Cafe not found")
                        }
                    }
                } catch (e) {
                    setError("Cafe not found")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchCafe()
    }, [slug])

    useEffect(() => {
        const fetchLatestBooking = async () => {
            if (!cafe?._id) return

            try {
                setBookingLoading(true)
                const response = await diningAPI.getBookings()
                const bookings = response?.data?.data || []
                if (!Array.isArray(bookings)) {
                    setLatestBooking(null)
                    return
                }

                const match = bookings.find((booking) => {
                    const bookingCafeId =
                        booking?.cafeId ||
                        booking?.cafe?._id ||
                        booking?.cafe
                    return String(bookingCafeId) === String(cafe._id)
                })

                setLatestBooking(match || null)
            } catch (err) {
                console.error("Failed to load bookings", err)
                setLatestBooking(null)
            } finally {
                setBookingLoading(false)
            }
        }

        fetchLatestBooking()
    }, [cafe?._id])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !cafe) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
                <h2 className="text-xl font-bold text-foreground">Cafe not found</h2>
                <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">Go Back</Button>
            </div>
        )
    }

    const coverImage = cafe.coverImage || cafe.profileImage?.url || cafe.logo
    const rating = cafe.rating || cafe.avgRating
    const reviewCount = cafe.reviewCount || cafe.totalReviews || cafe.reviewsCount
    const isOpen = cafe.isAcceptingOrders !== false
    const cafeLocation =
        (typeof cafe.location === "string" ? cafe.location : null) ||
        cafe.location?.formattedAddress ||
        cafe.location?.address ||
        cafe.location?.addressLine1 ||
        cafe.location?.street ||
        [cafe.location?.area, cafe.location?.city].filter(Boolean).join(", ") ||
        cafe.address ||
        "Location not available"

    if (cafe.diningSettings && cafe.diningSettings.isEnabled === false) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Dining Unavailable</h2>
                <p className="text-muted-foreground mb-6">Dining is currently unavailable for this cafe.</p>
                <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background pb-20 relative">
            <div className="fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto hover:bg-black/60 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

            </div>

            <div className="relative h-[45vh] w-full">
                {coverImage ? (
                    <img
                        src={coverImage}
                        alt={cafe.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-muted" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                <div className="absolute bottom-0 left-0 w-full p-5 text-white">
                    <h1 className="text-3xl font-bold mb-1">{cafe.name}</h1>
                    <p className="text-sm text-gray-300 line-clamp-2 max-w-[90%] mb-2">
                        {cafeLocation}
                    </p>

                    {cafe.costForTwo ? (
                        <div className="flex items-center gap-3 text-sm font-medium mb-3 text-white/90">
                            <span>{`Rs ${cafe.costForTwo} for two`}</span>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isOpen ? (
                                <div className="flex items-center gap-1.5 text-primary text-xs font-semibold uppercase tracking-wide bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Open now</span>
                                </div>
                            ) : (
                                <div className="text-destructive text-xs font-semibold bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">Closed</div>
                            )}
                        </div>

                        {rating ? (
                            <div className="flex flex-col items-center bg-primary rounded-lg px-2 py-1">
                                <div className="flex items-center gap-1 text-primary-foreground font-bold text-lg leading-none">
                                    {rating} <Star className="w-3 h-3 fill-current" />
                                </div>
                                {reviewCount ? (
                                    <span className="text-[10px] text-primary-foreground/80">{reviewCount} Reviews</span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-5">
                <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                        <div className="absolute -left-10 -bottom-12 h-28 w-28 rounded-full bg-primary/5 blur-2xl" />
                    </div>
                    <div className="relative p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Ticket className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">Your Booking</h3>
                                    <p className="text-xs text-muted-foreground">Latest reservation details</p>
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                                Dining
                            </span>
                        </div>
                    {bookingLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading booking...
                        </div>
                    ) : latestBooking ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-border bg-background/70 p-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CalendarDays className="w-4 h-4" />
                                        Date
                                    </div>
                                    <div className="text-sm font-semibold text-foreground mt-1">
                                        {new Date(latestBooking.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-background/70 p-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        Slot
                                    </div>
                                    <div className="text-sm font-semibold text-foreground mt-1">
                                        {latestBooking.timeSlot}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border bg-background/70 p-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Users className="w-4 h-4" />
                                        Guests
                                    </div>
                                    <div className="text-sm font-semibold text-foreground mt-1">
                                        {latestBooking.guests} Guests
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {latestBooking.table?.tableNumber || latestBooking.tableId?.tableNumber ? (
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                        Table {latestBooking.table?.tableNumber || latestBooking.tableId?.tableNumber}
                                    </span>
                                ) : null}
                                <span className="px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs font-semibold">
                                    {(latestBooking.bookingStatus || latestBooking.status) === "pending"
                                        ? "Pending Approval"
                                        : (latestBooking.bookingStatus || latestBooking.status)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background/60 p-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <CalendarDays className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">No booking yet</p>
                                <p className="text-xs text-muted-foreground">Reserve a table to see your details here.</p>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {(!cafe.diningSettings || cafe.diningSettings.isEnabled) ? (
                <div className="fixed bottom-0 left-0 w-full bg-background border-t border-border p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsBookingOpen(true)}
                        className="flex-1 h-12 rounded-xl text-primary border-primary hover:bg-primary/10 font-bold"
                    >
                        Book a table
                    </Button>
                    <Button
                        onClick={() => navigate("/bookings")}
                        className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex flex-col items-center justify-center leading-tight py-1"
                    >
                        <span className="text-sm">My Booking</span>
                    </Button>
                </div>
            ) : (
                <div className="fixed bottom-0 left-0 w-full bg-muted border-t border-border p-4 z-50 text-center">
                    <p className="text-muted-foreground font-medium">Dining is currently unavailable for this cafe.</p>
                </div>
            )}

            {isBookingOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setIsBookingOpen(false)} />

                    <div className="relative w-full sm:w-[400px] bg-card rounded-t-2xl sm:rounded-2xl p-6 pointer-events-auto animate-in slide-in-from-bottom-5">
                        <h3 className="text-xl font-bold mb-4 text-foreground">Book a Table</h3>

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-muted-foreground block">Number of Guests</label>

                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={cafe.diningSettings?.maxGuests || 6}
                                        value={selectedGuests}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value)
                                            if (!isNaN(val)) {
                                                const max = cafe.diningSettings?.maxGuests || 6
                                                if (val > max) setSelectedGuests(max)
                                                else if (val < 1) setSelectedGuests(1)
                                                else setSelectedGuests(val)
                                            } else {
                                                setSelectedGuests("")
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!selectedGuests || selectedGuests < 1) setSelectedGuests(1)
                                        }}
                                        className="w-full p-3 border border-border rounded-xl bg-muted/50 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary transition-all text-lg font-semibold text-center text-foreground"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
                                        Guests
                                    </span>
                                </div>

                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {Array.from({ length: cafe.diningSettings?.maxGuests || 6 }, (_, i) => i + 1).map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setSelectedGuests(num)}
                                            className={`min-w-[40px] h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all flex-shrink-0 ${selectedGuests === num
                                                ? "bg-primary text-primary-foreground shadow-md transform scale-105"
                                                : "bg-background border border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                                                }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={() => {
                                    setIsBookingOpen(false)
                                    navigate(`/dining/book/${slug}`, { state: { guestCount: selectedGuests } })
                                }}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl"
                            >
                                Confirm Booking
                            </Button>
                        </div>

                        <button
                            onClick={() => setIsBookingOpen(false)}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
