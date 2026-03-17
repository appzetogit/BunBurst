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

  // Keep UI in sync with backend-enforced transitions:
  // confirmed/preparing -> ready_for_pickup -> picked_up
  const canMarkReady = (status) => ["confirmed", "preparing"].includes(status)
  const canMarkPickedUp = (status) => ["ready_for_pickup"].includes(status)

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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = order.status
                  const paymentMethod = order.payment?.method || order.paymentMethod
                  const isCod = order.paymentType === "Cash on Delivery" || paymentMethod === "cash" || paymentMethod === "cod"
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
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFC400] text-[#1E1E1E]">
                          {order.orderStatus || statusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleMarkReady(order)}
                            disabled={status === "picked_up" || !canMarkReady(status)}
                            className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Ready for Pickup
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkPickedUp(order)}
                            disabled={status === "picked_up" || !canMarkPickedUp(status)}
                            className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Picked Up
                          </button>
                        </div>
                        {canUpdatePayment && (
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => handlePaymentCollectionStatus(order, "Collected")}
                              disabled={order.paymentCollectionStatus === "Collected"}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Payment Completed
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaymentCollectionStatus(order, "Not Collected")}
                              disabled={order.paymentCollectionStatus === "Not Collected"}
                              className="px-3 py-1.5 text-xs rounded-md border border-[#e53935] text-white bg-[#e53935] hover:bg-[#d32f2f] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Payment Not Completed
                            </button>
                          </div>
                        )}
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


