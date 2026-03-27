import { useState, useEffect, useMemo } from "react"
import { Eye, Printer, Loader2 } from "lucide-react"

const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Pending": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Scheduled": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Accepted": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Processing": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Food On The Way": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Canceled": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Cancelled by Cafe": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Cancelled by User": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Payment Failed": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Refunded": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Dine In": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Offline Payments": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
  }
  return colors[orderStatus] || "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid") return "text-[#1E1E1E]"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-[#e53935]"
  return "text-[#1E1E1E]"
}

export default function OrdersTable({ orders, visibleColumns, onViewOrder, onPrintOrder, onRefund, onAcceptOrder, layoutVariant = "default" }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(orders.length / itemsPerPage)
  const isAllOrdersVariant = layoutVariant === "all-orders"
  const isCancelledVariant = layoutVariant === "cancelled-orders"
  const isRefundedVariant = layoutVariant === "refunded-orders"
  const isFeatureVariant = isAllOrdersVariant || isCancelledVariant || isRefundedVariant

  // Reset to page 1 when orders change
  useEffect(() => {
    setCurrentPage(1)
  }, [orders.length])

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.slice(start, end)
  }, [orders, currentPage])

  const formatCafeName = (name) => {
    if (name === "Cafe Monarch") return "Café Monarch"
    return name
  }

  const formatPrice = (value) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return "0.00"
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (orders.length === 0) {
    return (
      <div className={`${isFeatureVariant ? "rounded-[28px] border border-[#F5F5F5] bg-white shadow-[0_16px_34px_rgba(30,30,30,0.05)]" : "bg-white rounded-xl shadow-sm border border-[#F5F5F5]"}`}>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-[#FFF8E1] to-[#F5F5F5] rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-5xl text-[#e53935] font-bold">!</span>
            </div>
          </div>
          <p className="text-lg font-semibold text-[#1E1E1E] mb-1">No Data Found</p>
          <p className="text-sm text-[#1E1E1E]">There are no orders matching your criteria</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isFeatureVariant ? "overflow-hidden rounded-[28px] border border-[#F5F5F5] bg-white shadow-[0_18px_38px_rgba(30,30,30,0.05)]" : "bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden w-full max-w-full"}`}>
      <div className="overflow-x-auto">
        <table className={`w-full ${isFeatureVariant ? "min-w-[1420px] table-fixed" : "min-w-full"}`}>
          <thead className={`${isAllOrdersVariant ? "bg-[#fcfcfc] border-b border-[#F5F5F5]" : isCancelledVariant ? "bg-[#fff8f8] border-b border-[#F5F5F5]" : isRefundedVariant ? "bg-[#f6fbff] border-b border-[#F5F5F5]" : "bg-[#F5F5F5] border-b border-[#F5F5F5]"}`}>
            <tr>
              {visibleColumns.si && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[72px] px-5 py-4" : "px-6 py-4"}`}>SI</th>
              )}
              {visibleColumns.orderId && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[250px] px-5 py-4" : "px-6 py-4"}`}>Order ID</th>
              )}
              {visibleColumns.orderDate && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[210px] px-5 py-4" : "px-6 py-4"}`}>Order Date</th>
              )}
              {visibleColumns.customer && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[170px] px-5 py-4" : "px-6 py-4"}`}>Customer Information</th>
              )}
              {visibleColumns.cafe && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[135px] px-5 py-4" : "px-6 py-4"}`}>Cafe</th>
              )}
              {visibleColumns.foodItems && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[320px] px-5 py-4" : "min-w-[200px] px-6 py-4"}`}>Food Items</th>
              )}
              {visibleColumns.totalAmount && (
                <th className={`text-right text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[130px] px-5 py-4" : "px-6 py-4"}`}>Total Amount</th>
              )}
              {(visibleColumns.paymentType !== false) && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[160px] px-5 py-4" : "px-6 py-4"}`}>Payment Type</th>
              )}
              {(visibleColumns.paymentCollectionStatus !== false) && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[145px] px-5 py-4" : "px-6 py-4"}`}>Payment Status</th>
              )}
              {visibleColumns.orderStatus && (
                <th className={`text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[220px] px-5 py-4" : "px-6 py-4"}`}>Order Status</th>
              )}
              {visibleColumns.actions && (
                <th className={`text-center text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider ${isFeatureVariant ? "w-[170px] px-5 py-4" : "px-6 py-4"}`}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#F5F5F5]">
            {paginatedOrders.map((order, index) => (
              <tr
                key={order.orderId}
                className={`transition-colors ${isAllOrdersVariant ? "align-top hover:bg-[#fffdf8]" : isCancelledVariant ? "align-top hover:bg-[#fff9f9]" : isRefundedVariant ? "align-top hover:bg-[#f9fcff]" : "hover:bg-[#F5F5F5]"}`}
              >
                {visibleColumns.si && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 whitespace-nowrap align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    <span className="text-sm font-medium text-[#1E1E1E]">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                  </td>
                )}
                {visibleColumns.orderId && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    <div className="space-y-1">
                      <span className="block text-sm font-semibold text-[#1E1E1E]">{order.orderId}</span>
                      {isFeatureVariant && (
                        <span className="block text-xs text-[#1E1E1E]/60">Order reference</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.orderDate && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    <div className="space-y-1">
                      <span className="block text-sm font-medium text-[#1E1E1E]">{order.date}</span>
                      <span className="block text-xs text-[#1E1E1E]/70">{order.time}</span>
                    </div>
                  </td>
                )}
                {visibleColumns.customer && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4"}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#1E1E1E]">{order.customerName}</span>
                      <span className="text-xs text-[#1E1E1E]/70 mt-1">{order.customerPhone}</span>
                    </div>
                  </td>
                )}
                {visibleColumns.cafe && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 whitespace-nowrap align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    <span className="text-sm font-medium text-[#1E1E1E]">{formatCafeName(order.cafe)}</span>
                  </td>
                )}
                {visibleColumns.foodItems && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4"}`}>
                    <div className={`flex flex-col gap-2 ${isFeatureVariant ? "min-w-[280px]" : "min-w-[200px] max-w-md"}`}>
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div key={idx || item.itemId || idx} className={`flex gap-2 text-sm ${isAllOrdersVariant ? "items-start rounded-xl border border-[#F5F5F5] bg-[#fcfcfc] px-3 py-2.5" : isCancelledVariant ? "items-start rounded-xl border border-[#F5F5F5] bg-[#fffafa] px-3 py-2.5" : isRefundedVariant ? "items-start rounded-xl border border-[#F5F5F5] bg-[#f8fcff] px-3 py-2.5" : "items-center"}`}>
                            <span className={`font-bold text-[#1E1E1E] min-w-[2.5rem] text-center ${isAllOrdersVariant ? "rounded-lg bg-[#FFF8E1] px-2 py-1" : isCancelledVariant ? "rounded-lg bg-[#fff1f1] px-2 py-1" : isRefundedVariant ? "rounded-lg bg-[#eaf6ff] px-2 py-1" : "bg-[#F5F5F5] px-2 py-0.5 rounded"}`}>
                              {item.quantity || 1}x
                            </span>
                            <span className="text-[#1E1E1E] font-medium flex-1">
                              {item.name || 'Unknown Item'}
                            </span>
                            {(item.price !== undefined && item.price !== null) && (
                              <span className="text-xs text-[#1E1E1E]/80 whitespace-nowrap">
                                ₹{formatPrice(item.price)}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-[#1E1E1E] italic">No items found</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.totalAmount && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 whitespace-nowrap text-right align-top" : "px-6 py-4 whitespace-nowrap text-right"}`}>
                    <div className={`text-sm text-[#1E1E1E] ${isFeatureVariant ? "font-semibold" : "font-medium"}`}>
                      ₹{order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                )}
                {(visibleColumns.paymentType !== false) && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    {(() => {
                      // Determine payment type display
                      let paymentTypeDisplay = order.paymentType;

                      if (!paymentTypeDisplay) {
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        if (paymentMethod === 'cash' || paymentMethod === 'cod') {
                          paymentTypeDisplay = 'Cash on Delivery';
                        } else if (paymentMethod === 'wallet') {
                          paymentTypeDisplay = 'Wallet';
                        } else {
                          paymentTypeDisplay = 'Online';
                        }
                      }

                      // Override if payment method is wallet but paymentType is not set correctly
                      const paymentMethod = order.payment?.method || order.paymentMethod;
                      if (paymentMethod === 'wallet' && paymentTypeDisplay !== 'Wallet') {
                        paymentTypeDisplay = 'Wallet';
                      }

                      return (
                        <span className={`text-sm font-medium text-[#1E1E1E] ${isAllOrdersVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-[#fcfcfc] px-3 py-1.5" : isCancelledVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-[#fffafa] px-3 py-1.5" : isRefundedVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-[#f8fcff] px-3 py-1.5" : ""}`}>
                          {paymentTypeDisplay}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {(visibleColumns.paymentCollectionStatus !== false) && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    {(() => {
                      const isCod = order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      const isDelivered = order.orderStatus === 'Delivered' || order.status === 'delivered'
                      const normalizedPaymentStatus = String(order.payment?.status || order.paymentStatus || '').toLowerCase()
                      const isPaidOnline = ['completed', 'paid', 'success', 'succeeded', 'refunded'].includes(normalizedPaymentStatus)
                      const status = isDelivered
                        ? 'Collected'
                        : (order.paymentCollectionStatus ?? (isCod ? 'Not Collected' : (isPaidOnline ? 'Collected' : 'Not Collected')))
                      return (
                        <span className={`text-sm font-medium text-[#1E1E1E] ${isAllOrdersVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-white px-3 py-1.5" : isCancelledVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-[#fffafa] px-3 py-1.5" : isRefundedVariant ? "inline-flex rounded-full border border-[#F5F5F5] bg-[#f8fcff] px-3 py-1.5" : ""}`}>
                          {status}
                        </span>
                      )
                    })()}
                  </td>
                )}
                {visibleColumns.orderStatus && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 align-top" : "px-6 py-4 whitespace-nowrap"}`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus || order.status}
                        </span>
                        <span className="text-xs text-[#1E1E1E]">{order.deliveryType}</span>
                      </div>
                      {String(order.orderStatus || "").toLowerCase() === "pending" && (
                        <div className="mt-1">
                          <select
                            value="Pending"
                            onChange={(e) => {
                              if (e.target.value === "Accepted") {
                                onAcceptOrder && onAcceptOrder(order)
                              }
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-[#F5F5F5] text-[#1E1E1E] bg-white"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Accepted">Accept</option>
                          </select>
                        </div>
                      )}
                      {order.cancellationReason && (
                        <div className={`mt-2 text-xs ${isCancelledVariant ? "rounded-xl border border-[#ffe0df] bg-[#fff5f5] px-3 py-2 text-[#b3261e]" : "text-red-600"}`}>
                          <span className="font-medium">
                            {order.cancelledBy === 'user' ? 'Cancelled by User - ' :
                             order.cancelledBy === 'cafe' ? 'Cancelled by Cafe - ' :
                             'Reason: '}
                          </span>
                          {order.cancellationReason}
                        </div>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className={`${isFeatureVariant ? "px-5 py-5 whitespace-nowrap text-center align-top" : "px-6 py-4 whitespace-nowrap text-center"}`}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onViewOrder(order)}
                        className="p-1.5 rounded text-[#e53935] hover:bg-[#fff1f1] transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onPrintOrder(order)}
                        className="p-1.5 rounded text-[#e53935] hover:bg-[#fff1f1] transition-colors"
                        title="Print Order"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {/* Show Refund button or Refunded status for cancelled orders with Online/Wallet payment (cafe or user cancelled) */}
                      {(() => {
                        // Check if order is cancelled by cafe or user
                        const isCancelled = order.orderStatus === "Cancelled by Cafe" ||
                                          order.orderStatus === "Cancelled" ||
                                          order.orderStatus === "Cancelled by User" ||
                                          (order.status === "cancelled" && (order.cancelledBy === "user" || order.cancelledBy === "cafe"));

                        // Check if payment type is Online or Wallet (not Cash on Delivery)
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        const isOnlinePayment = order.paymentType === "Online" ||
                                              (order.paymentType !== "Cash on Delivery" &&
                                               order.payment?.method !== "cash" &&
                                               order.payment?.method !== "cod" &&
                                               (order.paymentMethod === "razorpay" ||
                                                order.paymentMethod === "online" ||
                                                order.payment?.paymentMethod === "razorpay" ||
                                                order.payment?.method === "razorpay" ||
                                                order.payment?.method === "online"));

                        const isWalletPayment = order.paymentType === "Wallet" || paymentMethod === "wallet";

                        // Refund should be possible only if customer actually paid.
                        // Online: require payment status to be completed/paid/success/refunded OR paymentCollectionStatus=Collected.
                        // Wallet: require payment status to be completed/paid/success/refunded (wallet is prepaid).
                        const normalizedPaymentStatus = String(order.payment?.status || order.paymentStatus || "").toLowerCase();
                        const isPaidLikeStatus = ['completed', 'paid', 'success', 'succeeded', 'refunded'].includes(normalizedPaymentStatus);
                        const isCollected = String(order.paymentCollectionStatus || "").toLowerCase() === "collected";

                        const isOnlineRefundEligible = isOnlinePayment && (isPaidLikeStatus || isCollected);
                        const isWalletRefundEligible = isWalletPayment && isPaidLikeStatus;

                        return isCancelled && (isOnlineRefundEligible || isWalletRefundEligible);
                      })() && (
                        <>
                          {['processed', 'initiated'].includes(String(order.refundStatus || '').toLowerCase()) ? (
                            <span className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                              order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                ? "bg-[#FFF8E1] text-[#1E1E1E]"
                                : "bg-[#FFF8E1] text-[#1E1E1E]"
                            }`}>
                              {(() => {
                                const refundStatus = String(order.refundStatus || '').toLowerCase()
                                const isInitiated = refundStatus === 'initiated'
                                const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet"

                                if (isInitiated) {
                                  return isWalletPayment ? "Wallet Refund Initiated" : "Refund Initiated"
                                }

                                return isWalletPayment ? "Wallet Refunded" : "Refunded"
                              })()}
                            </span>
                          ) : onRefund ? (
                            <button
                              onClick={() => onRefund(order)}
                              className={`px-3 py-1.5 rounded-md text-white text-xs font-medium hover:opacity-90 transition-colors shadow-sm flex items-center gap-1.5 ${
                                order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "bg-[#e53935] hover:bg-[#d32f2f]"
                                  : "bg-[#e53935] hover:bg-[#d32f2f]"
                              }`}
                              title={order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                ? "Process Wallet Refund (Add to user wallet)"
                                : "Process Refund via Razorpay"}
                            >
                              <span className="text-sm">₹</span>
                              <span>Refund</span>
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between border-t border-[#F5F5F5] ${isAllOrdersVariant ? "bg-white px-6 py-5" : isCancelledVariant ? "bg-[#fffafa] px-6 py-5" : isRefundedVariant ? "bg-[#f8fcff] px-6 py-5" : "bg-[#F5F5F5] px-6 py-4"}`}>
          <div className="text-sm text-[#1E1E1E]">
            Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-semibold">{Math.min(currentPage * itemsPerPage, orders.length)}</span> of{" "}
            <span className="font-semibold">{orders.length}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      currentPage === pageNum
                        ? "bg-[#e53935] text-white shadow-md"
                        : "border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
