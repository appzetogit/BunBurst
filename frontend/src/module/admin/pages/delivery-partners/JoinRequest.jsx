import { useState, useMemo, useEffect } from "react"
import { Search, Filter, Eye, Check, X, Package, FileText, FileSpreadsheet, Loader2, Download, ExternalLink, Calendar, MapPin, CreditCard, User, Mail, Phone, Bike, FileCheck } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { exportJoinRequestsToExcel, exportJoinRequestsToPDF } from "../../components/deliveryman/joinRequestExportUtils"

export default function JoinRequest() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [isDenyOpen, setIsDenyOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [viewDetails, setViewDetails] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [filters, setFilters] = useState({
    zone: "",
    jobType: "",
    vehicleType: "",
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Fetch join requests from API
  const fetchJoinRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = {
        status: activeTab === "pending" ? "pending" : "denied",
        page: 1,
        limit: 1000, // Get all for now, can add pagination later
      }

      // Add search to params if provided
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      // Add filters to params
      if (filters.zone) {
        params.zone = filters.zone
      }
      if (filters.vehicleType) {
        params.vehicleType = filters.vehicleType.toLowerCase()
      }

      const response = await adminAPI.getDeliveryPartnerJoinRequests(params)
      
      if (response.data && response.data.success) {
        setRequests(response.data.data.requests || [])
      } else {
        setError("Failed to fetch join requests")
        setRequests([])
      }
    } catch (err) {
      console.error("Error fetching join requests:", err)
      
      // Better error handling
      let errorMessage = "Failed to fetch join requests. Please try again."
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = "Network error. Please check if backend server is running."
      } else if (err.response?.status === 401) {
        errorMessage = "Unauthorized. Please login again."
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to view this."
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch requests when tab changes
  useEffect(() => {
    fetchJoinRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJoinRequests()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  // Fetch when filters change (only when filter dialog is closed)
  useEffect(() => {
    if (!isFilterOpen) {
      // Only fetch when filter dialog is closed (after applying)
      fetchJoinRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isFilterOpen])

  const filteredRequests = useMemo(() => {
    let result = [...requests]
    
    // Client-side filtering for additional filters not supported by backend
    if (filters.jobType) {
      result = result.filter(request => request.jobType === filters.jobType)
    }

    return result
  }, [requests, filters])

  const handleApprove = (request) => {
    setSelectedRequest(request)
    setIsApproveOpen(true)
  }

  const confirmApprove = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      await adminAPI.approveDeliveryPartner(selectedRequest._id)
      
      // Refresh the list
      await fetchJoinRequests()
      
      setIsApproveOpen(false)
      setSelectedRequest(null)
      
      // Show success message
      alert(`Successfully approved ${selectedRequest.name}'s join request!`)
    } catch (err) {
      console.error("Error approving request:", err)
      alert(err.response?.data?.message || "Failed to approve request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleDeny = (request) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setIsDenyOpen(true)
  }

  const confirmDeny = async () => {
    if (!selectedRequest) return

    // Validate rejection reason
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectDeliveryPartner(selectedRequest._id, rejectionReason.trim())
      
      // Refresh the list
      await fetchJoinRequests()
      
      setIsDenyOpen(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      // Show success message
      alert(`Successfully rejected ${selectedRequest.name}'s join request.`)
    } catch (err) {
      console.error("Error rejecting request:", err)
      alert(err.response?.data?.message || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleView = async (request) => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryPartnerById(request._id)
      
      if (response.data && response.data.success) {
        setViewDetails(response.data.data.delivery)
        setIsViewOpen(true)
      } else {
        alert("Failed to load details")
      }
    } catch (err) {
      console.error("Error fetching details:", err)
      alert(err.response?.data?.message || "Failed to load details")
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (filteredRequests.length === 0) {
      alert("No data to export")
      return
    }
    exportJoinRequestsToPDF(filteredRequests)
  }

  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      alert("No data to export")
      return
    }
    exportJoinRequestsToExcel(filteredRequests)
  }

  const handleResetFilters = () => {
    setFilters({ zone: "", jobType: "", vehicleType: "" })
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchQuery("") // Reset search when changing tabs
    setFilters({ zone: "", jobType: "", vehicleType: "" }) // Reset filters
  }

  const activeFiltersCount = Object.values(filters).filter(v => v).length
  const zones = [...new Set(requests.map(r => r.zone))].filter(Boolean)
  const jobTypes = [...new Set(requests.map(r => r.jobType))].filter(Boolean)
  const vehicleTypes = [...new Set(requests.map(r => r.vehicleType))].filter(Boolean)

  return (
    <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#e53935] flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#1E1E1E]">New Joining Request</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-[#F5F5F5] mb-6">
            <button
              onClick={() => handleTabChange("pending")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-[#e53935] text-[#e53935]"
                  : "border-transparent text-[#1E1E1E]/70 hover:text-[#1E1E1E]"
              }`}
            >
              Pending Delivery Man
            </button>
            <button
              onClick={() => handleTabChange("denied")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "denied"
                  ? "border-[#e53935] text-[#e53935]"
                  : "border-transparent text-[#1E1E1E]/70 hover:text-[#1E1E1E]"
              }`}
            >
              Denied Deliveryman
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#F5F5F5] bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-[#1E1E1E] placeholder:text-[#1E1E1E]/40"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E1E1E]/40" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsFilterOpen(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-[#F5F5F5] text-[#1E1E1E] flex items-center gap-2 transition-all relative ${
                  activeFiltersCount > 0 ? "border-[#FFC400] bg-[#FFFBEA]" : ""
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-[#1E1E1E] font-bold">Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FFC400] text-[#1E1E1E] rounded-full text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-[#F5F5F5] text-[#1E1E1E] flex items-center gap-2 transition-all"
                title="Export as PDF"
              >
                <FileText className="w-4 h-4" />
                <span className="text-[#1E1E1E] font-bold">PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-[#F5F5F5] text-[#1E1E1E] flex items-center gap-2 transition-all"
                title="Export as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-[#1E1E1E] font-bold">Excel</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchJoinRequests}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#e53935]" />
                <span className="ml-3 text-sm text-[#1E1E1E]/70">Loading requests...</span>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#F5F5F5] border-b border-[#F5F5F5]">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">SI</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Zone</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Vehicle Type</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Availability Status</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#F5F5F5]">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <p className="text-sm text-[#1E1E1E]/50">
                          {error ? "Error loading requests" : "No requests found"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-[#F5F5F5] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-[#1E1E1E]/80">{request.sl}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">👤</span>
                            </div>
                            <span className="text-sm font-medium text-[#1E1E1E]">{request.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#1E1E1E]/80">{request.email}</span>
                            <span className="text-xs text-[#1E1E1E]/50">{request.phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#1E1E1E]/80">{request.zone}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#1E1E1E]/80">{request.vehicleType}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block w-fit ${
                              request.status === "Pending" || request.status === "pending"
                                ? "bg-[#FFFBEA] text-[#1E1E1E] border border-[#FFC400]"
                                : request.status === "Denied" || request.status === "denied" || request.status === "blocked"
                                ? "bg-[#FFECEC] text-[#e53935] border border-[#e53935]/40"
                                : "bg-[#F5F5F5] text-[#1E1E1E] border border-[#F5F5F5]"
                            }`}>
                              {request.status === "blocked" || request.status === "Blocked" || request.status === "Denied" || request.status === "denied" ? "Rejected" : request.status}
                            </span>
                            {request.rejectionReason && (
                              <span className="text-xs text-red-600 italic max-w-[200px] truncate" title={request.rejectionReason}>
                                {request.rejectionReason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleView(request)}
                              className="p-1.5 rounded bg-[#F5F5F5] text-[#e53935] hover:bg-[#FFECEC] transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {activeTab === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={processing}
                                  className="p-1.5 rounded bg-[#F5F5F5] text-[#e53935] hover:bg-[#FFECEC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeny(request)}
                                  disabled={processing}
                                  className="p-1.5 rounded bg-[#F5F5F5] text-[#e53935] hover:bg-[#FFECEC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Deny"
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
            )}
          </div>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Approve Request</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-[#1E1E1E]/80">
              Are you sure you want to approve "{selectedRequest?.name}"'s join request?
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setIsApproveOpen(false)}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmApprove}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#c62828] transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Confirmation Dialog */}
      <Dialog open={isDenyOpen} onOpenChange={setIsDenyOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Deny Request</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-[#1E1E1E]/80">
              Are you sure you want to deny "{selectedRequest?.name}"'s join request?
            </p>
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide specific reasons for rejection (e.g., Invalid documents, Incomplete information, etc.)"
                rows={5}
                className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-sm resize-none text-[#1E1E1E] placeholder:text-[#1E1E1E]/40"
                disabled={processing}
              />
              <p className="text-xs text-[#1E1E1E]/50 mt-1">
                This reason will be shown to the delivery partner
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => {
                setIsDenyOpen(false)
                setRejectionReason("")
              }}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeny}
              disabled={processing || !rejectionReason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#c62828] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Deny
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100 max-h-[85vh] overflow-y-auto text-[#1E1E1E] [&_.text-slate-900]:text-[#1E1E1E] [&_.text-slate-700]:text-[#1E1E1E]/80 [&_.text-slate-600]:text-[#1E1E1E]/70 [&_.text-slate-500]:text-[#1E1E1E]/50 [&_.border-slate-200]:border-[#F5F5F5] [&_.border-slate-300]:border-[#F5F5F5] [&_.bg-slate-50]:bg-[#F5F5F5] [&_.bg-slate-200]:bg-[#F5F5F5]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F5F5F5]">
            <DialogTitle className="text-xl font-bold text-[#1E1E1E]">Delivery Partner Details</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewDetails ? (
              <div className="space-y-6 mt-4">
                {/* Profile Image & Basic Info */}
                <div className="flex items-start gap-6 pb-6 border-b border-[#F5F5F5]">
                  <div className="flex-shrink-0">
                    {viewDetails.profileImage?.url ? (
                      <img 
                        src={viewDetails.profileImage.url} 
                        alt={viewDetails.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-[#F5F5F5]"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                        <User className="w-12 h-12 text-[#1E1E1E]/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Name
                      </label>
                      <p className="text-sm font-medium text-[#1E1E1E] mt-1">{viewDetails.name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </label>
                      <p className="text-sm text-[#1E1E1E] mt-1">{viewDetails.email || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </label>
                      <p className="text-sm text-[#1E1E1E] mt-1">{viewDetails.phone || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase">Delivery ID</label>
                      <p className="text-sm font-medium text-[#1E1E1E] mt-1">{viewDetails.deliveryId || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase">Status</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.status === 'pending' ? 'bg-[#FFFBEA] text-[#1E1E1E] border border-[#FFC400]' :
                        viewDetails.status === 'approved' || viewDetails.status === 'active' ? 'bg-[#F5F5F5] text-[#1E1E1E] border border-[#F5F5F5]' :
                        viewDetails.status === 'blocked' ? 'bg-[#FFECEC] text-[#e53935] border border-[#e53935]/40' :
                        'bg-[#F5F5F5] text-[#1E1E1E]/80 border border-[#F5F5F5]'
                      }`}>
                        {viewDetails.status === 'blocked' ? 'Rejected' : (viewDetails.status?.charAt(0).toUpperCase() + viewDetails.status?.slice(1) || "N/A")}
                      </span>
                    </div>
                    {viewDetails.rejectionReason && (
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase text-[#e53935]">Rejection Reason</label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{viewDetails.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                    {viewDetails.dateOfBirth && (
                      <div>
                        <label className="text-xs font-semibold text-[#1E1E1E]/50 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Birth
                        </label>
                        <p className="text-sm text-[#1E1E1E] mt-1">
                          {new Date(viewDetails.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {viewDetails.gender && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Gender</label>
                        <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.gender || "N/A"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                {viewDetails.location && (
                  <div className="pb-6 border-b border-[#F5F5F5]">
                    <h3 className="text-sm font-bold text-[#1E1E1E] mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.location.addressLine1 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 1</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine1}</p>
                        </div>
                      )}
                      {viewDetails.location.addressLine2 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 2</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine2}</p>
                        </div>
                      )}
                      {viewDetails.location.area && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Area</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.area}</p>
                        </div>
                      )}
                      {viewDetails.location.city && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.city}</p>
                        </div>
                      )}
                      {viewDetails.location.state && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.state}</p>
                        </div>
                      )}
                      {viewDetails.location.zipCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Zip Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.zipCode}</p>
                        </div>
                      )}
                      {(viewDetails.location.latitude && viewDetails.location.longitude) && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Coordinates</label>
                          <p className="text-sm text-slate-900 mt-1">
                            {viewDetails.location.latitude}, {viewDetails.location.longitude}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle Details */}
                {viewDetails.vehicle && (
                  <div className="pb-6 border-b border-[#F5F5F5]">
                    <h3 className="text-sm font-bold text-[#1E1E1E] mb-3 flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Vehicle Details
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      {viewDetails.vehicle.brand && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Brand</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.brand}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.model && (
                        <div className="text-right col-span-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Model</label>
                          <p className="text-xs text-slate-900 mt-1">{viewDetails.vehicle.model}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.number && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.number}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.type && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Type</label>
                          <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.vehicle.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {viewDetails.documents && (
                  <div className="pb-6 border-b border-[#F5F5F5]">
                    <h3 className="text-sm font-bold text-[#1E1E1E] mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4" /> Documents
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Aadhar */}
                      {viewDetails.documents.aadhar && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Aadhar Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.aadhar.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.aadhar.number}</p>
                            )}
                            {viewDetails.documents.aadhar.document && (
                              <a 
                                href={viewDetails.documents.aadhar.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[#e53935] hover:text-[#c62828]"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAN */}
                      {viewDetails.documents.pan && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">PAN Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.pan.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.pan.number}</p>
                            )}
                            {viewDetails.documents.pan.document && (
                              <a 
                                href={viewDetails.documents.pan.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[#e53935] hover:text-[#c62828]"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Driving License */}
                      {viewDetails.documents.drivingLicense && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Driving License</label>
                          <div className="mt-2">
                            {viewDetails.documents.drivingLicense.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.drivingLicense.number}</p>
                            )}
                            {viewDetails.documents.drivingLicense.expiryDate && (
                              <p className="text-xs text-slate-500 mb-1">
                                Expiry: {new Date(viewDetails.documents.drivingLicense.expiryDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            {viewDetails.documents.drivingLicense.document && (
                              <a 
                                href={viewDetails.documents.drivingLicense.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[#e53935] hover:text-[#c62828]"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle RC */}
                      {viewDetails.documents.vehicleRC && (viewDetails.documents.vehicleRC.number || viewDetails.documents.vehicleRC.document) && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle RC</label>
                          <div className="mt-2">
                            {viewDetails.documents.vehicleRC.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.vehicleRC.number}</p>
                            )}
                            {viewDetails.documents.vehicleRC.document && (
                              <a 
                                href={viewDetails.documents.vehicleRC.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[#e53935] hover:text-[#c62828]"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                {viewDetails.documents?.bankDetails && (
                  <div className="pb-6 border-b border-[#F5F5F5]">
                    <h3 className="text-sm font-bold text-[#1E1E1E] mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Bank Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.documents.bankDetails.accountHolderName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Holder Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountHolderName}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.accountNumber && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountNumber}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.ifscCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.ifscCode}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.bankName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4">
                  {viewDetails.signupMethod && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Signup Method</label>
                      <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.signupMethod}</p>
                    </div>
                  )}
                  {viewDetails.phoneVerified !== undefined && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Phone Verified</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.phoneVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {viewDetails.phoneVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  )}
                  {viewDetails.createdAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Joined Date</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {viewDetails.verifiedAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Verified At</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#e53935]" />
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 border-t border-[#F5F5F5]">
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] transition-all"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Panel */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Options
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">Zone</label>
              <select
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-sm text-[#1E1E1E]"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">Job Type</label>
              <select
                value={filters.jobType}
                onChange={(e) => setFilters({ ...filters, jobType: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-sm text-[#1E1E1E]"
              >
                <option value="">All Job Types</option>
                {jobTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">Vehicle Type</label>
              <select
                value={filters.vehicleType}
                onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-sm text-[#1E1E1E]"
              >
                <option value="">All Vehicle Types</option>
                {vehicleTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] transition-all"
            >
              Reset
            </button>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#c62828] transition-all shadow-md"
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
