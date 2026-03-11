import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react"
import { useProgressStore } from "../store/progressStore"
import { deliveryAPI } from "@/lib/api"

export default function TripHistory() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("daily")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTripType, setSelectedTripType] = useState("All Trips")
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTripTypePicker, setShowTripTypePicker] = useState(false)
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const tripTypes = ["All Trips", "COD Orders", "Online Orders"]

  const { updateTodayTrips } = useProgressStore()

  // Fetch trips from API
  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true)
      setError("")
      
      try {
        const params = {
          period: activeTab,
          date: selectedDate.toISOString().split('T')[0],
          paymentType:
            selectedTripType === "COD Orders"
              ? "COD"
              : selectedTripType === "Online Orders"
                ? "ONLINE"
                : undefined,
          limit: 1000
        }

        const response = await deliveryAPI.getDeliveredTrips(params)
        
        if (response.data?.success && response.data?.data?.trips) {
          const tripsData = response.data.data.trips
          setTrips(tripsData)
          
          // Update store if viewing today's data and showing all trips
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const selectedDateNormalized = new Date(selectedDate)
          selectedDateNormalized.setHours(0, 0, 0, 0)
          
          if (activeTab === "daily" && selectedDateNormalized.getTime() === today.getTime() && selectedTripType === "All Trips") {
            updateTodayTrips(tripsData.length)
          }
        } else {
          setTrips([])
        }
      } catch (error) {
        console.error("Error fetching trip history:", error)
        setError("Failed to load trip history. Please try again.")
        setTrips([])
      } finally {
        setLoading(false)
      }
    }

    fetchTrips()
  }, [selectedDate, activeTab, selectedTripType, updateTodayTrips])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDatePicker(false)
      setShowTripTypePicker(false)
    }
    if (showDatePicker || showTripTypePicker) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDatePicker, showTripTypePicker])

  // Format date for display
  const formatDateDisplay = (date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      const options = { day: 'numeric', month: 'short' }
      return date.toLocaleDateString('en-US', options)
    }
  }

  // Generate recent dates for picker
  const generateRecentDates = () => {
    const dates = []
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date)
    }
    return dates
  }

  const recentDates = generateRecentDates()

  const formatTime = (dateValue) => {
    if (!dateValue) return "—"
    const d = new Date(dateValue)
    const hours = d.getHours()
    const minutes = d.getMinutes()
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <div className="bg-white border-b border-[#F5F5F5] px-4 py-4 flex items-center flex-shrink-0 sticky top-0 z-40">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-[#fff8f7] rounded-full transition-colors mr-2"
        >
          <ArrowLeft className="w-5 h-5 text-[#1E1E1E]" />
        </button>
        <h1 className="text-lg font-bold text-[#1E1E1E] flex-1 text-center">Trip History</h1>
        <div className="w-9" />
      </div>

      {/* Sticky Period Selection Tabs */}
      <div className="bg-white px-4 py-4 border-b border-[#F5F5F5] flex-shrink-0 sticky top-[57px] z-30">
        <div className="flex gap-6">
          <button
            onClick={() => {
              setActiveTab("daily")
              setShowDatePicker(false)
            }}
            className="relative"
          >
            <span className={`text-base font-medium transition-colors ${
              activeTab === "daily" ? "text-[#e53935]" : "text-[#1E1E1E]/55"
            }`}>
              Daily
            </span>
            {activeTab === "daily" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e53935] mt-2"></div>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("weekly")
              setShowDatePicker(false)
            }}
            className="relative"
          >
            <span className={`text-base font-medium transition-colors ${
              activeTab === "weekly" ? "text-[#e53935]" : "text-[#1E1E1E]/55"
            }`}>
              Weekly
            </span>
            {activeTab === "weekly" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e53935] mt-2"></div>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("monthly")
              setShowDatePicker(false)
            }}
            className="relative"
          >
            <span className={`text-base font-medium transition-colors ${
              activeTab === "monthly" ? "text-[#e53935]" : "text-[#1E1E1E]/55"
            }`}>
              Monthly
            </span>
            {activeTab === "monthly" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e53935] mt-2"></div>
            )}
          </button>
        </div>
      </div>

      {/* Sticky Filter Controls */}
      <div className="bg-white px-4 py-4 border-b border-[#F5F5F5] flex gap-3 flex-shrink-0 sticky top-[129px] z-30">
        {/* Date/Period Selector */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowDatePicker(!showDatePicker)
            setShowTripTypePicker(false)
          }}
          className="flex-1 flex items-center justify-between px-4 py-3 bg-white border border-[#F5F5F5] rounded-lg hover:bg-[#fff8f7] transition-colors"
        >
          <span className="text-sm font-medium text-[#1E1E1E]">
            {formatDateDisplay(selectedDate)}: {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
        </button>

        {/* Trip Type Selector */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowTripTypePicker(!showTripTypePicker)
            setShowDatePicker(false)
          }}
          className="flex-1 flex items-center justify-between px-4 py-3 bg-white border border-[#F5F5F5] rounded-lg hover:bg-[#fff8f7] transition-colors"
        >
          <span className="text-sm font-medium text-[#1E1E1E]">{selectedTripType}</span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showTripTypePicker ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Date Picker Dropdown */}
      {showDatePicker && (
        <div className="fixed left-4 right-4 top-[201px] bg-white border border-[#F5F5F5] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {recentDates.map((date, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedDate(date)
                setShowDatePicker(false)
              }}
              className={`w-full text-left px-4 py-3 border-b border-[#F5F5F5] last:border-b-0 hover:bg-[#fff8f7] transition-colors ${
                date.toDateString() === selectedDate.toDateString() ? 'bg-[#fff8f7] font-medium' : ''
              }`}
            >
              <span className="text-sm text-[#1E1E1E]">
                {formatDateDisplay(date)}: {date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Trip Type Picker Dropdown */}
      {showTripTypePicker && (
        <div className="fixed right-4 top-[201px] bg-white border border-[#F5F5F5] rounded-lg shadow-lg z-50 min-w-[150px]">
          {tripTypes.map((type, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedTripType(type)
                setShowTripTypePicker(false)
              }}
              className={`w-full text-left px-4 py-3 border-b border-[#F5F5F5] last:border-b-0 hover:bg-[#fff8f7] transition-colors ${
                type === selectedTripType ? 'bg-[#fff8f7] font-medium' : ''
              }`}
            >
              <span className="text-sm text-[#1E1E1E]">{type}</span>
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-[#e53935] animate-spin mb-4" />
            <p className="text-gray-500 text-base">Loading trips...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#e53935] text-base mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-[#e53935] text-sm underline"
            >
              Retry
            </button>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-base">No trips found for selected date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div
                key={trip.id || trip.orderId}
                className="bg-white border border-[#F5F5F5] rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-[#1E1E1E]">{trip.orderId}</p>
                    <p className="text-sm text-gray-600 mt-1">Cafe: {trip.cafeName || trip.cafe || 'Unknown Cafe'}</p>
                    {(() => {
                      const paymentType = trip.paymentMethod || trip.payment?.method || 'ONLINE'
                      const isCOD = paymentType === 'COD' || paymentType === 'cash' || paymentType === 'cod'
                      return (
                        <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full ${
                          isCOD ? 'bg-[#FFF9E0] text-[#FFC400]' : 'bg-[#E8F1FF] text-[#1E88E5]'
                        }`}>
                          {isCOD ? 'COD' : 'ONLINE'}
                        </span>
                      )
                    })()}
                  </div>
                  <span className="text-sm font-medium text-[#e53935]">Delivered</span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F5F5F5] grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Delivered At</p>
                    <p className="text-sm font-medium text-[#1E1E1E] mt-1">
                      {formatTime(trip.deliveredAt || trip.deliveryTime || trip.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Order Amount</p>
                    <p className="text-sm font-semibold text-[#1E1E1E] mt-1">₹{Number(trip.orderAmount || trip.amount || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cash Collected</p>
                    <p className="text-sm font-semibold text-[#1E1E1E] mt-1">₹{Number(trip.cashCollected || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="text-sm font-medium text-[#1E1E1E] mt-1">{trip.customerName || trip.customer || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

