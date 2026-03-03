import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, Users, MapPin, Ticket, ChevronRight, Edit2, ShieldCheck, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import AnimatedPage from "../../components/AnimatedPage"
import { diningAPI, authAPI } from "@/lib/api"
import { useEffect } from "react"
import { toast } from "sonner"
import Loader from "@/components/Loader"

export default function TableBookingConfirmation() {
    const location = useLocation()
    const navigate = useNavigate()
    const { restaurant, guests, date, timeSlot, discount } = location.state || {}

    const [specialRequest, setSpecialRequest] = useState("")
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [bookingInProgress, setBookingInProgress] = useState(false)

    useEffect(() => {
        if (!restaurant) {
            navigate("/dining")
            return
        }

        const fetchUser = async () => {
            try {
                const response = await authAPI.getCurrentUser()
                if (response.data.success) {
                    setUser(response.data.data)
                }
            } catch (error) {
                console.error("Error fetching user:", error)
                // If not logged in, navigate to sign-in but the ProtectedRoute should handle this
            } finally {
                setLoading(false)
            }
        }
        fetchUser()
    }, [restaurant, navigate])

    const handleBooking = async () => {
        try {
            setBookingInProgress(true)
            const response = await diningAPI.createBooking({
                restaurant: restaurant._id,
                guests,
                date,
                timeSlot,
                specialRequest
            })

            if (response.data.success) {
                toast.success("Table booked successfully!")
                // Navigate to success page with booking details
                navigate("/dining/book-success", { state: { booking: response.data.data } })
            }
        } catch (error) {
            console.error("Booking error:", error)
            toast.error(error.response?.data?.message || "Failed to confirm booking")
        } finally {
            setBookingInProgress(false)
        }
    }

    if (loading) return <Loader />

    const formattedDate = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

    return (
        <AnimatedPage className="bg-background min-h-screen pb-24">
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-4 py-4 sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <p className="font-semibold text-sm">Reach the restaurant 15 minutes before your booking time for a hassle-free experience</p>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Booking Summary Card */}
                <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="p-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl">
                                <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{formattedDate} at {timeSlot}</p>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5">
                                    <Users className="w-4 h-4" />
                                    <span>{guests} guests</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 pt-4 border-t border-dashed border-border">
                            <div className="bg-primary/10 p-2 rounded-xl">
                                <MapPin className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{restaurant.name}</p>
                                <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                                    {typeof restaurant.location === 'string'
                                        ? restaurant.location
                                        : (restaurant.location?.formattedAddress || restaurant.location?.address || `${restaurant.location?.city || ''}${restaurant.location?.area ? ', ' + restaurant.location.area : ''}`)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-4 border-t border-dashed border-border text-primary">
                            <Ticket className="w-5 h-5" />
                            <span className="font-bold text-sm">10% cashback</span>
                        </div>
                    </div>
                </div>

                {/* Special Request */}
                <button className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="bg-muted p-2 rounded-xl group-hover:bg-muted/80 transition-colors">
                            <Info className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <span className="font-bold text-foreground">Add special request</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Preferences Section */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="h-px bg-border flex-1"></div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Guest Preferences</span>
                        <div className="h-px bg-border flex-1"></div>
                    </div>

                    <div className="space-y-2">
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
                            <div className="flex items-start gap-3">
                                <div className="text-primary mt-1">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-sm">Modification available</p>
                                    <p className="text-xs text-muted-foreground">Valid till {timeSlot}, today</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>

                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
                            <div className="flex items-start gap-3">
                                <div className="text-destructive mt-1">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-sm">Cancellation available</p>
                                    <p className="text-xs text-muted-foreground">Valid till {timeSlot}, today</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>

                {/* Your Details */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="h-px bg-border flex-1"></div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Details</span>
                        <div className="h-px bg-border flex-1"></div>
                    </div>

                    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex items-center justify-between">
                        <div>
                            <p className="font-bold text-foreground">{user?.name || "Shailu"}</p>
                            <p className="text-sm text-muted-foreground mt-1">{user?.phone || user?.email || "8090512291"}</p>
                        </div>
                        <button className="text-primary text-sm font-bold hover:underline">Edit</button>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="h-px bg-border flex-1"></div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Terms and Conditions</span>
                        <div className="h-px bg-border flex-1"></div>
                    </div>

                    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
                        <ul className="space-y-4">
                            {[
                                "Please arrive 15 minutes prior to your reservation time.",
                                "Booking valid for the specified number of guests entered during reservation",
                                "Cover charges upon entry are subject to the discretion of the restaurant",
                                "House rules are to be observed at all times",
                                "Special requests will be accommodated at the restaurant's discretion",
                                "Offers can be availed only by paying via Tastizo",
                                "Cover charges cannot be refunded if slot is cancelled within 30 minutes of slot start time",
                                "Additional service charges on the bill are at the restaurant's discretion"
                            ].map((term, i) => (
                                <li key={i} className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0"></div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{term}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Sticky Action Button */}
            <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
                <Button
                    onClick={handleBooking}
                    disabled={bookingInProgress}
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                    {bookingInProgress ? "Confirming..." : "Confirm your seat"}
                </Button>
            </div>
        </AnimatedPage>
    )
}
