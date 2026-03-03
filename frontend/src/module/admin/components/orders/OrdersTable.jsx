import { useState, useEffect, useMemo } from "react"
import { Eye, Printer, ArrowUpDown, Loader2 } from "lucide-react"

const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Pending": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Scheduled": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Accepted": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Processing": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Food On The Way": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Canceled": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
    "Cancelled by Restaurant": "bg-[#FFF8E1] text-[#1E1E1E] border border-[#FFC400]",
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

export default function OrdersTable({ orders, visibleColumns, onViewOrder, onPrintOrder, onRefund }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(orders.length / itemsPerPage)
  
  // Reset to page 1 when orders change
  useEffect(() => {
    setCurrentPage(1)
  }, [orders.length])
  
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.slice(start, end)
  }, [orders, currentPage])

  const formatRestaurantName = (name) => {
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
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5]">
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
    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden w-full max-w-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-[#F5F5F5] border-b border-[#F5F5F5]">
            <tr>
              {visibleColumns.si && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>SI</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.orderId && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.orderDate && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Date</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.customer && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Customer Information</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.restaurant && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Restaurant</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.foodItems && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span>Food Items</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.totalAmount && (
                <th className="px-6 py-4 text-right text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <span>Total Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentType !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Type</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentCollectionStatus !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Status</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.orderStatus && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Status</span>
                    <ArrowUpDown className="w-3 h-3 text-[#1E1E1E] cursor-pointer hover:text-[#1E1E1E]" />
                  </div>
                </th>
              )}
              {visibleColumns.actions && (
                <th className="px-6 py-4 text-center text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#F5F5F5]">
            {paginatedOrders.map((order, index) => (
              <tr 
                key={order.orderId} 
                className="hover:bg-[#F5F5F5] transition-colors"
              >
                {visibleColumns.si && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[#1E1E1E]">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                  </td>
                )}
                {visibleColumns.orderId && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[#1E1E1E]">{order.orderId}</span>
                  </td>
                )}
                {visibleColumns.orderDate && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[#1E1E1E]">{order.date}, {order.time}</span>
                  </td>
                )}
                {visibleColumns.customer && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#1E1E1E]">{order.customerName}</span>
                      <span className="text-xs text-[#1E1E1E] mt-0.5">{order.customerPhone}</span>
                    </div>
                  </td>
                )}
                {visibleColumns.restaurant && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[#1E1E1E]">{formatRestaurantName(order.restaurant)}</span>
                  </td>
                )}
                {visibleColumns.foodItems && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 min-w-[200px] max-w-md">
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div key={idx || item.itemId || idx} className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-[#1E1E1E] bg-[#F5F5F5] px-2 py-0.5 rounded min-w-[2.5rem] text-center">
                              {item.quantity || 1}x
                            </span>
                            <span className="text-[#1E1E1E] font-medium flex-1">
                              {item.name || 'Unknown Item'}
                            </span>
                            {(item.price !== undefined && item.price !== null) && (
                              <span className="text-xs text-[#1E1E1E]">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-[#1E1E1E]">
                      ₹{order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                )}
                {(visibleColumns.paymentType !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
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
                      
                      const isCod = paymentTypeDisplay === 'Cash on Delivery';
                      const isWallet = paymentTypeDisplay === 'Wallet';
                      
                      return (
                        <span className={`text-sm font-medium ${
                          isCod ? 'text-[#1E1E1E]' : 
                          isWallet ? 'text-[#1E1E1E]' : 
                          'text-[#1E1E1E]'
                        }`}>
                          {paymentTypeDisplay}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {(visibleColumns.paymentCollectionStatus !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const isCod = order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      const status = order.paymentCollectionStatus ?? (isCod ? 'Not Collected' : 'Collected')
                      return (
                        <span className={`text-sm font-medium ${status === 'Collected' ? 'text-[#1E1E1E]' : 'text-[#1E1E1E]'}`}>
                          {status}
                        </span>
                      )
                    })()}
                  </td>
                )}
                {visibleColumns.orderStatus && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                        <span className="text-xs text-[#1E1E1E]">{order.deliveryType}</span>
                      </div>
                      {order.cancellationReason && (
                        <div className="text-xs text-red-600 mt-1">
                          <span className="font-medium">
                            {order.cancelledBy === 'user' ? 'Cancelled by User - ' : 
                             order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant - ' : 
                             'Reason: '}
                          </span>
                          {order.cancellationReason}
                        </div>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
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
                      {/* Show Refund button or Refunded status for cancelled orders with Online/Wallet payment (restaurant or user cancelled) */}
                      {(() => {
                        // Check if order is cancelled by restaurant or user
                        const isCancelled = order.orderStatus === "Cancelled by Restaurant" || 
                                          order.orderStatus === "Cancelled" || 
                                          order.orderStatus === "Cancelled by User" ||
                                          (order.status === "cancelled" && (order.cancelledBy === "user" || order.cancelledBy === "restaurant"));
                        
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
                        
                        return isCancelled && (isOnlinePayment || isWalletPayment);
                      })() && (
                        <>
                          {order.refundStatus === 'processed' || order.refundStatus === 'initiated' ? (
                            <span className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                              order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                ? "bg-[#FFF8E1] text-[#1E1E1E]"
                                : "bg-[#FFF8E1] text-[#1E1E1E]"
                            }`}>
                              {order.paymentType === "Wallet" || order.payment?.method === "wallet" 
                                ? "Wallet Refunded" 
                                : "Refunded"}
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
        <div className="px-6 py-4 bg-[#F5F5F5] border-t border-[#F5F5F5] flex items-center justify-between">
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






