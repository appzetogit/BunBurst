import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom"
import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  RefreshCw,
  Phone,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  MessageSquare,
  X,
  Check,
  Receipt,
  CircleSlash,
  Loader2
} from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useOrders } from "../../context/OrdersContext"
import { useProfile } from "../../context/ProfileContext"
import { useLocation as useUserLocation } from "../../hooks/useLocation"
import DeliveryTrackingMap from "../../components/DeliveryTrackingMap"
import { orderAPI, cafeAPI } from "@/lib/api"
import { MAP_APIS_ENABLED } from "@/lib/utils/googleMapsApiKey"
import circleIcon from "@/assets/circleicon.png"
import { useLocationSelector } from "../../components/UserLayout"

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto"
  >
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#FFC400"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#FFC400"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
)

// Real Delivery Map Component with User Live Location
const DeliveryMap = ({ orderId, order, isVisible }) => {
  const { location: userLocation } = useUserLocation() // Get user's live location

  // Get coordinates from order or use defaults (Indore)
  const getCafeCoords = () => {
    console.log('ðŸ” Getting cafe coordinates from order:', {
      hasOrder: !!order,
      cafeLocation: order?.cafeLocation,
      coordinates: order?.cafeLocation?.coordinates,
      cafeId: order?.cafeId,
      cafeIdLocation: order?.cafeId?.location,
      cafeIdCoordinates: order?.cafeId?.location?.coordinates
    });

    // Try multiple sources for cafe coordinates
    let coords = null;

    // Priority 1: cafeLocation.coordinates (already extracted in transformed order)
    if (order?.cafeLocation?.coordinates &&
      Array.isArray(order.cafeLocation.coordinates) &&
      order.cafeLocation.coordinates.length >= 2) {
      coords = order.cafeLocation.coordinates;
      console.log('âœ… Using cafeLocation.coordinates:', coords);
    }
    // Priority 2: cafeId.location.coordinates (if cafeId is populated)
    else if (order?.cafeId?.location?.coordinates &&
      Array.isArray(order.cafeId.location.coordinates) &&
      order.cafeId.location.coordinates.length >= 2) {
      coords = order.cafeId.location.coordinates;
      console.log('âœ… Using cafeId.location.coordinates:', coords);
    }
    // Priority 3: cafeId.location with latitude/longitude
    else if (order?.cafeId?.location?.latitude && order?.cafeId?.location?.longitude) {
      coords = [order.cafeId.location.longitude, order.cafeId.location.latitude];
      console.log('âœ… Using cafeId.location (lat/lng):', coords);
    }

    if (coords && coords.length >= 2) {
      // GeoJSON format is [longitude, latitude]
      const result = {
        lat: coords[1], // Latitude is second element
        lng: coords[0]  // Longitude is first element
      };
      console.log('âœ… Final cafe coordinates (lat, lng):', result, 'from GeoJSON:', coords);
      return result;
    }

    console.warn('âš ï¸ Cafe coordinates not found, using default Indore coordinates');
    // Default Indore coordinates
    return { lat: 22.7196, lng: 75.8577 };
  };

  const getCustomerCoords = () => {
    if (order?.address?.coordinates) {
      return {
        lat: order.address.coordinates[1],
        lng: order.address.coordinates[0]
      };
    }
    // Default Indore coordinates
    return { lat: 22.7196, lng: 75.8577 };
  };

  // Get user's live location coordinates
  const getUserLiveCoords = () => {
    if (userLocation?.latitude && userLocation?.longitude) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      };
    }
    return null;
  };

  const cafeCoords = getCafeCoords();
  const customerCoords = getCustomerCoords();
  const userLiveCoords = getUserLiveCoords();

  // Delivery boy data
  const deliveryBoyData = order?.deliveryPartner ? {
    name: order.deliveryPartner.name || 'Delivery Partner',
    avatar: order.deliveryPartner.avatar || null
  } : null;

  if (!isVisible || !orderId || !order) {
    return (
      <motion.div
        className="relative h-64 bg-gradient-to-b from-gray-100 to-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
    );
  }

  return (
    <motion.div
      className="relative h-64 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <DeliveryTrackingMap
        orderId={orderId}
        cafeCoords={cafeCoords}
        customerCoords={customerCoords}
        userLiveCoords={userLiveCoords}
        userLocationAccuracy={userLocation?.accuracy}
        deliveryBoyData={deliveryBoyData}
        order={order}
      />
    </motion.div>
  );
}

