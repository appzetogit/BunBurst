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
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react"

const BookingSkeleton = () => (
    <div className="bg-card rounded-3xl p-5 shadow-sm border border-border flex items-start gap-5 animate-pulse">
        <div className="w-24 h-24 rounded-2xl bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-3">
            <div className="flex justify-between items-start">
                <div className="h-6 bg-muted rounded-lg w-1/3" />
                <div className="h-6 bg-muted rounded-full w-20" />
            </div>
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="flex gap-4 pt-2">
                <div className="h-6 bg-muted rounded-lg w-16" />
                <div className="h-6 bg-muted rounded-lg w-16" />
                <div className="h-6 bg-muted rounded-lg w-16" />
            </div>
        </div>
    </div>
)


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
                        <p className="text-sm font-medium text-muted-foreground mb-3">How was your visit to {booking.cafe?.name}?</p>
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
    const [checkInLoadingId, setCheckInLoadingId] = useState(null)
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 5

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                setLoading(true)
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

    const totalPages = Math.ceil(bookings.length / itemsPerPage)
    const currentBookings = bookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)


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

    const handleCheckIn = async (bookingId) => {
        try {
            setCheckInLoadingId(bookingId)
            const response = await diningAPI.checkInBooking(bookingId)
            if (response.data.success) {
                toast.success("Checked in successfully")
                setBookings((prev) =>
                    prev.map((booking) =>
                        booking._id === bookingId
                            ? { ...booking, checkInStatus: true, status: "checked-in", bookingStatus: "confirmed" }
                            : booking
                    )
                )
            }
        } catch (error) {
            console.error("Error checking in:", error)
            toast.error(error.response?.data?.message || "Failed to check in")
        } finally {
            setCheckInLoadingId(null)
        }
    }



    return (
        <AnimatedPage className="bg-background min-h-screen pb-10">
            {/* Header */}
            <div className="bg-card p-4 flex items-center shadow-sm sticky top-0 z-10 border-b border-border">
                <button onClick={() => navigate("/")}>
                    <ArrowLeft className="w-6 h-6 text-muted-foreground hover:text-foreground cursor-pointer" />
                </button>
                <h1 className="ml-4 text-xl font-semibold text-foreground">My Table Bookings</h1>
            </div>

            <div className="max-w-[1100px] mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <BookingSkeleton key={i} />)}
                    </div>
                ) : bookings.length > 0 ? (
                    <>
                        <div className="grid gap-4 md:gap-6">
                            <AnimatePresence mode="popLayout">
                                {currentBookings.map((booking, index) => (
                                    <motion.div
                                        key={booking._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-card rounded-3xl p-5 shadow-sm border border-border group hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 flex flex-col sm:flex-row items-start gap-6"
                                    >
                                        <div className="w-full sm:w-28 h-40 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-muted relative">
                                            <img
                                                src={booking.cafe?.image || booking.cafe?.profileImage?.url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80"}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                alt={booking.cafe?.name}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent sm:hidden" />
                                        </div>

                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                                <div className="space-y-1">
                                                    <h3 className="text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{booking.cafe?.name}</h3>
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                                                        <MapPin className="w-3.5 h-3.5 text-primary" />
                                                        <span className="truncate max-w-[200px] md:max-w-md">
                                                            {typeof booking.cafe?.location === 'string'
                                                                ? booking.cafe.location
                                                                : (booking.cafe?.location?.formattedAddress || booking.cafe?.location?.address || `${booking.cafe?.location?.city || ''}${booking.cafe?.location?.area ? ', ' + booking.cafe.location.area : ''}`)}
                                                        </span>
                                                    </p>
                                                </div>
                                                <Badge className={`px-3 py-1 text-xs font-bold rounded-full border-none shadow-sm ${
                                                    booking.status === "checked-in" ? 'bg-green-500/10 text-green-600' :
                                                    (booking.bookingStatus || booking.status) === 'confirmed' ? 'bg-blue-500/10 text-blue-600' :
                                                    (booking.bookingStatus || booking.status) === 'completed' ? 'bg-primary/10 text-primary' :
                                                    (booking.bookingStatus || booking.status) === 'cancelled' ? 'bg-red-500/10 text-red-600' :
                                                    'bg-amber-500/10 text-amber-600'
                                                }`}>
                                                    <span className="flex items-center gap-1.5 capitalize">
                                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                                            booking.status === "checked-in" ? 'bg-green-600' :
                                                            (booking.bookingStatus || booking.status) === 'confirmed' ? 'bg-blue-600' :
                                                            (booking.bookingStatus || booking.status) === 'completed' ? 'bg-primary' :
                                                            (booking.bookingStatus || booking.status) === 'cancelled' ? 'bg-red-600' :
                                                            'bg-amber-600'
                                                        }`} />
                                                        {booking.status === "checked-in"
                                                            ? "Visited"
                                                            : (booking.bookingStatus || booking.status) === "pending"
                                                                ? "Awaiting Approval"
                                                                : (booking.bookingStatus || booking.status)}
                                                    </span>
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 mt-5">
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                                    {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                    {booking.timeSlot}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                                    <Users className="w-3.5 h-3.5 text-primary" />
                                                    {booking.guests} Guests
                                                </div>
                                            </div>

                                            <div className="flex gap-3 mt-6">
                                                {(booking.bookingStatus === "confirmed" || booking.status === "confirmed") && !booking.checkInStatus && (
                                                    <Button
                                                        onClick={() => handleCheckIn(booking._id)}
                                                        disabled={checkInLoadingId === booking._id}
                                                        className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        {checkInLoadingId === booking._id ? "Checking In..." : "PROCEED TO CHECK-IN"}
                                                    </Button>
                                                )}

                                                {booking.status === 'completed' && (
                                                    <Button
                                                        onClick={() => setSelectedBooking(booking)}
                                                        variant="outline"
                                                        className="flex-1 h-11 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 font-bold rounded-xl transition-all active:scale-95"
                                                    >
                                                        RATE EXPERIENCE
                                                    </Button>
                                                )}
                                                
                                                <Button 
                                                    variant="secondary"
                                                    className="w-11 h-11 rounded-xl p-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                                                    onClick={() => navigate(`/dining/cafe/${booking.cafe?.slug || booking.cafe?._id}`)}
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 py-8">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-xl border-border hover:bg-muted"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                
                                <div className="flex items-center gap-2">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                                                currentPage === i + 1 
                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110' 
                                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                            }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="rounded-xl border-border hover:bg-muted"
                                >
                                    <ChevronRightIcon className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-24 md:py-32">
                        <div className="bg-muted w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <Utensils className="w-12 h-12 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground">No bookings found</h3>
                        <p className="text-muted-foreground text-base mt-3 max-w-xs mx-auto">
                            You haven't made any table reservations yet. Ready for a great meal?
                        </p>
                        <Link to="/dining">
                            <Button className="mt-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-10 py-7 rounded-2xl shadow-xl shadow-primary/20 text-lg transition-all active:scale-95">
                                Book a table now
                            </Button>
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
