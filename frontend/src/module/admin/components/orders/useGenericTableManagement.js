import { useState, useMemo } from "react"
import { exportToExcel, exportToPDF } from "./ordersExportUtils"

export function useGenericTableManagement(data, title, searchFields = []) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({})

  // Apply search
  const filteredData = useMemo(() => {
    let result = [...data]

    const parseOrderDate = (dateStr) => {
      if (!dateStr) return null
      if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) return dateStr
      if (typeof dateStr === "string") {
        const months = {
          "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
          "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
        }
        const parts = dateStr.split(" ")
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0")
          const month = months[parts[1].toUpperCase()] || "01"
          const year = parts[2]
          const parsed = new Date(`${year}-${month}-${day}`)
          if (!Number.isNaN(parsed.getTime())) return parsed
        }
        const parsed = new Date(dateStr)
        return Number.isNaN(parsed.getTime()) ? null : parsed
      }
      return null
    }

    // Apply search query
    if (searchQuery.trim() && searchFields.length > 0) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(item => 
        searchFields.some(field => {
          const value = item[field]
          return value && value.toString().toLowerCase().includes(query)
        })
      )
    }

    // Special filters for orders pages
    if (filters.status) {
      const statusQuery = filters.status.toLowerCase()
      result = result.filter(item => String(item.status || "").toLowerCase() === statusQuery)
    }

    if (filters.cafe) {
      const cafeQuery = filters.cafe.toLowerCase().trim()
      result = result.filter(item => {
        const cafeValue = (item.cafeName || item.cafe || "").toString().toLowerCase()
        return cafeValue.includes(cafeQuery)
      })
    }

    if (filters.deliveryAssignment) {
      if (filters.deliveryAssignment === "assigned") {
        result = result.filter(item => Boolean(item.deliveryBoyName || item.deliveryBoyNumber))
      } else if (filters.deliveryAssignment === "unassigned") {
        result = result.filter(item => !item.deliveryBoyName && !item.deliveryBoyNumber)
      }
    }

    if (filters.fromDate || filters.toDate) {
      const fromDate = filters.fromDate ? new Date(filters.fromDate) : null
      const toDate = filters.toDate ? new Date(filters.toDate) : null
      if (toDate) {
        toDate.setHours(23, 59, 59, 999)
      }
      result = result.filter(item => {
        const rawDate = item.orderDate || item.date || item.createdAt
        const parsedDate = parseOrderDate(rawDate)
        if (!parsedDate) return false
        if (fromDate && parsedDate < fromDate) return false
        if (toDate && parsedDate > toDate) return false
        return true
      })
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (["status", "cafe", "deliveryAssignment", "fromDate", "toDate"].includes(key)) return
      if (value && value !== "") {
        result = result.filter(item => {
          const itemValue = item[key]
          if (typeof value === 'string') {
            return itemValue === value || itemValue?.toString().toLowerCase() === value.toLowerCase()
          }
          return itemValue === value
        })
      }
    })

    return result
  }, [data, searchQuery, filters, searchFields])

  const count = filteredData.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "" && value !== null && value !== undefined).length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  const handleExport = async (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "excel":
        exportToExcel(filteredData, filename)
        break
      case "pdf":
        await exportToPDF(filteredData, filename)
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

      const sourceOrder = order?.originalOrder || order || {}
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

      const orderId =
        valueOrNA(
          order?.orderId ||
          sourceOrder.orderId ||
          sourceOrder.id ||
          sourceOrder._id ||
          sourceOrder.subscriptionId
        )
      const createdAt = sourceOrder.createdAt || order?.createdAt || null
      const orderDate = createdAt
        ? new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : (order?.date || new Date().toLocaleDateString())
      const orderTime = createdAt
        ? new Date(createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : (order?.time || "")
      const orderDateTime = orderTime ? `${orderDate}, ${orderTime}` : orderDate

      const customerName =
        valueOrNA(
          sourceOrder.customerName ||
          sourceOrder.userId?.name ||
          order?.userName ||
          order?.customerName
        )
      const customerPhone =
        valueOrNA(
          sourceOrder.customerPhone ||
          sourceOrder.userId?.phone ||
          order?.userNumber ||
          order?.customerPhone
        )

      const cafeName =
        valueOrNA(
          sourceOrder.cafeName ||
          sourceOrder.cafe ||
          order?.cafeName ||
          order?.cafe
        )

      const deliveryName =
        valueOrNA(
          sourceOrder.deliveryPartnerName ||
          sourceOrder.deliveryPartnerId?.name ||
          order?.deliveryBoyName ||
          "Not assigned"
        )
      const deliveryPhone =
        valueOrNA(
          sourceOrder.deliveryPartnerPhone ||
          sourceOrder.deliveryPartnerId?.phone ||
          order?.deliveryBoyNumber
        )

      const address =
        sourceOrder.address?.formattedAddress ||
        [sourceOrder.address?.street, sourceOrder.address?.city, sourceOrder.address?.state, sourceOrder.address?.zipCode]
          .filter(Boolean)
          .join(", ")

      const pricing = sourceOrder.pricing || {}
      const subtotal = toNumber(pricing.subtotal ?? sourceOrder.subtotal)
      const deliveryFee = toNumber(pricing.deliveryFee ?? sourceOrder.deliveryFee)
      const platformFee = toNumber(pricing.platformFee ?? sourceOrder.platformFee)
      const tax = toNumber(pricing.tax ?? sourceOrder.tax)
      const discount = toNumber(pricing.discount ?? sourceOrder.discount)
      const totalAmount = toNumber(pricing.total ?? sourceOrder.totalAmount ?? sourceOrder.total)

      const paymentMethod = valueOrNA(sourceOrder.payment?.method || sourceOrder.paymentMethod)
      const paymentStatus = valueOrNA(sourceOrder.payment?.status || sourceOrder.paymentStatus)
      const orderStatus = valueOrNA(sourceOrder.status || order?.status)

      const rawItems =
        (Array.isArray(sourceOrder.items) && sourceOrder.items) ||
        (Array.isArray(sourceOrder.orderItems) && sourceOrder.orderItems) ||
        (Array.isArray(sourceOrder.cartItems) && sourceOrder.cartItems) ||
        (Array.isArray(sourceOrder.menuItems) && sourceOrder.menuItems) ||
        []

      const items = rawItems.map((item) => {
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
      const itemsTotal = items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0)
      const resolvedSubtotal = subtotal || itemsTotal

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const lineHeight = 5
      const leftMargin = 14
      const rightMargin = 14
      const contentWidth = pageWidth - leftMargin - rightMargin

      const drawSectionHeader = (title, y) => {
        doc.setFillColor(245, 247, 250)
        doc.roundedRect(leftMargin, y - 5, contentWidth, 8, 2, 2, "F")
        doc.setFontSize(11)
        doc.setTextColor(30, 30, 30)
        doc.text(title, leftMargin + 4, y)
      }

      // Header
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, pageWidth, 30, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.text("Order Invoice", leftMargin, 18)
      doc.setFontSize(9)
      doc.text(`Order ID: ${orderId}`, leftMargin, 25)
      doc.text(orderDateTime, pageWidth - rightMargin, 25, { align: "right" })

      let startY = 38

      drawSectionHeader("Customer & Order Details", startY)
      startY += 8

      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(`Customer: ${customerName}`, leftMargin + 4, startY)
      doc.text(`Phone: ${customerPhone}`, pageWidth - rightMargin - 60, startY)
      startY += lineHeight + 1
      doc.text(`Cafe: ${cafeName}`, leftMargin + 4, startY)
      doc.text(`Status: ${orderStatus}`, pageWidth - rightMargin - 60, startY)
      startY += lineHeight + 1
      doc.text(`Delivery Partner: ${deliveryName}`, leftMargin + 4, startY)
      doc.text(`Delivery Phone: ${deliveryPhone}`, pageWidth - rightMargin - 60, startY)
      startY += lineHeight + 1
      const addressValue = address ? address : "N/A"
      const addressLines = doc.splitTextToSize(`Address: ${addressValue}`, contentWidth - 8)
      doc.text(addressLines, leftMargin + 4, startY)
      startY += (addressLines.length * lineHeight) + 4

      // Order Items Table
      drawSectionHeader("Items", startY)
      startY += 4
      const tableData = items.length > 0
        ? items.map((item) => ([
          item.qty,
          item.name || "Unknown Item",
          `Rs. ${formatMoney(item.unitPrice)}`,
          `Rs. ${formatMoney(item.lineTotal)}`
        ]))
        : [["-", "No items found", "-", "-"]]

      autoTable(doc, {
        startY: startY + 4,
        head: [['Qty', 'Item Name', 'Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30]
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        styles: {
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 90 },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: leftMargin, right: rightMargin }
      })

      startY = doc.lastAutoTable.finalY + 10

      drawSectionHeader("Payment Summary", startY)
      startY += 8

      const addAmountRow = (label, value, isBold = false) => {
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        doc.setFont(undefined, isBold ? "bold" : "normal")
        doc.text(label, leftMargin + 4, startY)
        doc.text(`Rs. ${formatMoney(value)}`, pageWidth - rightMargin, startY, { align: "right" })
        startY += lineHeight + 1
      }

      const computedTotal = resolvedSubtotal - discount + deliveryFee + platformFee + tax
      addAmountRow("Subtotal", resolvedSubtotal)
      if (discount > 0) addAmountRow("Discount", -discount)
      if (deliveryFee > 0) addAmountRow("Delivery Fee", deliveryFee)
      if (platformFee > 0) addAmountRow("Platform Fee", platformFee)
      if (tax > 0) addAmountRow("Tax (GST)", tax)
      addAmountRow("Grand Total", totalAmount || computedTotal, true)
      startY += 1

      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.setFont(undefined, "normal")
      doc.text(`Payment: ${String(paymentMethod).toUpperCase()} (${paymentStatus})`, leftMargin + 4, startY)
      startY += lineHeight + 1
      if (pricing.couponCode) {
        doc.text(`Coupon: ${pricing.couponCode}`, leftMargin + 4, startY)
      }

      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text("Bun Burst - Admin Order Invoice", leftMargin, pageHeight - 8)
      doc.text("Page 1 of 1", pageWidth - rightMargin, pageHeight - 8, { align: "right" })

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

  const resetColumns = (defaultColumns) => {
    setVisibleColumns(defaultColumns || {})
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
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  }
}



