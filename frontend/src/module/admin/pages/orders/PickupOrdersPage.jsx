import { useEffect, useState } from "react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const statusLabel = (status) => {
  if (!status) return "Pending"
  switch (status) {
    case "ready_for_pickup":
      return "Ready For Pickup"
    case "picked_up":
      return "Picked Up"
    case "preparing":
      return "Preparing"
    case "confirmed":
      return "Confirmed"
    case "pending":
      return "Pending"
    case "ready":
      return "Ready"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

export default function PickupOrdersPage() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getOrders({
        page: 1,
        limit: 1000,
        orderType: "PICKUP",
      })

      if (response.data?.success && response.data?.data?.orders) {
        setOrders(response.data.data.orders)
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching pickup orders:", error)
      toast.error(error.response?.data?.message || "Failed to fetch pickup orders")
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleAccept = async (order) => {
    try {
      await adminAPI.acceptOrder(order.id || order._id || order.orderId)
      toast.success(`Order ${order.orderId} accepted successfully`)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to accept order")
    }
  }

  const handleMarkPreparing = async (order) => {
    try {
      await adminAPI.markOrderPreparing(order.id || order._id || order.orderId)
      toast.success(`Order ${order.orderId} marked as preparing`)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update order status")
    }
  }

  const handleMarkReady = async (order) => {
    try {
      await adminAPI.markOrderReadyForPickup(order.id || order._id || order.orderId)
      toast.success(`Order ${order.orderId} marked as ready for pickup`)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update order status")
    }
  }

  const handleMarkPickedUp = async (order) => {
    try {
      await adminAPI.markOrderPickedUp(order.id || order._id || order.orderId)
      toast.success(`Order ${order.orderId} marked as picked up`)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update order status")
    }
  }

  const handlePaymentCollectionStatus = async (order, status) => {
    try {
      await adminAPI.updatePaymentCollectionStatus(
        order.id || order._id || order.orderId,
        status
      )
      toast.success(`Payment marked as ${status} for order ${order.orderId}`)
      fetchOrders()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update payment status")
    }
  }

  // Transitions: 
  // No Admin Acceptance -> Accept Order
  // Accepted (Confirmed) -> Preparing
  // Preparing -> Ready for Pickup
  // Ready for Pickup -> Picked Up (Completed)
  
  const canAccept = (order) => !order.adminAcceptance?.status
  const canMarkPreparing = (order) => order.adminAcceptance?.status && order.status === "confirmed"
  const canMarkReady = (order) => order.status === "preparing"
  const canMarkPickedUp = (order) => order.status === "ready_for_pickup"

  return (
    <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-[#1E1E1E]">Pickup Orders</h1>
          <p className="text-xs lg:text-sm text-[#1E1E1E] mt-1">Manage pickup-only orders</p>
        </div>
      </div>

      <div className="bg-white border border-[#F5F5F5] rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F5F5F5] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1E1E1E]">Orders</h2>
        </div>

        {isLoading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#1E1E1E]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-sm text-[#1E1E1E]">No pickup orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F5F5F5]">
                <tr className="text-left text-xs font-semibold text-[#1E1E1E]">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Cafe</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 text-center">Order Status</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = order.status
                  const paymentMethod = order.payment?.method || order.paymentMethod
                  const isCod = order.paymentType === "Cash on Delivery" || paymentMethod === "cash" || paymentMethod === "cod"
                  const isOnline = order.paymentType === "Online" || paymentMethod === "razorpay" || paymentMethod === "online"
                  const canUpdatePayment = isCod && status === "picked_up"
                  
                  return (
                    <tr key={order.id || order._id || order.orderId} className="border-t border-[#F5F5F5]">
                      <td className="px-4 py-3 text-[#1E1E1E] font-medium">{order.orderId}</td>
                      <td className="px-4 py-3 text-[#1E1E1E]">
                        <div>{order.customerName || "Unknown"}</div>
                        <div className="text-xs text-[#1E1E1E]">{order.customerPhone || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-[#1E1E1E]">{order.cafe || "-"}</td>
                      <td className="px-4 py-3 text-[#1E1E1E]">₹{order.totalAmount || order.total || order.pricing?.total || "0"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFC400] text-[#1E1E1E]">
                          {order.orderStatus || statusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canUpdatePayment ? (
                          <select
                            value={order.paymentCollectionStatus || ""}
                            onChange={(e) => handlePaymentCollectionStatus(order, e.target.value)}
                            className="text-xs px-2 py-1 rounded-md border border-[#F5F5F5] text-[#1E1E1E] bg-white focus:border-[#e53935] focus:outline-none"
                          >
                            <option value="" disabled>Select Status</option>
                            <option
                              value="Collected"
                              disabled={order.paymentCollectionStatus === "Collected"}
                            >
                              Payment Collected
                            </option>
                            <option
                              value="Not Collected"
                              disabled={order.paymentCollectionStatus === "Not Collected" || order.paymentCollectionStatus === "Collected"}
                            >
                              Payment Not Collected
                            </option>
                          </select>
                        ) : (
                          <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-[#1E1E1E]'}`}>
                            {isOnline ? "Paid (Online)" : (order.paymentCollectionStatus || "Not Collected")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          {canAccept(order) && (
                            <button
                              type="button"
                              onClick={() => handleAccept(order)}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f]"
                            >
                              Accept Order
                            </button>
                          )}
                          
                          {canMarkPreparing(order) && (
                            <button
                              type="button"
                              onClick={() => handleMarkPreparing(order)}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f]"
                            >
                              Preparing
                            </button>
                          )}

                          {canMarkReady(order) && (
                            <button
                              type="button"
                              onClick={() => handleMarkReady(order)}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f]"
                            >
                              Ready for Pickup
                            </button>
                          )}

                          {canMarkPickedUp(order) && (
                            <button
                              type="button"
                              onClick={() => handleMarkPickedUp(order)}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f]"
                            >
                              Completed
                            </button>
                          )}

                          {status === "picked_up" && (
                            <span className="text-xs text-green-600 font-medium py-1.5">
                              Picked Up
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


