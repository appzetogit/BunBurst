import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Calendar, Clock, Users, MapPin, ChevronRight, Utensils } from "lucide-react"
import { diningAPI } from "@/lib/api"
import Loader from "@/components/Loader"
import AnimatedPage from "../../components/AnimatedPage"
import { Badge } from "@/components/ui/badge"
import { Star, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

function ReviewModal({ booking, onClose, onSubmit }) {
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!comment.trim()) {
            toast.error("Please add a comment")
            return
        }
        setSubmitting(true)
        await onSubmit({ bookingId: booking._id, rating, comment })
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-border">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">Review your experience</h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <p className="text-sm font-medium text-muted-foreground mb-3">How was your visit to {booking.restaurant?.name}?</p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform active:scale-90"
                                >
                                    <Star
                                        className={`w-10 h-10 ${star <= rating ? "fill-highlight text-highlight" : "text-muted"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Share your feedback</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Write about the food, service, and atmosphere..."
                            className="w-full h-32 p-4 bg-muted/30 border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-sm resize-none text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-2xl shadow-lg shadow-primary/20"
                    >
                        {submitting ? "Submitting..." : "Submit Review"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function MyBookings() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedBooking, setSelectedBooking] = useState(null)

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const response = await diningAPI.getBookings()
                if (response.data.success) {
                    setBookings(response.data.data)
                }
            } catch (error) {
                console.error("Error fetching bookings:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchBookings()
    }, [])

    const handleReviewSubmit = async (reviewData) => {
        try {
            const response = await diningAPI.createReview(reviewData)
            if (response.data.success) {
                toast.success("Review submitted! Thank you for your feedback.")
                // Update booking list to mark it as reviewed if we had a reviewed flag
                // For now just close the modal
                setSelectedBooking(null)
            }
        } catch (error) {
            console.error("Error submitting review:", error)
            toast.error(error.response?.data?.message || "Failed to submit review")
        }
    }

    if (loading) return <Loader />

    return (
        <AnimatedPage className="bg-background min-h-screen pb-10">
            {/* Header */}
            <div className="bg-card p-4 flex items-center shadow-sm sticky top-0 z-10 border-b border-border">
                <button onClick={() => navigate("/")}>
                    <ArrowLeft className="w-6 h-6 text-muted-foreground hover:text-foreground cursor-pointer" />
                </button>
                <h1 className="ml-4 text-xl font-semibold text-foreground">My Table Bookings</h1>
            </div>

            <div className="p-4 space-y-4">
                {bookings.length > 0 ? (
                    bookings.map((booking) => (
                        <div key={booking._id} className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-start gap-4">
                            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                                <img
                                    src={booking.restaurant?.image || booking.restaurant?.profileImage?.url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80"}
                                    className="w-full h-full object-cover"
                                    alt={booking.restaurant?.name}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-foreground truncate">{booking.restaurant?.name}</h3>
                                    <Badge className={`${booking.status === 'confirmed' ? 'bg-primary/10 text-primary' :
                                        booking.status === 'checked-in' ? 'bg-primary/10 text-primary' :
                                            booking.status === 'completed' ? 'bg-primary/10 text-primary' :
                                                'bg-muted text-muted-foreground'
                                        }`}>
                                        {booking.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">
                                        {typeof booking.restaurant?.location === 'string'
                                            ? booking.restaurant.location
                                            : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)}
                                    </span>
                                </p>

                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                                        <Clock className="w-3 h-3" />
                                        {booking.timeSlot}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                                        <Users className="w-3 h-3" />
                                        {booking.guests} Guests
                                    </div>
                                </div>

                                {booking.status === 'completed' && (
                                    <button
                                        onClick={() => setSelectedBooking(booking)}
                                        className="mt-3 w-full py-2 bg-primary/5 text-primary text-[11px] font-bold rounded-lg border border-primary/20 hover:bg-primary/10 transition-colors"
                                    >
                                        RATE & REVIEW
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20">
                        <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Utensils className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No bookings yet</h3>
                        <p className="text-muted-foreground text-sm mt-2">Book your favorite restaurant for a great dining experience!</p>
                        <Link to="/dining">
                            <button className="mt-6 bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20">
                                Book a table
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            {selectedBooking && (
                <ReviewModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onSubmit={handleReviewSubmit}
                />
            )}
        </AnimatedPage>
    )
}
