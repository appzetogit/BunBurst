import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, Settings, ArrowUpDown, Loader2, X, MapPin, Phone, Mail, Clock, Star, Building2, User, FileText, CreditCard, Calendar, Image as ImageIcon, ExternalLink, ShieldX, AlertTriangle, Trash2, Plus, Utensils, Edit } from "lucide-react"
import { adminAPI, cafeAPI } from "../../../../lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { exportCafesToPDF } from "../../components/cafes/cafesExportUtils"

// Import icons from Dashboard-icons
import locationIcon from "../../assets/Dashboard-icons/image1.png"
import cafeIcon from "../../assets/Dashboard-icons/image2.png"
import inactiveIcon from "../../assets/Dashboard-icons/image3.png"

export default function CafesList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [cafes, setCafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCafe, setSelectedCafe] = useState(null)
  const [cafeDetails, setCafeDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [banConfirmDialog, setBanConfirmDialog] = useState(null) // { cafe, action: 'ban' | 'unban' }
  const [banning, setBanning] = useState(false)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null) // { cafe }
  const [deleting, setDeleting] = useState(false)

  // Zone Management State
  const [zoneDialog, setZoneDialog] = useState(null) // { cafe }
  const [zones, setZones] = useState([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [updatingZone, setUpdatingZone] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    sl: true,
    cafeInfo: true,
    ownerInfo: true,
    zone: true,
    cuisine: true,
    status: true,
    action: true,
  })

  // Format Cafe ID to REST format (e.g., REST422829)
  const formatCafeId = (id) => {
    if (!id) return "REST000000"

    const idString = String(id)
    // Extract last 6 digits from the ID
    // Handle formats like "REST-1768045396242-2829" or "1768045396242-2829"
    const parts = idString.split(/[-.]/)
    let lastDigits = ""

    // Get the last part and extract digits
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      // Extract only digits from the last part
      const digits = lastPart.match(/\d+/g)
      if (digits && digits.length > 0) {
        // Get last 6 digits from all digits found
        const allDigits = digits.join("")
        lastDigits = allDigits.slice(-6).padStart(6, "0")
      } else {
        // If no digits in last part, look for digits in all parts
        const allParts = parts.join("")
        const allDigits = allParts.match(/\d+/g)
        if (allDigits && allDigits.length > 0) {
          const combinedDigits = allDigits.join("")
          lastDigits = combinedDigits.slice(-6).padStart(6, "0")
        }
      }
    }

    // If no digits found, use a hash of the ID
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }

    return `REST${lastDigits}`
  }

  // Fetch cafes from backend API
  useEffect(() => {
    const fetchCafes = async () => {
      try {
        setLoading(true)
        setError(null)

        let response
        let zonesResponse = null
        try {
          // Try admin API first
          const [cafesRes, zonesRes] = await Promise.all([
            adminAPI.getCafes(),
            adminAPI.getZones({ limit: 1000 }).catch(() => null),
          ])
          response = cafesRes
          zonesResponse = zonesRes
        } catch (adminErr) {
          // Fallback to regular cafe API if admin endpoint doesn't exist
          response = await cafeAPI.getCafes()
        }

        if (response.data && response.data.success && response.data.data) {
          // Map backend data to frontend format
          const cafesData = response.data.data.cafes || response.data.data || []
          const zonesData = zonesResponse?.data?.success
            ? (zonesResponse.data.data?.zones || [])
            : []
          const zoneNameById = new Map(
            zonesData.map((z) => [String(z._id || z.id), z.name || z.zoneName || "N/A"])
          )

          const mappedCafes = cafesData.map((cafe, index) => ({
            id: cafe._id || cafe.id || index + 1,
            _id: cafe._id, // Preserve original _id for API calls
            name: cafe.name || "N/A",
            ownerName: cafe.ownerName || "N/A",
            ownerPhone: cafe.ownerPhone || cafe.phone || "N/A",
            zoneId: cafe.location?.zoneId ? String(cafe.location.zoneId) : null,
            zone:
              (cafe.location?.zoneId
                ? zoneNameById.get(String(cafe.location.zoneId))
                : null) ||
              cafe.location?.area ||
              cafe.location?.city ||
              cafe.zone ||
              "N/A",
            cuisine: Array.isArray(cafe.cuisines) && cafe.cuisines.length > 0
              ? cafe.cuisines[0]
              : (cafe.cuisine || "N/A"),
            status: cafe.isActive !== false, // Default to true if not set
            rating: cafe.ratings?.average || cafe.rating || 0,
            logo: cafe.profileImage?.url || cafe.logo || "https://via.placeholder.com/40",
            // Preserve original cafe data for details modal
            originalData: cafe,
          }))

          setCafes(mappedCafes)
        } else {
          setCafes([])
        }
      } catch (err) {
        console.error("Error fetching cafes:", err)
        setError(err.message || "Failed to fetch cafes")
        setCafes([])
      } finally {
        setLoading(false)
      }
    }

    fetchCafes()
  }, [])
  const [filters, setFilters] = useState({
    all: "All",
    businessModel: "",
    cuisine: "",
    zone: "",
  })

  const filteredCafes = useMemo(() => {
    let result = [...cafes]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(cafe =>
        cafe.name.toLowerCase().includes(query) ||
        cafe.ownerName.toLowerCase().includes(query) ||
        cafe.ownerPhone.includes(query)
      )
    }

    if (filters.all !== "All") {
      if (filters.all === "Active") {
        result = result.filter(cafe => cafe.status === true)
      } else if (filters.all === "Inactive") {
        result = result.filter(cafe => cafe.status === false)
      }
    }

    if (filters.cuisine) {
      result = result.filter(cafe =>
        cafe.cuisine.toLowerCase().includes(filters.cuisine.toLowerCase())
      )
    }

    if (filters.zone) {
      result = result.filter(cafe => cafe.zone === filters.zone)
    }

    return result
  }, [cafes, searchQuery, filters])

  const handleToggleStatus = async (id) => {
    const cafe = cafes.find(r => r.id === id)
    if (!cafe) return
    const newStatus = !cafe.status

    try {
      // Optimistically update UI
      const updatedCafes = cafes.map(r =>
        r.id === id ? { ...r, status: newStatus } : r
      )
      setCafes(updatedCafes)

      // Call API
      await adminAPI.updateCafeStatus(cafe._id, newStatus)
    } catch (err) {
      console.error("Error updating cafe status:", err)
      // Revert on error
      const revertedCafes = cafes.map(r =>
        r.id === id ? { ...r, status: !newStatus } : r
      )
      setCafes(revertedCafes)
    }
  }

  const totalCafes = cafes.length
  const activeCafes = cafes.filter(r => r.status).length
  const inactiveCafes = cafes.filter(r => !r.status).length

  // Get unique cuisines from cafes for filter dropdown
  const uniqueCuisines = useMemo(() => {
    const cuisines = cafes
      .map(r => r.cuisine)
      .filter(c => c && c !== "N/A")
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort()
    return cuisines
  }, [cafes])

  // Show full phone number without masking
  const formatPhone = (phone) => {
    if (!phone) return ""
    return phone
  }

  const renderStars = (rating) => {
    return "★".repeat(rating) + "☆".repeat(5 - rating)
  }

  // Handle view cafe details
  const handleViewDetails = async (cafe) => {
    setSelectedCafe(cafe)
    setLoadingDetails(true)
    setCafeDetails(null)

    try {
      // First, use original data if available (has all details)
      if (cafe.originalData) {
        setCafeDetails(cafe.originalData)
        setLoadingDetails(false)
        return
      }

      // Try to fetch full cafe details from API
      // Use _id if available, otherwise use id or cafeId
      const cafeId = cafe._id || cafe.id || cafe.cafeId
      let response = null

      if (cafeId) {
        try {
          // Try admin API first if it exists
          if (adminAPI.getCafeById) {
            response = await adminAPI.getCafeById(cafeId)
          }
        } catch (err) {
          }

        // Fallback to regular cafe API
        if (!response || !response?.data?.success) {
          try {
            response = await cafeAPI.getCafeById(cafeId)
          } catch (err) {
            }
        }
      }

      // Check response structure
      if (response?.data?.success) {
        const data = response.data.data
        // Handle different response structures
        if (data?.cafe) {
          setCafeDetails(data.cafe)
        } else if (data) {
          setCafeDetails(data)
        } else {
          // Fallback to cafe data from list
          setCafeDetails(cafe)
        }
      } else {
        // Use the cafe data we already have
        setCafeDetails(cafe)
      }
    } catch (err) {
      console.error("Error fetching cafe details:", err)
      // Use the cafe data we already have
      setCafeDetails(cafe)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setSelectedCafe(null)
    setCafeDetails(null)
  }

  // Handle ban/unban cafe
  const handleBanCafe = (cafe) => {
    const isBanned = !cafe.status
    setBanConfirmDialog({
      cafe,
      action: isBanned ? 'unban' : 'ban'
    })
  }

  const confirmBanCafe = async () => {
    if (!banConfirmDialog) return

    const { cafe, action } = banConfirmDialog
    const isBanning = action === 'ban'
    const newStatus = !isBanning // false for ban, true for unban

    try {
      setBanning(true)
      const cafeId = cafe._id || cafe.id

      // Update cafe status via API
      try {
        await adminAPI.updateCafeStatus(cafeId, newStatus)

        // Update local state on success
        setCafes(prevCafes =>
          prevCafes.map(r =>
            r.id === cafe.id || r._id === cafe._id
              ? { ...r, status: newStatus }
              : r
          )
        )

        // Close dialog
        setBanConfirmDialog(null)

        // Show success message
        } catch (apiErr) {
        console.error("API Error:", apiErr)
        // If API fails, still update locally for better UX
        setCafes(prevCafes =>
          prevCafes.map(r =>
            r.id === cafe.id || r._id === cafe._id
              ? { ...r, status: newStatus }
              : r
          )
        )
        setBanConfirmDialog(null)
        alert(`Cafe ${isBanning ? 'banned' : 'unbanned'} locally. Please check backend connection.`)
      }

    } catch (err) {
      console.error("Error banning/unbanning cafe:", err)
      alert(`Failed to ${action} cafe. Please try again.`)
    } finally {
      setBanning(false)
    }
  }

  const cancelBanCafe = () => {
    setBanConfirmDialog(null)
  }

  // Handle delete cafe
  const handleDeleteCafe = (cafe) => {
    setDeleteConfirmDialog({ cafe })
  }

  const confirmDeleteCafe = async () => {
    if (!deleteConfirmDialog) return

    const { cafe } = deleteConfirmDialog

    try {
      setDeleting(true)
      const cafeId = cafe._id || cafe.id

      // Delete cafe via API
      try {
        await adminAPI.deleteCafe(cafeId)

        // Remove from local state on success
        setCafes(prevCafes =>
          prevCafes.filter(r =>
            r.id !== cafe.id && r._id !== cafe._id
          )
        )

        // Close dialog
        setDeleteConfirmDialog(null)

        // Show success message
        alert(`Cafe "${cafe.name}" deleted successfully!`)
      } catch (apiErr) {
        console.error("API Error:", apiErr)
        alert(apiErr.response?.data?.message || "Failed to delete cafe. Please try again.")
      }

    } catch (err) {
      console.error("Error deleting cafe:", err)
      alert("Failed to delete cafe. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteCafe = () => {
    setDeleteConfirmDialog(null)
  }

  // Zone Management Functions
  const fetchZones = async () => {
    try {
      setLoadingZones(true)
      const response = await adminAPI.getZones()
      if (response.data?.success && response.data.data?.zones) {
        setZones(response.data.data.zones)
      }
    } catch (error) {
      console.error("Error fetching zones:", error)
    } finally {
      setLoadingZones(false)
    }
  }

  const handleSetZone = (cafe) => {
    setZoneDialog({ cafe })
    if (zones.length === 0) {
      fetchZones()
    }
  }

  const confirmUpdateZone = async (zoneId) => {
    if (!zoneDialog) return
    const { cafe } = zoneDialog
    const nextZoneId = String(zoneId)

    try {
      setUpdatingZone(true)
      const cafeId = cafe._id || cafe.id

      await adminAPI.updateCafeZone(cafeId, nextZoneId)

      // Update local state
      const selectedZone = zones.find(z => String(z._id || z.id) === nextZoneId)
      setCafes(prev => prev.map(r =>
        (r.id === cafe.id || r._id === cafe._id)
          ? { ...r, zoneId: nextZoneId, zone: selectedZone?.name || "Unknown Zone" }
          : r
      ))

      setZoneDialog(null)
      // Optional: Show success toast/alert
      // alert("Cafe zone updated successfully!")
    } catch (error) {
      console.error("Error updating zone:", error)
      alert(error.response?.data?.message || "Failed to update cafe zone.")
    } finally {
      setUpdatingZone(false)
    }
  }

  // Handle export functionality
  const handleExport = () => {
    const dataToExport = filteredCafes.length > 0 ? filteredCafes : cafes
    const filename = "cafes_list"
    exportCafesToPDF(dataToExport, filename)
  }

  const onboardingStep3 =
    cafeDetails?.onboarding?.step3 ||
    cafeDetails?.onboarding?.step_3 ||
    cafeDetails?.onboarding?.stepThree ||
    cafeDetails?.onboarding?.documents ||
    cafeDetails?.onboarding?.registrationDocuments ||
    null

  const handleToggleColumn = (columnKey) => {
    setVisibleColumns((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length
      if (prev[columnKey] && enabledCount <= 1) return prev
      return { ...prev, [columnKey]: !prev[columnKey] }
    })
  }

  const tableVisibleColumnCount = Object.values(visibleColumns).filter(Boolean).length

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1E1E1E]">Cafes List</h1>
            </div>

          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Total Cafes */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total cafes</p>
                <p className="text-2xl font-bold text-[#1E1E1E]">{totalCafes}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <img src={locationIcon} alt="Location" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Active Cafes */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Active cafes</p>
                <p className="text-2xl font-bold text-[#1E1E1E]">{activeCafes}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <img src={cafeIcon} alt="Cafe" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Inactive Cafes */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Inactive cafes</p>
                <p className="text-2xl font-bold text-[#1E1E1E]">{inactiveCafes}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <img src={inactiveIcon} alt="Inactive" className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Cafes List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-[#1E1E1E]">Cafes List</h2>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/admin/cafes/add")}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add Cafe</span>
              </button>
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex: search by Cafe n"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#F5F5F5] bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:border-transparent shadow-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-slate-50 text-[#1E1E1E] flex items-center gap-2 transition-all shadow-sm">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport} className="cursor-pointer flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2.5 rounded-lg border border-[#F5F5F5] bg-white hover:bg-slate-50 text-[#1E1E1E] transition-all">
                    <Settings className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Table Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={visibleColumns.sl} onCheckedChange={() => handleToggleColumn("sl")}>
                    SL
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.cafeInfo} onCheckedChange={() => handleToggleColumn("cafeInfo")}>
                    Cafe Info
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.ownerInfo} onCheckedChange={() => handleToggleColumn("ownerInfo")}>
                    Owner Info
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.zone} onCheckedChange={() => handleToggleColumn("zone")}>
                    Zone
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.cuisine} onCheckedChange={() => handleToggleColumn("cuisine")}>
                    Cuisine
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.status} onCheckedChange={() => handleToggleColumn("status")}>
                    Status
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleColumns.action} onCheckedChange={() => handleToggleColumn("action")}>
                    Action
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#e53935]" />
                <span className="ml-3 text-slate-600">Loading cafes...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-lg font-semibold text-red-600 mb-1">Error Loading Data</p>
                <p className="text-sm text-slate-500">{error}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#FAFAFA] border-b border-[#F5F5F5]">
                  <tr>
                    {visibleColumns.sl && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>SL</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.cafeInfo && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Cafe Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.ownerInfo && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Owner Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.zone && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Zone</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.cuisine && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Cuisine</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.status && <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>}
                    {visibleColumns.action && <th className="px-6 py-4 text-center text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Action</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#F5F5F5]">
                  {filteredCafes.length === 0 ? (
                    <tr>
                      <td colSpan={tableVisibleColumnCount} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-lg font-semibold text-[#1E1E1E] mb-1">No Data Found</p>
                          <p className="text-sm text-slate-500">No cafes match your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCafes.map((cafe, index) => (
                      <tr
                        key={cafe.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        {visibleColumns.sl && <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-[#1E1E1E]">{index + 1}</span>
                        </td>}
                        {visibleColumns.cafeInfo && <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <img
                                src={cafe.logo}
                                alt={cafe.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/40"
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-[#1E1E1E]">{cafe.name}</span>
                              <span className="text-xs text-slate-500">ID #{formatCafeId(cafe.originalData?.cafeId || cafe.originalData?._id || cafe._id || cafe.id)}</span>
                              <span className="text-xs text-slate-500">{renderStars(cafe.rating)}</span>
                            </div>
                          </div>
                        </td>}
                        {visibleColumns.ownerInfo && <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[#1E1E1E]">{cafe.ownerName}</span>
                            <span className="text-xs text-slate-500">{formatPhone(cafe.ownerPhone)}</span>
                          </div>
                        </td>}
                        {visibleColumns.zone && <td className="px-6 py-4 whitespace-nowrap">
                          {/* <span className="text-sm text-[#1E1E1E]">{cafe.zone}</span> */}
                          <button
                            onClick={() => handleSetZone(cafe)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-purple-200 bg-white hover:bg-purple-50 transition-all group"
                          >
                            <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                            <span className="text-sm font-medium text-slate-700 group-hover:text-purple-700">
                              {cafe.zone && cafe.zone !== "N/A" ? cafe.zone : "Set Zone"}
                            </span>
                          </button>
                        </td>}
                        {visibleColumns.cuisine && <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#1E1E1E]">{cafe.cuisine}</span>
                        </td>}
                        {visibleColumns.status && <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(cafe.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:ring-offset-2 ${cafe.status ? "bg-[#e53935]" : "bg-slate-300"
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cafe.status ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                          </button>
                        </td>}
                        {visibleColumns.action && <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate("/admin/food/menu-add", { state: { cafeId: cafe._id || cafe.id } })}
                              className="p-1.5 rounded text-orange-600 hover:bg-orange-50 transition-colors"
                              title="Manage Menu"
                            >
                              <Utensils className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/cafes/edit/${cafe._id || cafe.id}`)}
                              className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Cafe"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewDetails(cafe)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBanCafe(cafe)}
                              className={`p-1.5 rounded transition-colors ${!cafe.status
                                ? "text-green-600 hover:bg-green-50"
                                : "text-red-600 hover:bg-red-50"
                                }`}
                              title={!cafe.status ? "Unban Cafe" : "Ban Cafe"}
                            >
                              <ShieldX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCafe(cafe)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Cafe"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Cafe Details Modal */}
      {selectedCafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/10 backdrop-blur-sm" onClick={closeDetailsModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-[#F5F5F5] px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#1E1E1E]">Cafe Details</h2>
              <button
                onClick={closeDetailsModal}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingDetails && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#e53935]" />
                  <span className="ml-3 text-slate-600">Loading details...</span>
                </div>
              )}
              {!loadingDetails && (cafeDetails || selectedCafe) && (
                <div className="space-y-6">
                  {/* Cafe Basic Info */}
                  <div className="flex items-start gap-6 pb-6 border-b border-[#F5F5F5]">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      <img
                        src={cafeDetails?.profileImage?.url || cafeDetails?.logo || selectedCafe?.logo || selectedCafe?.originalData?.profileImage?.url || "https://via.placeholder.com/96"}
                        alt={cafeDetails?.name || selectedCafe?.name || "Cafe"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/96"
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {cafeDetails?.name || selectedCafe?.name || "N/A"}
                      </h3>
                      <div className="flex items-center gap-4 flex-wrap">
                        {(cafeDetails?.ratings?.average || selectedCafe?.originalData?.ratings?.average) && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-[#FFC400] text-[#FFC400]" />
                            <span className="text-sm font-medium text-[#1E1E1E]">
                              {(cafeDetails?.ratings?.average || selectedCafe?.originalData?.ratings?.average || 0).toFixed(1)} ({(cafeDetails?.ratings?.count || selectedCafe?.originalData?.ratings?.count || 0)} reviews)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="w-4 h-4" />
                          <span className="text-sm">{formatCafeId(cafeDetails?.cafeId || cafeDetails?._id || selectedCafe?.id || selectedCafe?._id)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Owner Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Owner Name</p>
                            <p className="text-sm font-medium text-slate-900">
                              {cafeDetails?.ownerName || selectedCafe?.ownerName || selectedCafe?.originalData?.ownerName || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm font-medium text-slate-900">
                              {cafeDetails?.ownerPhone || cafeDetails?.phone || selectedCafe?.ownerPhone || selectedCafe?.originalData?.ownerPhone || selectedCafe?.originalData?.phone || "N/A"}
                            </p>
                          </div>
                        </div>
                        {cafeDetails?.ownerEmail && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Email</p>
                              <p className="text-sm font-medium text-slate-900">{cafeDetails.ownerEmail}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Contact */}
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Location & Contact</h4>
                      <div className="space-y-3">
                        {cafeDetails?.location && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-slate-500">Address</p>
                              <p className="text-sm font-medium text-slate-900">
                                {cafeDetails.location.addressLine1 || ""}
                                {cafeDetails.location.addressLine2 && `, ${cafeDetails.location.addressLine2}`}
                                {cafeDetails.location.area && `, ${cafeDetails.location.area}`}
                                {cafeDetails.location.city && `, ${cafeDetails.location.city}`}
                                {!cafeDetails.location.addressLine1 && !cafeDetails.location.area && !cafeDetails.location.city && selectedCafe.zone}
                              </p>
                            </div>
                          </div>
                        )}
                        {cafeDetails?.primaryContactNumber && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Primary Contact</p>
                              <p className="text-sm font-medium text-slate-900">{cafeDetails.primaryContactNumber}</p>
                            </div>
                          </div>
                        )}
                        {cafeDetails?.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Cafe Email</p>
                              <p className="text-sm font-medium text-slate-900">{cafeDetails.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cuisine & Timings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Cuisine & Details</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Cuisines</p>
                          <div className="flex flex-wrap gap-2">
                            {cafeDetails?.cuisines && Array.isArray(cafeDetails.cuisines) && cafeDetails.cuisines.length > 0 ? (
                              cafeDetails.cuisines.map((cuisine, idx) => (
                                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                  {cuisine}
                                </span>
                              ))
                            ) : (
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                {cafeDetails?.cuisine || selectedCafe.cuisine || "N/A"}
                              </span>
                            )}
                          </div>
                        </div>
                        {cafeDetails?.offer && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Current Offer</p>
                            <p className="text-sm font-medium text-green-600">{cafeDetails.offer}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Timings & Status</h4>
                      <div className="space-y-3">
                        {cafeDetails?.deliveryTimings && (
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Delivery Timings</p>
                              <p className="text-sm font-medium text-slate-900">
                                {cafeDetails.deliveryTimings.openingTime || "N/A"} - {cafeDetails.deliveryTimings.closingTime || "N/A"}
                              </p>
                            </div>
                          </div>
                        )}
                        {cafeDetails?.estimatedDeliveryTime && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time</p>
                            <p className="text-sm font-medium text-slate-900">{cafeDetails.estimatedDeliveryTime}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Status</p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${(cafeDetails?.isActive !== false) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                            {(cafeDetails?.isActive !== false) ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration Information */}
                  {(cafeDetails?.createdAt || cafeDetails?.updatedAt) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {cafeDetails.createdAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Registration Date & Time</p>
                              <p className="font-medium text-slate-900">
                                {new Date(cafeDetails.createdAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {cafeDetails.updatedAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Last Updated</p>
                              <p className="font-medium text-slate-900">
                                {new Date(cafeDetails.updatedAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {cafeDetails.cafeId && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Cafe ID</p>
                            <p className="font-medium text-slate-900">{formatCafeId(cafeDetails.cafeId)}</p>
                          </div>
                        )}
                        {(cafeDetails?.name || selectedCafe?.name) && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Current Name</p>
                            <p className="font-medium text-slate-900">{cafeDetails?.name || selectedCafe?.name}</p>
                          </div>
                        )}
                        {cafeDetails.phoneVerified !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                            <p className="font-medium text-slate-900">{cafeDetails.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {cafeDetails.signupMethod && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                            <p className="font-medium text-slate-900 capitalize">{cafeDetails.signupMethod}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 1 Details */}
                  {cafeDetails?.onboarding?.step1 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 1 Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {cafeDetails.onboarding.step1.cafeName && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Cafe Name (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step1.cafeName}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step1.ownerName && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Owner Name (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step1.ownerName}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step1.ownerEmail && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Owner Email (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step1.ownerEmail}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step1.ownerPhone && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Owner Phone (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step1.ownerPhone}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step1.primaryContactNumber && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Primary Contact (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step1.primaryContactNumber}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step1.location && (
                          <div className="md:col-span-2">
                            <p className="text-xs text-slate-500 mb-1">Location (at registration)</p>
                            <p className="font-medium text-slate-900">
                              {cafeDetails.onboarding.step1.location.addressLine1 || ""}
                              {cafeDetails.onboarding.step1.location.addressLine2 && `, ${cafeDetails.onboarding.step1.location.addressLine2}`}
                              {cafeDetails.onboarding.step1.location.area && `, ${cafeDetails.onboarding.step1.location.area}`}
                              {cafeDetails.onboarding.step1.location.city && `, ${cafeDetails.onboarding.step1.location.city}`}
                              {cafeDetails.onboarding.step1.location.landmark && `, ${cafeDetails.onboarding.step1.location.landmark}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 2 Details */}
                  {cafeDetails?.onboarding?.step2 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 2 Details</h4>
                      <div className="space-y-4">
                        {cafeDetails.onboarding.step2.cuisines && Array.isArray(cafeDetails.onboarding.step2.cuisines) && cafeDetails.onboarding.step2.cuisines.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-2">Cuisines (at registration)</p>
                            <div className="flex flex-wrap gap-2">
                              {cafeDetails.onboarding.step2.cuisines.map((cuisine, idx) => (
                                <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                  {cuisine}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {cafeDetails.onboarding.step2.deliveryTimings && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Opening Time (at registration)</p>
                              <p className="font-medium text-slate-900">{cafeDetails.onboarding.step2.deliveryTimings.openingTime || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Closing Time (at registration)</p>
                              <p className="font-medium text-slate-900">{cafeDetails.onboarding.step2.deliveryTimings.closingTime || "N/A"}</p>
                            </div>
                          </div>
                        )}
                        {cafeDetails.onboarding.step2.openDays && Array.isArray(cafeDetails.onboarding.step2.openDays) && cafeDetails.onboarding.step2.openDays.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-2">Open Days (at registration)</p>
                            <div className="flex flex-wrap gap-2">
                              {cafeDetails.onboarding.step2.openDays.map((day, idx) => (
                                <span key={idx} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium capitalize">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {cafeDetails.onboarding.step2.profileImageUrl?.url && (
                          <div>
                            <p className="text-xs text-slate-500 mb-2">Profile Image (at registration)</p>
                            <a
                              href={cafeDetails.onboarding.step2.profileImageUrl.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block"
                            >
                              <img
                                src={cafeDetails.onboarding.step2.profileImageUrl.url}
                                alt="Profile"
                                className="w-32 h-32 rounded-lg object-cover border border-slate-200 hover:border-blue-500 transition-colors"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/128"
                                }}
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Registration Documents - PAN, GST, FSSAI, Bank */}
                  {onboardingStep3 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 3 Details</h4>
                      <div className="space-y-6">
                        {/* PAN Details */}
                        {onboardingStep3.pan && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              PAN Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {onboardingStep3.pan.panNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.pan.panNumber}</p>
                                </div>
                              )}
                              {onboardingStep3.pan.nameOnPan && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Name on PAN</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.pan.nameOnPan}</p>
                                </div>
                              )}
                              {onboardingStep3.pan.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">PAN Document</p>
                                  <a
                                    href={onboardingStep3.pan.image.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View PAN Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* GST Details */}
                        {onboardingStep3.gst && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              GST Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Registered</p>
                                  <p className="font-medium text-slate-900">
                                  {onboardingStep3.gst.isRegistered ? "Yes" : "No"}
                                  </p>
                                </div>
                              {onboardingStep3.gst.gstNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Number</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.gst.gstNumber}</p>
                                </div>
                              )}
                              {onboardingStep3.gst.legalName && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Legal Name</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.gst.legalName}</p>
                                </div>
                              )}
                              {onboardingStep3.gst.address && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Address</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.gst.address}</p>
                                </div>
                              )}
                              {onboardingStep3.gst.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">GST Document</p>
                                  <a
                                    href={onboardingStep3.gst.image.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View GST Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* FSSAI Details */}
                        {onboardingStep3.fssai && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              FSSAI Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {onboardingStep3.fssai.registrationNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Registration Number</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.fssai.registrationNumber}</p>
                                </div>
                              )}
                              {onboardingStep3.fssai.expiryDate && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Expiry Date</p>
                                  <p className="font-medium text-slate-900">
                                    {new Date(onboardingStep3.fssai.expiryDate).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                              {onboardingStep3.fssai.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                  <a
                                    href={onboardingStep3.fssai.image.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View FSSAI Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bank Details */}
                        {onboardingStep3.bank && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Bank Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {onboardingStep3.bank.accountNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                  <p className="font-medium text-slate-900">
                                    {onboardingStep3.bank.accountNumber}
                                  </p>
                                </div>
                              )}
                              {onboardingStep3.bank.ifscCode && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.bank.ifscCode}</p>
                                </div>
                              )}
                              {onboardingStep3.bank.accountHolderName && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                  <p className="font-medium text-slate-900">{onboardingStep3.bank.accountHolderName}</p>
                                </div>
                              )}
                              {onboardingStep3.bank.accountType && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                  <p className="font-medium text-slate-900 capitalize">{onboardingStep3.bank.accountType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Onboarding Step 4 Details */}
                  {cafeDetails?.onboarding?.step4 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 4 Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {cafeDetails.onboarding.step4.estimatedDeliveryTime && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step4.estimatedDeliveryTime}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step4.distance && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Distance (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step4.distance}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step4.featuredDish && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Featured Dish (at registration)</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.step4.featuredDish}</p>
                          </div>
                        )}
                        {cafeDetails.onboarding.step4.offer && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Offer (at registration)</p>
                            <p className="font-medium text-green-600">{cafeDetails.onboarding.step4.offer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  {(cafeDetails?.slug || cafeDetails?.cafeId || cafeDetails?.phoneVerified !== undefined || cafeDetails?.signupMethod) && (
                    <div className="pt-6 border-t border-[#F5F5F5]">
                      <h4 className="text-lg font-semibold text-[#1E1E1E] mb-4">Additional Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {cafeDetails?.slug && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Slug</p>
                            <p className="font-medium text-slate-900">{cafeDetails.slug}</p>
                          </div>
                        )}
                        {cafeDetails?.cafeId && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Cafe ID</p>
                            <p className="font-medium text-slate-900">{formatCafeId(cafeDetails.cafeId)}</p>
                          </div>
                        )}
                        {cafeDetails?.phoneVerified !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                            <p className="font-medium text-slate-900">{cafeDetails.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {cafeDetails?.signupMethod && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                            <p className="font-medium text-slate-900 capitalize">{cafeDetails.signupMethod}</p>
                          </div>
                        )}
                        {cafeDetails?.onboarding?.completedSteps !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Onboarding Steps Completed</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.completedSteps} / 4</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!loadingDetails && !cafeDetails && !selectedCafe && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-[#1E1E1E] mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load cafe details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban Confirmation Dialog */}
      {banConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelBanCafe}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${banConfirmDialog.action === 'ban' ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                  <AlertTriangle className={`w-6 h-6 ${banConfirmDialog.action === 'ban' ? 'text-red-600' : 'text-green-600'
                    }`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1E1E1E]">
                    {banConfirmDialog.action === 'ban' ? 'Ban Cafe' : 'Unban Cafe'}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {banConfirmDialog.cafe.name}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-6">
                {banConfirmDialog.action === 'ban'
                  ? 'Are you sure you want to ban this cafe? They will not be able to receive orders or access their account.'
                  : 'Are you sure you want to unban this cafe? They will be able to receive orders and access their account again.'
                }
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelBanCafe}
                  disabled={banning}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-slate-50 text-[#1E1E1E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBanCafe}
                  disabled={banning}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${banConfirmDialog.action === 'ban'
                    ? 'bg-[#e53935] hover:bg-[#d32f2f]'
                    : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                  {banning ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {banConfirmDialog.action === 'ban' ? 'Banning...' : 'Unbanning...'}
                    </span>
                  ) : (
                    banConfirmDialog.action === 'ban' ? 'Ban Cafe' : 'Unban Cafe'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelDeleteCafe}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-[#e53935]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1E1E1E]">Delete Cafe</h3>
                  <p className="text-sm text-slate-600">
                    {deleteConfirmDialog.cafe.name}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-6">
                Are you sure you want to delete this cafe? This action cannot be undone and will permanently remove all cafe data, including orders, menu items, and settings.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelDeleteCafe}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-slate-50 text-[#1E1E1E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCafe}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#e53935] hover:bg-[#d32f2f] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete Cafe"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Zone Selection Dialog */}
      {zoneDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setZoneDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1E1E1E]">Set Cafe Zone</h3>
                  <p className="text-sm text-slate-600">{zoneDialog.cafe.name}</p>
                </div>
              </div>

              <div className="mb-6 max-h-[60vh] overflow-y-auto">
                <p className="text-sm font-medium text-slate-700 mb-2">Select a Zone:</p>
                {loadingZones ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : zones.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 mb-2">No zones available.</p>
                    <p className="text-xs text-slate-400">Create a zone in Zone Setup first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {zones.map(zone => (
                      <button
                        key={zone._id || zone.id}
                        onClick={() => confirmUpdateZone(zone._id || zone.id)}
                        disabled={updatingZone}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between group ${(
                          zoneDialog.cafe.zoneId === String(zone._id || zone.id) ||
                          zoneDialog.cafe.zone === zone.name
                        )
                          ? "border-green-200 bg-green-50"
                          : "border-[#F5F5F5] hover:bg-purple-50 hover:border-purple-200"
                          }`}
                      >
                        <div className="flex flex-col">
                          <span className={`font-medium ${(
                            zoneDialog.cafe.zoneId === String(zone._id || zone.id) ||
                            zoneDialog.cafe.zone === zone.name
                          ) ? "text-green-700" : "text-[#1E1E1E] group-hover:text-purple-700"
                            }`}>{zone.name}</span>
                          <span className="text-xs text-slate-500">{zone.serviceLocation || ""}</span>
                        </div>
                        {updatingZone && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
                        {(
                          zoneDialog.cafe.zoneId === String(zone._id || zone.id) ||
                          zoneDialog.cafe.zone === zone.name
                        ) && !updatingZone && (
                          <span className="text-xs font-bold text-green-600">Current</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setZoneDialog(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