// Section item component
const SectionItem = ({ icon: Icon, title, subtitle, onClick, showArrow = true, rightContent }) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-[#fff8f7] transition-colors text-left border-b border-dashed border-[#F5F5F5] last:border-0"
    whileTap={{ scale: 0.99 }}
  >
    {Icon && (
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="font-medium text-[#1E1E1E]">{title}</p>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
    {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400" />)}
  </motion.button>
)

export default function OrderTracking() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const confirmed = searchParams.get("confirmed") === "true"
  const { getOrderById } = useOrders()
  const { profile, getDefaultAddress } = useProfile()
  const { openLocationSelector } = useLocationSelector()
  const { location: userLiveLocation } = useUserLocation()
  const getOrderByIdRef = useRef(getOrderById)

  const [selectedAddressLabel, setSelectedAddressLabel] = useState(() => {
    return localStorage.getItem("userDeliveryAddressLabel") || "Location"
  })

  // Keep the selected label in sync
  useEffect(() => {
    const handleLabelChange = (e) => {
      const nextLabel = e?.detail?.label
      if (!nextLabel) return
      setSelectedAddressLabel(nextLabel)
      localStorage.setItem("userDeliveryAddressLabel", nextLabel)
    }

    window.addEventListener("userDeliveryLabelChanged", handleLabelChange)
    return () => {
      window.removeEventListener("userDeliveryLabelChanged", handleLabelChange)
    }
  }, [])

  // State for order data
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showConfirmation, setShowConfirmation] = useState(confirmed)
  const [estimatedTime, setEstimatedTime] = useState(29)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  const defaultAddress = getDefaultAddress()

  // Keep a ref to the latest order so the polling interval can read current state
  // without needing `order` as an effect dependency (which would restart the interval
  // every time order updates â€” causing an infinite cascade of new intervals).
  const orderRef = useRef(order)
  useEffect(() => { orderRef.current = order }, [order])

  // Poll for order status updates
  useEffect(() => {
    getOrderByIdRef.current = getOrderById
  }, [getOrderById])

  useEffect(() => {
    if (!orderId) return

    const tick = async () => {
      const currentOrder = orderRef.current
      if (!currentOrder) return

      // Stop polling entirely for terminal states â€” no point continuing
      const terminalStatuses = ['delivered', 'cancelled', 'rejected']
      if (terminalStatuses.includes(currentOrder.status)) return

      try {
        const response = await orderAPI.getOrderDetails(orderId)
        if (!response.data?.success || !response.data.data?.order) return

        const apiOrder = response.data.data.order
        const newDeliveryStatus = apiOrder.deliveryState?.status
        const newPhase = apiOrder.deliveryState?.currentPhase
        const newOrderStatus = apiOrder.status
        const prevDeliveryStatus = currentOrder?.deliveryState?.status
        const prevPhase = currentOrder?.deliveryState?.currentPhase
        const prevOrderStatus = currentOrder?.status

        // Only update state if something actually changed â€” avoids noisy re-renders
        const hasChanged =
          newDeliveryStatus !== prevDeliveryStatus ||
          newPhase !== prevPhase ||
          newOrderStatus !== prevOrderStatus

        if (!hasChanged) return

        // Re-fetch and update order (same logic as initial fetch)
        let cafeCoords = null;
        let cafeAddress = 'Local Area';
        if (apiOrder.cafeId?.location) {
          const loc = apiOrder.cafeId.location;
          if (loc.coordinates?.length >= 2) cafeCoords = loc.coordinates;
          else if (loc.latitude && loc.longitude) cafeCoords = [loc.longitude, loc.latitude];
          
          cafeAddress = loc.formattedAddress || loc.address || [loc.addressLine1, loc.city].filter(Boolean).join(', ') || 'Local Area';
        } else if (typeof apiOrder.cafeId === 'string') {
          try {
            const res = await cafeAPI.getCafeById(apiOrder.cafeId);
            const cafe = res?.data?.data?.cafe;
            if (cafe?.location) {
              if (cafe.location.coordinates?.length >= 2) cafeCoords = cafe.location.coordinates;
              cafeAddress = cafe.location.formattedAddress || cafe.location.address || [cafe.location.addressLine1, cafe.location.city].filter(Boolean).join(', ') || 'Local Area';
            }
          } catch { /* silently ignore */ }
        }

        setOrder(prev => ({
          ...prev,
          ...apiOrder,
          cafeLocation: cafeCoords ? { coordinates: cafeCoords } : prev?.cafeLocation,
          cafeAddress: cafeAddress || prev?.cafeAddress,
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
            phone: apiOrder.deliveryPartnerId.phone || '',
            avatar: null
          } : prev?.deliveryPartner,
          deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || prev?.deliveryPartnerId,
          assignmentInfo: apiOrder.assignmentInfo || prev?.assignmentInfo,
          deliveryState: apiOrder.deliveryState || prev?.deliveryState,
          adminAcceptance: apiOrder.adminAcceptance || prev?.adminAcceptance
        }))

      } catch (err) {
        // Silently ignore 429 / network errors â€” interval will retry next tick
        if (err?.response?.status !== 429) {
          console.error('Error polling order updates:', err)
        }
      }
    }

    // Determine poll interval based on current order state
    // Delivered/cancelled orders: no polling (handled by terminal check above)
    // Delivery partner assigned: 30s (location updates come via socket anyway)
    // Waiting for assignment: 15s (was 5s â€” reduced to avoid rate limits)
    const currentOrder = orderRef.current
    const phase = currentOrder?.deliveryState?.currentPhase
    const isEnRoute = phase === 'en_route_to_pickup' || phase === 'at_pickup' || phase === 'en_route_to_delivery'
    const pollInterval = isEnRoute ? 30000 : 15000

    const interval = setInterval(tick, pollInterval)
    return () => clearInterval(interval)
    // Only depends on orderId â€” order state is read via ref, not deps
    // This prevents the interval from being destroyed/recreated on every order update
  }, [orderId])

  useEffect(() => {
    if (!MAP_APIS_ENABLED) return

    let cancelled = false

    const preloadGoogleMaps = async () => {
      try {
        const { loadGoogleMaps } = await import("@/lib/utils/googleMapsLoader.js")
        await loadGoogleMaps({ libraries: [] })
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to preload Google Maps for order tracking:", error)
        }
      }
    }

    preloadGoogleMaps()

    return () => {
      cancelled = true
    }
  }, [])

  // Fetch order from API if not found in context
  useEffect(() => {
    const fetchOrder = async () => {
      // First try to get from context (localStorage)
      const contextOrder = getOrderByIdRef.current?.(orderId)
      if (contextOrder) {
        // Ensure cafe location is available in context order
        if (!contextOrder.cafeLocation?.coordinates && contextOrder.cafeId?.location?.coordinates) {
          contextOrder.cafeLocation = {
            coordinates: contextOrder.cafeId.location.coordinates
          };
        }
        // Also ensure cafeId is present
        if (!contextOrder.cafeId && contextOrder.cafe) {
          // Try to preserve cafeId if it exists
          console.log('âš ï¸ Context order missing cafeId, will fetch from API');
        }
        setOrder(contextOrder)

        setLoading(false)
        // do not return so SWR background fetch runs
      }

      // If not in context, fetch from API
      try {
        if (!contextOrder) setLoading(true)
        setError(null)

        const response = await orderAPI.getOrderDetails(orderId)

        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order

          // Log full API response structure for debugging
          console.log('ðŸ” Full API Order Response:', {
            orderId: apiOrder.orderId || apiOrder._id,
            hasCafeId: !!apiOrder.cafeId,
            cafeIdType: typeof apiOrder.cafeId,
            cafeIdKeys: apiOrder.cafeId ? Object.keys(apiOrder.cafeId) : [],
            cafeIdLocation: apiOrder.cafeId?.location,
            cafeIdLocationKeys: apiOrder.cafeId?.location ? Object.keys(apiOrder.cafeId.location) : [],
            cafeIdCoordinates: apiOrder.cafeId?.location?.coordinates,
            fullCafeId: apiOrder.cafeId
          });

          // Extract cafe location coordinates and address with multiple fallbacks
          let cafeCoords = null;
          let cafeAddress = 'Local Area';

          // Priority 1: cafeId.location (GeoJSON format: [lng, lat])
          if (apiOrder.cafeId?.location) {
            const loc = apiOrder.cafeId.location;
            if (loc.coordinates?.length >= 2) {
              cafeCoords = loc.coordinates;
            } else if (loc.latitude && loc.longitude) {
              cafeCoords = [loc.longitude, loc.latitude];
            }
            cafeAddress = loc.formattedAddress || loc.address || [loc.addressLine1, loc.city].filter(Boolean).join(', ') || 'Local Area';
          }
          // Priority 3: Check if cafeId is a string ID and fetch cafe details
          if (!cafeCoords || cafeAddress === 'Local Area') {
            const cafeIdToFetch = typeof apiOrder.cafeId === 'string' ? apiOrder.cafeId : apiOrder.cafeId?._id;
            if (cafeIdToFetch) {
              try {
                const cafeResponse = await cafeAPI.getCafeById(cafeIdToFetch);
                if (cafeResponse?.data?.success && cafeResponse.data.data?.cafe) {
                  const cafe = cafeResponse.data.data.cafe;
                  if (cafe.location) {
                    if (!cafeCoords && cafe.location.coordinates?.length >= 2) {
                      cafeCoords = cafe.location.coordinates;
                    }
                    if (cafeAddress === 'Local Area') {
                      cafeAddress = cafe.location.formattedAddress || cafe.location.address || [cafe.location.addressLine1, cafe.location.city].filter(Boolean).join(', ') || 'Local Area';
                    }
                  }
                }
              } catch (err) {
                console.error('Error fetching cafe details:', err);
              }
            }
          }
          // Priority 4: Check nested cafe data
          if (!cafeCoords && apiOrder.cafe?.location?.coordinates) {
            cafeCoords = apiOrder.cafe.location.coordinates;
          }
          console.log('Found coordinates:', cafeCoords);


          console.log('ðŸ“ Final cafe coordinates:', cafeCoords);
          console.log('ðŸ“ Customer coordinates:', apiOrder.address?.location?.coordinates);

          // Transform API order to match component structure
          const transformedOrder = {
            id: apiOrder.orderId || apiOrder._id,
            cafe: apiOrder.cafeName || 'Cafe',
            cafeId: apiOrder.cafeId || null, // Include cafeId for location access
            userId: apiOrder.userId || null, // Include user data for phone number
            userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
            userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
            adminAcceptance: apiOrder.adminAcceptance || null,
            address: {
              street: apiOrder.address?.street || '',
              city: apiOrder.address?.city || '',
              state: apiOrder.address?.state || '',
              zipCode: apiOrder.address?.zipCode || '',
              additionalDetails: apiOrder.address?.additionalDetails || '',
              formattedAddress: apiOrder.address?.formattedAddress ||
                (apiOrder.address?.street && apiOrder.address?.city
                  ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                  : apiOrder.address?.city || ''),
              coordinates: apiOrder.address?.location?.coordinates || null
            },
            cafeLocation: {
              coordinates: cafeCoords
            },
            cafeAddress: cafeAddress,
            items: apiOrder.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              variantId: item.variantId || item.variant?.id || null,
              variantName: item.variantName || item.variant?.name || null,
              variantPrice: item.variantPrice || item.variant?.price || null
            })) || [],
            total: apiOrder.pricing?.total || 0,
            status: apiOrder.status || 'pending',
            deliveryPartner: apiOrder.deliveryPartnerId ? {
              name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
              phone: apiOrder.deliveryPartnerId.phone || '',
              avatar: null
            } : null,
            deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
            assignmentInfo: apiOrder.assignmentInfo || null,
            tracking: apiOrder.tracking || {},
            deliveryState: apiOrder.deliveryState || null,
            orderType: apiOrder.orderType || 'DELIVERY'
          }

          setOrder(transformedOrder)

        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  // Simulate order status progression
  useEffect(() => {
    if (confirmed) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false)
      }, 3000)
      return () => clearTimeout(timer1)
    }
  }, [confirmed])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEstimatedTime((prev) => Math.max(0, prev - 1))
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Listen for order status updates from socket (e.g., "Delivery partner on the way")
  useEffect(() => {
    const handleOrderStatusNotification = (event) => {
      const { message, title, status, estimatedDeliveryTime } = event.detail;

      console.log('ðŸ“¢ Order status notification received:', { message, status });

      // Show notification toast
      if (message) {
        toast.success(message, {
          duration: 5000,
          icon: 'ðŸï¸',
          position: 'top-center',
          description: estimatedDeliveryTime
            ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes`
            : undefined
        });

        // Optional: Vibrate device if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    };

    // Listen for custom event from DeliveryTrackingMap
    window.addEventListener('orderStatusNotification', handleOrderStatusNotification);

    return () => {
      window.removeEventListener('orderStatusNotification', handleOrderStatusNotification);
    };
  }, [])

  const handleCancelOrder = () => {
    // Check if order can be cancelled (only Razorpay orders that aren't delivered/cancelled)
    if (!order) return;

    if (order.status === 'cancelled') {
      toast.error('Order is already cancelled');
      return;
    }

    if (order.status === 'delivered' || order.status === 'picked_up' || order.status === 'out_for_delivery' || order.status === 'rejected') {
      toast.error('Cannot cancel an order that is already picked up, out for delivery or delivered');
      return;
    }

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await orderAPI.cancelOrder(orderId, cancellationReason.trim());
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message ||
          (paymentMethod === 'cash' || paymentMethod === 'cod'
            ? 'Order cancelled successfully. No refund required as payment was not made.'
            : 'Order cancelled successfully. Refund will be processed after admin approval.');
        toast.success(successMessage);
        setShowCancelDialog(false);
        setCancellationReason("");
        // Refresh order data
        const orderResponse = await orderAPI.getOrderDetails(orderId);
        if (orderResponse.data?.success && orderResponse.data.data?.order) {
          const apiOrder = orderResponse.data.data.order;
          setOrder(apiOrder);
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await orderAPI.getOrderDetails(orderId)
      if (response.data?.success && response.data.data?.order) {
        const apiOrder = response.data.data.order

        // Extract cafe location coordinates and address with multiple fallbacks
        let cafeCoords = null;
        let cafeAddress = 'Local Area';

        if (apiOrder.cafeId?.location) {
          const loc = apiOrder.cafeId.location;
          if (loc.coordinates?.length >= 2) {
            cafeCoords = loc.coordinates;
          } else if (loc.latitude && loc.longitude) {
            cafeCoords = [loc.longitude, loc.latitude];
          }
          cafeAddress = loc.formattedAddress || loc.address || [loc.addressLine1, loc.city].filter(Boolean).join(', ') || 'Local Area';
        }
        
        if (!cafeCoords || cafeAddress === 'Local Area') {
          const cafeIdToFetch = typeof apiOrder.cafeId === 'string' ? apiOrder.cafeId : apiOrder.cafeId?._id;
          if (cafeIdToFetch) {
            try {
              const cafeResponse = await cafeAPI.getCafeById(cafeIdToFetch);
              if (cafeResponse?.data?.success && cafeResponse.data.data?.cafe) {
                const cafe = cafeResponse.data.data.cafe;
                if (cafe.location) {
                  if (!cafeCoords && cafe.location.coordinates?.length >= 2) {
                    cafeCoords = cafe.location.coordinates;
                  }
                  if (cafeAddress === 'Local Area') {
                    cafeAddress = cafe.location.formattedAddress || cafe.location.address || [cafe.location.addressLine1, cafe.location.city].filter(Boolean).join(', ') || 'Local Area';
                  }
                }
              }
            } catch (err) {
              console.error('Error fetching cafe details:', err);
            }
          }
        }

          const transformedOrder = {
            id: apiOrder.orderId || apiOrder._id,
            cafe: apiOrder.cafeName || 'Cafe',
            cafeId: apiOrder.cafeId || null, // Include cafeId for location access
            userId: apiOrder.userId || null, // Include user data for phone number
            userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
            userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
            adminAcceptance: apiOrder.adminAcceptance || null,
            address: {
              street: apiOrder.address?.street || '',
              city: apiOrder.address?.city || '',
            state: apiOrder.address?.state || '',
            zipCode: apiOrder.address?.zipCode || '',
            additionalDetails: apiOrder.address?.additionalDetails || '',
            formattedAddress: apiOrder.address?.formattedAddress ||
              (apiOrder.address?.street && apiOrder.address?.city
                ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                : apiOrder.address?.city || ''),
            coordinates: apiOrder.address?.location?.coordinates || null
          },
          cafeLocation: {
            coordinates: cafeCoords
          },
          cafeAddress: cafeAddress,
          items: apiOrder.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            variantId: item.variantId || item.variant?.id || null,
            variantName: item.variantName || item.variant?.name || null,
            variantPrice: item.variantPrice || item.variant?.price || null
          })) || [],
          total: apiOrder.pricing?.total || 0,
          status: apiOrder.status || 'pending',
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
            phone: apiOrder.deliveryPartnerId.phone || '',
            avatar: null
          } : null,
          tracking: apiOrder.tracking || {},
          orderType: apiOrder.orderType || 'DELIVERY'
        }
        setOrder(transformedOrder)
      }
    } catch (err) {
      console.error('Error refreshing order:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const orderType = String(order?.orderType || "DELIVERY").toUpperCase()
  const backendStatus = (order?.status || "pending").toString().toLowerCase()
  const adminAccepted = order?.adminAcceptance?.status === true
  const pendingOverrideStatuses = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'assigned',
    'out_for_delivery'
  ]
  const effectiveStatus = (!adminAccepted && pendingOverrideStatuses.includes(backendStatus))
    ? 'pending'
    : backendStatus

  // Hide "Order Confirmed" modal if admin hasn't accepted yet
  useEffect(() => {
    if (!confirmed) return
    if (!adminAccepted && pendingOverrideStatuses.includes(backendStatus)) {
      setShowConfirmation(false)
    }
  }, [confirmed, adminAccepted, backendStatus])

  // Loading state
  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </AnimatedPage>
    )
  }

  // Error state
  if (error || !order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The order you\'re looking for doesn\'t exist.'}</p>
          <Link to="/user/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  const pickupStatusConfig = {
    pending: { title: "Order placed", subtitle: "Waiting for acceptance", theme: "red" },
    confirmed: { title: "Order accepted", subtitle: "Order accepted", theme: "red" },
    preparing: { title: "Preparing your order", subtitle: "Preparing your order", theme: "red" },
    ready_for_pickup: { title: "Your order is ready for pickup", subtitle: "Ready for pickup", theme: "red" },
    picked_up: { title: "Order picked up", subtitle: "Your order has been collected successfully", theme: "red" },
    cancelled: { title: "Order cancelled", subtitle: "This order has been cancelled", theme: "red" },
  }

  const deliveryStatusConfig = {
    pending: { title: "Order placed", subtitle: "Waiting for acceptance", theme: "red" },
    confirmed: { title: "Order accepted", subtitle: "Food preparation will begin shortly", theme: "red" },
    preparing: { title: "Preparing your order", subtitle: `Arriving in ${estimatedTime} mins`, theme: "red" },
    ready: { title: "Order ready", subtitle: `Arriving in ${estimatedTime} mins`, theme: "red" },
    out_for_delivery: { title: "Order on the way", subtitle: `Arriving in ${estimatedTime} mins`, theme: "red" },
    delivered: { title: "Order delivered", subtitle: "Enjoy your meal!", theme: "red" },
    cancelled: { title: "Order cancelled", subtitle: "This order has been cancelled", theme: "red" },
  }

  const currentStatus =
    orderType === "PICKUP"
      ? (pickupStatusConfig[effectiveStatus] || { title: "Order update", subtitle: effectiveStatus, theme: "red" })
      : (deliveryStatusConfig[effectiveStatus] || { title: "Order update", subtitle: effectiveStatus, theme: "red" })

  const themeMap = {
    red: {
      primary: "#e53935",
      primaryDark: "#c62828",
      page: "#fff5f5",
      soft: "#fff1f1",
      softBorder: "#f8d7da",
      accent: "#7f1d1d",
    },
    green: {
      primary: "#16a34a",
      primaryDark: "#15803d",
      page: "#f0fdf4",
      soft: "#ecfdf3",
      softBorder: "#bbf7d0",
      accent: "#14532d",
    },
    slate: {
      primary: "#0f172a",
      primaryDark: "#0b1220",
      page: "#f8fafc",
      soft: "#f1f5f9",
      softBorder: "#e2e8f0",
      accent: "#0f172a",
    },
  }

  const theme = themeMap[currentStatus.theme] || themeMap.red
  return (
    <div className="min-h-screen dark:bg-[#0a0a0a]" style={{ backgroundColor: theme.page }}>
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8"
            >
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-[#1E1E1E] mt-6"
              >
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2"
              >
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8"
              >
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                  style={{ borderColor: theme.primary }}
                />
                <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Red Header */}
      <motion.div
        className="text-white sticky top-0 z-40"
        style={{ backgroundColor: theme.primary }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/user/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.cafe}</h2>
          <div className="w-10" />
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-sm">{currentStatus.subtitle}</span>
            {backendStatus === 'preparing' && (
              <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-[#FFC400]">On time</span>
              </>
            )}
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      <DeliveryMap
        orderId={orderId}
        order={order}
        isVisible={order !== null}
      />

      {/* Scrollable Content */}
      <div className="w-full lg:max-w-[1100px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">
        {/* Food Cooking Status */}
        {effectiveStatus !== "cancelled" && (() => {
          const hasAcceptedPickup = order?.tracking?.outForDelivery?.status === true ||
            order?.tracking?.out_for_delivery?.status === true ||
            order?.status === 'out_for_delivery' ||
            order?.status === 'ready' ||
            order?.status === 'ready_for_pickup' ||
            order?.status === 'picked_up'

          if (!hasAcceptedPickup) {
            return (
              <motion.div
                className="bg-white rounded-xl p-4 shadow-sm border border-[#F5F5F5]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: theme.soft }}
                  >
                    <img src={circleIcon} alt="Food cooking" className="w-full h-full object-cover" />
                  </div>
                  <p className="font-semibold text-[#1E1E1E]">Food is Cooking</p>
                </div>
              </motion.div>
            )
          }
          return null
        })()}

        {/* Delivery Details Banner */}
        {effectiveStatus !== "cancelled" && (
          <motion.div
            className="rounded-xl p-4 text-center border"
            style={{ backgroundColor: theme.soft, borderColor: theme.softBorder, color: theme.accent }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <p className="font-medium">All your delivery details in one place 👇</p>
          </motion.div>
        )}

        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden border border-[#F5F5F5]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {order?.deliveryPartner && (
            <SectionItem
              icon={Phone}
              title={order.deliveryPartner.name}
              subtitle={order.deliveryPartner.phone || 'Contacting partner...'}
              rightContent={
                <a
                  href={`tel:${order.deliveryPartner.phone}`}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-5 h-5" />
                </a>
              }
            />
          )}

          <SectionItem
            showArrow={false}
            title={`${order?.userName || order?.userId?.fullName || order?.userId?.name || profile?.fullName || profile?.name || 'Customer'} (You)`}
            subtitle={order?.userPhone || order?.userId?.phone || profile?.phone || defaultAddress?.phone || 'Phone number not available'}
          />
          {orderType !== "PICKUP" && (
            <SectionItem
              icon={HomeIcon}
              title={`Delivery at ${selectedAddressLabel || 'Location'}`}
              showArrow={false}
              subtitle={(() => {
                if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location") return order.address.formattedAddress
                if (userLiveLocation?.formattedAddress && userLiveLocation.formattedAddress !== "Select location") return userLiveLocation.formattedAddress
                if (order?.address) {
                  const parts = []
                  if (order.address.street) parts.push(order.address.street)
                  if (order.address.additionalDetails) parts.push(order.address.additionalDetails)
                  if (order.address.city) parts.push(order.address.city)
                  if (order.address.state) parts.push(order.address.state)
                  if (order.address.zipCode) parts.push(order.address.zipCode)
                  if (parts.length > 0) return parts.join(', ')
                }
                if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") return defaultAddress.formattedAddress
                if (defaultAddress) {
                  const parts = []
                  if (defaultAddress.street) parts.push(defaultAddress.street)
                  if (defaultAddress.additionalDetails) parts.push(defaultAddress.additionalDetails)
                  if (defaultAddress.city) parts.push(defaultAddress.city)
                  if (defaultAddress.state) parts.push(defaultAddress.state)
                  if (defaultAddress.zipCode) parts.push(defaultAddress.zipCode)
                  if (parts.length > 0) return parts.join(', ')
                }
                return 'Add delivery address'
              })()}
            />
          )}
          {/* Delivery instructions removed as requested */}
        </motion.div>

        {/* Cafe Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-[#F5F5F5]">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🍔</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1E1E1E]">{order.cafe}</p>
              <p className="text-sm text-gray-500">{order.cafeAddress || 'Local Area'}</p>
            </div>
          </div>

          <motion.button
            onClick={() => navigate(`/orders/${orderId}/details`)}
            className="w-full text-left p-4 border-b border-dashed border-[#F5F5F5] hover:bg-[#fff8f7] transition-colors"
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-[#1E1E1E]">Order #{order?.id || order?.orderId || 'N/A'}</p>
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-[#FFC400] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#FFC400]" />
                      </span>
                      <span>
                        {item.quantity} x {item.name}
                        {item.variantName ? ` (${item.variantName})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </motion.button>
        </motion.div>

        {/* Cancel Order Button - Hidden when order is picked up, delivered, cancelled or rejected */}
        {order?.status !== 'delivered' && 
         order?.status !== 'cancelled' && 
         order?.status !== 'picked_up' && 
         order?.status !== 'out_for_delivery' && 
         order?.status !== 'rejected' && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <SectionItem
              icon={CircleSlash}
              title="Cancel order"
              subtitle=""
              onClick={handleCancelOrder}
            />
          </motion.div>
        )}

      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1E1E1E]">
              Cancel Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-6 px-2">
            <div className="space-y-2 w-full">
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Changed my mind, Wrong address, etc."
                className="w-full min-h-[100px] resize-none border-2 border-[#F5F5F5] rounded-lg px-4 py-3 text-sm focus:border-[#e53935] focus:ring-2 focus:ring-[#e53935]/20 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-[#F5F5F5]"
                disabled={isCancelling}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowCancelDialog(false); setCancellationReason(""); }}
                disabled={isCancelling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="flex-1 text-white hover:opacity-90"
                style={{ backgroundColor: theme.primary }}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

