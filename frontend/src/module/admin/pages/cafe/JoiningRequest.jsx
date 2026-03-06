import { useState, useMemo, useEffect } from "react"
import { 
  Search, Filter, Eye, Check, X, UtensilsCrossed, ArrowUpDown, Loader2,
  FileText, Image as ImageIcon, ExternalLink, CreditCard, Calendar, Star, Building2, User, Phone, Mail, MapPin, Clock
} from "lucide-react"
import { adminAPI, cafeAPI } from "../../../../lib/api"

export default function JoiningRequest() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingRequests, setPendingRequests] = useState([])
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [cafeDetails, setCafeDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [filters, setFilters] = useState({
    zone: "",
    businessModel: "",
    dateFrom: "",
    dateTo: ""
  })

  // Fetch cafe join requests
  useEffect(() => {
    fetchRequests()
  }, [activeTab])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const status = activeTab === "pending" ? "pending" : "rejected"
      const response = await adminAPI.getCafeJoinRequests({
        status,
        search: searchQuery || undefined,
        page: 1,
        limit: 100
      })

      if (response.data && response.data.success && response.data.data) {
        const requests = response.data.data.requests || []
        if (activeTab === "pending") {
          setPendingRequests(requests)
        } else {
          setRejectedRequests(requests)
        }
      } else {
        if (activeTab === "pending") {
          setPendingRequests([])
        } else {
          setRejectedRequests([])
        }
      }
    } catch (err) {
      console.error("Error fetching cafe requests:", err)
      setError(err.message || "Failed to fetch cafe requests")
      if (activeTab === "pending") {
        setPendingRequests([])
      } else {
        setRejectedRequests([])
      }
    } finally {
      setLoading(false)
    }
  }

  const currentRequests = activeTab === "pending" ? pendingRequests : rejectedRequests

  // Get unique zones and business models for filter options
  const filterOptions = useMemo(() => {
    const zones = [...new Set(currentRequests.map(r => r.zone).filter(Boolean))]
    const businessModels = [...new Set(currentRequests.map(r => r.businessModel).filter(Boolean))]
    return { zones, businessModels }
  }, [currentRequests])

  const filteredRequests = useMemo(() => {
    let filtered = currentRequests

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(request =>
        request.cafeName?.toLowerCase().includes(query) ||
        request.ownerName?.toLowerCase().includes(query) ||
        request.ownerPhone?.includes(query)
      )
    }

    // Apply zone filter
    if (filters.zone) {
      filtered = filtered.filter(request => request.zone === filters.zone)
    }

    // Apply business model filter
    if (filters.businessModel) {
      filtered = filtered.filter(request => request.businessModel === filters.businessModel)
    }

    // Apply date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(request => {
        if (!request.createdAt) return false
        const requestDate = new Date(request.createdAt).setHours(0, 0, 0, 0)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0)
          if (requestDate < fromDate) return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo).setHours(23, 59, 59, 999)
          if (requestDate > toDate) return false
        }
        return true
      })
    }

    return filtered
  }, [currentRequests, searchQuery, filters])

  const clearFilters = () => {
    setFilters({
      zone: "",
      businessModel: "",
      dateFrom: "",
      dateTo: ""
    })
  }

  const hasActiveFilters = filters.zone || filters.businessModel || filters.dateFrom || filters.dateTo

  const handleApprove = async (request) => {
    if (window.confirm(`Are you sure you want to approve "${request.cafeName}" cafe request?`)) {
      try {
        setProcessing(true)
        await adminAPI.approveCafe(request._id)
        
        // Refresh the list
        await fetchRequests()
        
        alert(`Successfully approved ${request.cafeName}'s join request!`)
      } catch (err) {
        console.error("Error approving request:", err)
        alert(err.response?.data?.message || "Failed to approve request. Please try again.")
      } finally {
        setProcessing(false)
      }
    }
  }

  const handleReject = (request) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setShowRejectDialog(true)
  }

  const confirmReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectCafe(selectedRequest._id, rejectionReason)
      
      // Refresh the list
      await fetchRequests()
      
      setShowRejectDialog(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      alert(`Successfully rejected ${selectedRequest.cafeName}'s join request!`)
    } catch (err) {
      console.error("Error rejecting request:", err)
      alert(err.response?.data?.message || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const formatPhone = (phone) => {
    if (!phone) return "N/A"
    return phone
  }

  // Handle view cafe details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
    setLoadingDetails(true)
    setCafeDetails(null)
    
    try {
      // First, use fullData if available (has all details from API)
      if (request.fullData) {
        setCafeDetails(request.fullData)
        setLoadingDetails(false)
        return
      }
      
      // Try to fetch full cafe details from API
      const cafeId = request._id || request.id
      let response = null
      
      if (cafeId) {
        try {
          // Try admin API first
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
        if (data?.cafe) {
          setCafeDetails(data.cafe)
        } else if (data) {
          setCafeDetails(data)
        } else {
          setCafeDetails(request)
        }
      } else {
        // Use the request data we already have
        setCafeDetails(request)
      }
    } catch (err) {
      console.error("Error fetching cafe details:", err)
      // Use the request data we already have
      setCafeDetails(request)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRequest(null)
    setCafeDetails(null)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">New Cafe Join Request</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending Requests
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rejected"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Rejected Request
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex: Search by cafe na"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilterDialog(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
                  hasActiveFilters 
                    ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100" 
                    : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {[filters.zone, filters.businessModel, filters.dateFrom, filters.dateTo].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>SL</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Cafe Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Owner Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Zone</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Business Model</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-slate-700">Loading cafe requests...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <p className="text-lg font-semibold text-red-600 mb-1">Error: {error}</p>
                      <p className="text-sm text-slate-500">Failed to load cafe requests. Please try again.</p>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No cafe requests match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => (
                    <tr key={request.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{request.sl}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <img
                              src={request.cafeImage}
                              alt={request.cafeName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://via.placeholder.com/40"
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900">{request.cafeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">{request.ownerName}</span>
                          <span className="text-xs text-slate-500">{formatPhone(request.ownerPhone)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.zone}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.businessModel}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.status === "Pending"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(request)}
                            className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {activeTab === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      {showFilterDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Filter className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filter Requests</h3>
                    <p className="text-xs text-slate-500">Apply filters to refine your search</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Zone Filter */}
                {filterOptions.zones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Zone
                    </label>
                    <select
                      value={filters.zone}
                      onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Zones</option>
                      {filterOptions.zones.map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Business Model Filter */}
                {filterOptions.businessModels.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Business Model
                    </label>
                    <select
                      value={filters.businessModel}
                      onChange={(e) => setFilters({ ...filters, businessModel: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Business Models</option>
                      {filterOptions.businessModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date Range Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      min={filters.dateFrom}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject Cafe Request</h3>
                  <p className="text-sm text-slate-600">{selectedRequest.cafeName}</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to reject this cafe request? Please provide a reason for rejection.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowRejectDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </span>
                  ) : (
                    "Reject Request"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cafe Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={closeDetailsModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-slate-900">Cafe Details - {selectedRequest.cafeName || "N/A"}</h2>
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
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-slate-600">Loading details...</span>
                </div>
              )}
              {!loadingDetails && (cafeDetails || selectedRequest) && (
                <div className="space-y-6">
                  {/* Cafe Basic Info */}
                  <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      <img
                        src={cafeDetails?.profileImage?.url || cafeDetails?.profileImageUrl?.url || selectedRequest?.cafeImage || "https://via.placeholder.com/96"}
                        alt={cafeDetails?.name || selectedRequest?.cafeName || "Cafe"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/96"
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {cafeDetails?.name || selectedRequest?.cafeName || "N/A"}
                      </h3>
                      <div className="flex items-center gap-4 flex-wrap">
                        {cafeDetails?.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium text-slate-700">
                              {cafeDetails.rating.toFixed(1)} ({cafeDetails.totalRatings || 0} reviews)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="w-4 h-4" />
                          <span className="text-sm">{cafeDetails?.cafeId || cafeDetails?._id || selectedRequest?._id || "N/A"}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          cafeDetails?.isActive !== false ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {cafeDetails?.isActive !== false ? "Active" : "Pending Approval"}
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
                              {cafeDetails?.ownerName || selectedRequest?.ownerName || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm font-medium text-slate-900">
                              {cafeDetails?.ownerPhone || cafeDetails?.phone || selectedRequest?.ownerPhone || "N/A"}
                            </p>
                          </div>
                        </div>
                        {(cafeDetails?.ownerEmail || cafeDetails?.email) && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Email</p>
                              <p className="text-sm font-medium text-slate-900">{cafeDetails.ownerEmail || cafeDetails.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Contact */}
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Location & Contact</h4>
                      <div className="space-y-3">
                        {(cafeDetails?.location || cafeDetails?.onboarding?.step1?.location) && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-slate-500">Address</p>
                              <p className="text-sm font-medium text-slate-900">
                                {cafeDetails.location?.addressLine1 || cafeDetails.onboarding?.step1?.location?.addressLine1 || ""}
                                {cafeDetails.location?.addressLine2 && `, ${cafeDetails.location.addressLine2}`}
                                {cafeDetails.location?.area && `, ${cafeDetails.location.area}`}
                                {cafeDetails.location?.city && `, ${cafeDetails.location.city}`}
                                {cafeDetails.onboarding?.step1?.location?.area && `, ${cafeDetails.onboarding.step1.location.area}`}
                                {cafeDetails.onboarding?.step1?.location?.city && `, ${cafeDetails.onboarding.step1.location.city}`}
                                {selectedRequest?.zone && !cafeDetails?.location && !cafeDetails?.onboarding?.step1?.location && selectedRequest.zone}
                              </p>
                            </div>
                          </div>
                        )}
                        {(cafeDetails?.primaryContactNumber || cafeDetails?.phone) && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Primary Contact</p>
                              <p className="text-sm font-medium text-slate-900">{cafeDetails.primaryContactNumber || cafeDetails.phone}</p>
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
                              <span className="text-sm text-slate-700">N/A</span>
                            )}
                          </div>
                        </div>
                        {cafeDetails?.offer && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Current Offer</p>
                            <p className="text-sm font-medium text-green-600">{cafeDetails.offer}</p>
                          </div>
                        )}
                        {cafeDetails?.featuredDish && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Featured Dish</p>
                            <p className="text-sm font-medium text-slate-900">{cafeDetails.featuredDish}</p>
                            {cafeDetails.featuredPrice && (
                              <p className="text-xs text-green-600 mt-1">₹{cafeDetails.featuredPrice}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Timings & Status</h4>
                      <div className="space-y-3">
                        {(cafeDetails?.deliveryTimings || cafeDetails?.onboarding?.step2?.deliveryTimings) && (
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Delivery Timings</p>
                              <p className="text-sm font-medium text-slate-900">
                                {cafeDetails.deliveryTimings?.openingTime || cafeDetails.onboarding?.step2?.deliveryTimings?.openingTime || "N/A"} - {cafeDetails.deliveryTimings?.closingTime || cafeDetails.onboarding?.step2?.deliveryTimings?.closingTime || "N/A"}
                              </p>
                            </div>
                          </div>
                        )}
                        {(cafeDetails?.estimatedDeliveryTime || cafeDetails?.onboarding?.step4?.estimatedDeliveryTime) && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time</p>
                            <p className="text-sm font-medium text-slate-900">{cafeDetails.estimatedDeliveryTime || cafeDetails.onboarding?.step4?.estimatedDeliveryTime}</p>
                          </div>
                        )}
                        {cafeDetails?.openDays && Array.isArray(cafeDetails.openDays) && cafeDetails.openDays.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Open Days</p>
                            <div className="flex flex-wrap gap-2">
                              {cafeDetails.openDays.map((day, idx) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Status</p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            cafeDetails?.isActive !== false ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {cafeDetails?.isActive !== false ? "Active" : "Pending Approval"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration Documents - PAN, GST, FSSAI, Bank */}
                  {cafeDetails?.onboarding?.step3 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Documents</h4>
                      <div className="space-y-6">
                        {/* PAN Details */}
                        {cafeDetails.onboarding.step3.pan && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              PAN Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {cafeDetails.onboarding.step3.pan.panNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.pan.panNumber}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.pan.nameOnPan && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Name on PAN</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.pan.nameOnPan}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.pan.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">PAN Document</p>
                                  <a
                                    href={cafeDetails.onboarding.step3.pan.image.url}
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
                        {cafeDetails.onboarding.step3.gst && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              GST Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">GST Registered</p>
                                <p className="font-medium text-slate-900">
                                  {cafeDetails.onboarding.step3.gst.isRegistered ? "Yes" : "No"}
                                </p>
                              </div>
                              {cafeDetails.onboarding.step3.gst.gstNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Number</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.gst.gstNumber}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.gst.legalName && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Legal Name</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.gst.legalName}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.gst.address && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-1">GST Address</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.gst.address}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.gst.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">GST Document</p>
                                  <a
                                    href={cafeDetails.onboarding.step3.gst.image.url}
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
                        {cafeDetails.onboarding.step3.fssai && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              FSSAI Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {cafeDetails.onboarding.step3.fssai.registrationNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Registration Number</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.fssai.registrationNumber}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.fssai.expiryDate && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Expiry Date</p>
                                  <p className="font-medium text-slate-900">
                                    {new Date(cafeDetails.onboarding.step3.fssai.expiryDate).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.fssai.image?.url && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                  <a
                                    href={cafeDetails.onboarding.step3.fssai.image.url}
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
                        {cafeDetails.onboarding.step3.bank && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Bank Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {cafeDetails.onboarding.step3.bank.accountNumber && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                  <p className="font-medium text-slate-900">
                                    {cafeDetails.onboarding.step3.bank.accountNumber}
                                  </p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.bank.ifscCode && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.bank.ifscCode}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.bank.accountHolderName && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                  <p className="font-medium text-slate-900">{cafeDetails.onboarding.step3.bank.accountHolderName}</p>
                                </div>
                              )}
                              {cafeDetails.onboarding.step3.bank.accountType && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                  <p className="font-medium text-slate-900 capitalize">{cafeDetails.onboarding.step3.bank.accountType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Menu Images */}
                  {(cafeDetails?.menuImages || cafeDetails?.onboarding?.step2?.menuImageUrls) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Menu Images</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {(cafeDetails.menuImages || cafeDetails.onboarding?.step2?.menuImageUrls || []).map((menuImg, idx) => {
                          const imgUrl = menuImg.url || menuImg
                          return imgUrl ? (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors"
                            >
                              <img
                                src={imgUrl}
                                alt={`Menu ${idx + 1}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/200"
                                }}
                              />
                            </a>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registration Information */}
                  {(cafeDetails?.createdAt || cafeDetails?.cafeId || cafeDetails?.businessModel) && (
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
                        {cafeDetails.cafeId && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Cafe ID</p>
                            <p className="font-medium text-slate-900">{cafeDetails.cafeId}</p>
                          </div>
                        )}
                        {cafeDetails.businessModel && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Business Model</p>
                            <p className="font-medium text-slate-900">{cafeDetails.businessModel}</p>
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
                        {cafeDetails.onboarding?.completedSteps !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Onboarding Steps Completed</p>
                            <p className="font-medium text-slate-900">{cafeDetails.onboarding.completedSteps} / 4</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason (if rejected) */}
                  {cafeDetails?.rejectionReason && (
                    <div className="pt-6 border-t border-slate-200">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-red-900 mb-2">Rejection Reason</h4>
                        <p className="text-sm text-red-800">{cafeDetails.rejectionReason}</p>
                        {cafeDetails.rejectedAt && (
                          <p className="text-xs text-red-600 mt-2">
                            Rejected on: {new Date(cafeDetails.rejectedAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!loadingDetails && !cafeDetails && !selectedRequest && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load cafe details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
