import { useState, useMemo } from "react"
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "./ordersExportUtils"

export function useOrdersManagement(orders, statusKey, title) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({
    paymentStatus: "",
    deliveryType: "",
    minAmount: "",
    maxAmount: "",
    fromDate: "",
    toDate: "",
    restaurant: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    restaurant: true,
    foodItems: true,
    totalAmount: true,
    paymentType: true,
    paymentCollectionStatus: true,
    orderStatus: true,
    actions: true,
  })

  // Get unique restaurants from orders
  const restaurants = useMemo(() => {
    return [...new Set(orders.map(o => o.restaurant))]
  }, [orders])

  // Apply search and filters
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    const normalizePaymentStatus = (value) => String(value || "").toLowerCase().trim()
    const getFilterablePaymentStatus = (order) => {
      const candidates = [
        order?.paymentStatus,
        order?.payment?.status,
        order?.paymentCollectionStatus,
      ].map(normalizePaymentStatus).filter(Boolean)

      for (const status of candidates) {
        if (status.includes("refund")) return "Refunded"
        if (status.includes("fail")) return "Failed"
        if (
          status === "paid" ||
          status === "collected" ||
          status === "success" ||
          status === "succeeded" ||
          status === "completed"
        ) {
          return "Paid"
        }
        if (
          status === "unpaid" ||
          status === "pending" ||
          status === "not collected" ||
          status === "not_collected" ||
          status === "due"
        ) {
          return "Unpaid"
        }
      }

      return ""
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(order => 
        order.orderId.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.restaurant.toLowerCase().includes(query) ||
        order.customerPhone.includes(query) ||
        order.totalAmount.toString().includes(query)
      )
    }

    // Apply filters
    if (filters.paymentStatus) {
      result = result.filter(order => getFilterablePaymentStatus(order) === filters.paymentStatus)
    }

    if (filters.deliveryType) {
      result = result.filter(order => order.deliveryType === filters.deliveryType)
    }

    if (filters.minAmount) {
      result = result.filter(order => order.totalAmount >= parseFloat(filters.minAmount))
    }

    if (filters.maxAmount) {
      result = result.filter(order => order.totalAmount <= parseFloat(filters.maxAmount))
    }

    if (filters.restaurant) {
      result = result.filter(order => order.restaurant === filters.restaurant)
    }

    // Helper function to parse date format "16 JUL 2025"
    const parseOrderDate = (dateStr) => {
      const months = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
      }
      const parts = dateStr.split(" ")
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0")
        const month = months[parts[1].toUpperCase()] || "01"
        const year = parts[2]
        return new Date(`${year}-${month}-${day}`)
      }
      return new Date(dateStr)
    }

    if (filters.fromDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const fromDate = new Date(filters.fromDate)
        return orderDate >= fromDate
      })
    }

    if (filters.toDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const toDate = new Date(filters.toDate)
        toDate.setHours(23, 59, 59, 999) // Include entire day
        return orderDate <= toDate
      })
    }

    return result
  }, [orders, searchQuery, filters])

  const count = filteredOrders.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "").length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      paymentStatus: "",
      deliveryType: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
      restaurant: "",
    })
  }

  const handleExport = (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "csv":
        exportToCSV(filteredOrders, filename)
        break
      case "excel":
        exportToExcel(filteredOrders, filename)
        break
      case "pdf":
        exportToPDF(filteredOrders, filename)
        break
      case "json":
        exportToJSON(filteredOrders, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const handlePrintOrder = async (order) => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const toNumber = (value) => {
        if (typeof value === "number" && Number.isFinite(value)) return value
        if (typeof value === "string") {
          const parsed = parseFloat(value.replace(/[^\d.-]/g, ""))
          return Number.isFinite(parsed) ? parsed : 0
        }
        return 0
      }

      const formatMoney = (value) => toNumber(value).toFixed(2)
      const valueOrNA = (value) => (value == null || value === "" ? "N/A" : String(value))

      const orderId = valueOrNA(order?.orderId || order?.id || order?._id || order?.subscriptionId)
      const customerName = valueOrNA(
        order?.customerName ||
        order?.customer?.name ||
        order?.user?.name ||
        order?.deliveryAddress?.name
      )
      const customerPhone = valueOrNA(
        order?.customerPhone ||
        order?.customer?.phone ||
        order?.user?.phone ||
        order?.deliveryAddress?.phone
      )
      const restaurantName = valueOrNA(
        order?.restaurant ||
        order?.restaurantName ||
        order?.restaurantDetails?.name ||
        order?.restaurant?.name
      )
      const deliveryType = valueOrNA(order?.deliveryType || order?.orderType)
      const paymentType = valueOrNA(order?.paymentType || order?.payment?.method || order?.paymentMethod)
      const paymentStatus = valueOrNA(order?.paymentStatus || order?.payment?.status || order?.paymentCollectionStatus)
      const orderStatus = valueOrNA(order?.orderStatus || order?.status)
      const cancellationReason = valueOrNA(order?.cancellationReason || order?.cancelReason || "")
      const createdAt = order?.createdAt ? new Date(order.createdAt) : null
      const orderDate = order?.date && order?.time
        ? `${order.date}, ${order.time}`
        : createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : valueOrNA(order?.date)

      const rawItems =
        (Array.isArray(order?.items) && order.items) ||
        (Array.isArray(order?.orderItems) && order.orderItems) ||
        (Array.isArray(order?.cartItems) && order.cartItems) ||
        (Array.isArray(order?.menuItems) && order.menuItems) ||
        []

      const normalizedItems = rawItems.map((item) => {
        const qty = toNumber(item?.quantity || item?.qty || item?.count || 1) || 1
        const unitPrice = toNumber(item?.price || item?.unitPrice || item?.amount || item?.rate || 0)
        const lineTotal = toNumber(item?.totalPrice || item?.subtotal || item?.lineTotal || (qty * unitPrice))
        return {
          name: valueOrNA(item?.name || item?.itemName || item?.dishName || item?.title || item?.productName),
          qty,
          unitPrice,
          lineTotal,
        }
      })

      const totalAmount =
        toNumber(order?.totalAmount || order?.amount || order?.payment?.amount || order?.grandTotal) ||
        normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFillColor(229, 57, 53)
      doc.rect(0, 0, pageWidth, 30, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text("Order Invoice", 14, 15)
      doc.setFontSize(10)
      doc.text(`Order ID: ${orderId}`, 14, 23)
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageWidth - 14, 23, { align: "right" })

      let startY = 40

      doc.setFillColor(250, 250, 250)
      doc.roundedRect(14, startY, pageWidth - 28, 28, 2, 2, "F")
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(10)
      doc.text(`Customer: ${customerName}`, 18, startY + 8)
      doc.text(`Phone: ${customerPhone}`, 18, startY + 14)
      doc.text(`Restaurant: ${restaurantName}`, 18, startY + 20)
      doc.text(`Date: ${orderDate}`, pageWidth - 18, startY + 8, { align: "right" })
      doc.text(`Delivery: ${deliveryType}`, pageWidth - 18, startY + 14, { align: "right" })
      doc.text(`Status: ${orderStatus}`, pageWidth - 18, startY + 20, { align: "right" })

      startY += 36

      const itemRows = normalizedItems.length > 0
        ? normalizedItems.map((item) => [
          item.qty,
          item.name,
          `Rs. ${formatMoney(item.unitPrice)}`,
          `Rs. ${formatMoney(item.lineTotal)}`
        ])
        : [["-", "No items found", "-", "-"]]

      autoTable(doc, {
        startY,
        head: [["Qty", "Item Name", "Unit Price", "Line Total"]],
        body: itemRows,
        theme: "grid",
        headStyles: {
          fillColor: [229, 57, 53],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30],
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252],
        },
        styles: {
          lineColor: [230, 230, 230],
          lineWidth: 0.25,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 96 },
          2: { cellWidth: 34, halign: "right" },
          3: { cellWidth: 34, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      })

      startY = doc.lastAutoTable.finalY + 10

      doc.setFillColor(245, 245, 245)
      doc.roundedRect(14, startY, pageWidth - 28, 26, 2, 2, "F")
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(10)
      doc.text(`Payment Type: ${paymentType}`, 18, startY + 8)
      doc.text(`Payment Status: ${paymentStatus}`, 18, startY + 14)
      if (cancellationReason !== "N/A") {
        doc.text(`Reason: ${cancellationReason}`.slice(0, 90), 18, startY + 20)
      }
      doc.setFontSize(14)
      doc.setFont(undefined, "bold")
      doc.text(`Total: Rs. ${formatMoney(totalAmount)}`, pageWidth - 18, startY + 14, { align: "right" })
      doc.setFont(undefined, "normal")

      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text("Bun Burst - Admin Order Invoice", 14, pageHeight - 8)
      doc.text("Page 1 of 1", pageWidth - 14, pageHeight - 8, { align: "right" })

      const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(filename)
    } catch (error) {
      console.error("Error generating PDF invoice:", error)
      alert("Failed to download PDF invoice. Please try again.")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      restaurant: true,
      foodItems: true,
      totalAmount: true,
      paymentType: true,
      paymentCollectionStatus: true,
      orderStatus: true,
      actions: true,
    })
  }

  return {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredOrders,
    count,
    activeFiltersCount,
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  }
}


