import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Calendar, Eye, FileDown, FileSpreadsheet, FileText, X, Mail, Phone, MapPin, Package, DollarSign, Calendar as CalendarIcon, User, CheckCircle, XCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { exportCustomersToCSV, exportCustomersToExcel, exportCustomersToPDF } from "../components/customers/customersExportUtils"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [filters, setFilters] = useState({
    orderDate: "",
    joiningDate: "",
    status: "",
    sortBy: "",
    chooseFirst: "",
  })

  const formatCurrencyINR = (amount = 0) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0)

  const filteredCustomers = useMemo(() => {
    let result = [...customers]
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(query)
      )
    }

    // Filter by order date (if customer has order date field, otherwise skip)
    // Note: customersDummy doesn't have orderDate, so this is a placeholder for future implementation

    // Filter by joining date
    if (filters.joiningDate) {
      result = result.filter(customer => {
        // Parse joining date from format "17 Oct 2021"
        const customerDate = new Date(customer.joiningDate)
        const filterDate = new Date(filters.joiningDate)
        return customerDate.toDateString() === filterDate.toDateString()
      })
    }

    // Filter by status
    if (filters.status) {
      if (filters.status === "active") {
        result = result.filter(customer => customer.status === true)
      } else if (filters.status === "inactive") {
        result = result.filter(customer => customer.status === false)
      }
    }

    // Sort by options
    if (filters.sortBy) {
      if (filters.sortBy === "name-asc") {
        result.sort((a, b) => a.name.localeCompare(b.name))
      } else if (filters.sortBy === "name-desc") {
        result.sort((a, b) => b.name.localeCompare(a.name))
      } else if (filters.sortBy === "orders-asc") {
        result.sort((a, b) => a.totalOrder - b.totalOrder)
      } else if (filters.sortBy === "orders-desc") {
        result.sort((a, b) => b.totalOrder - a.totalOrder)
      }
    }

    // Limit results if "Choose First" is set
    if (filters.chooseFirst && parseInt(filters.chooseFirst) > 0) {
      result = result.slice(0, parseInt(filters.chooseFirst))
    }

    return result
  }, [customers, searchQuery, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Fetch customers from API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true)
        const params = {
          limit: 1000, // Get all customers
          offset: 0,
          ...(searchQuery && { search: searchQuery }),
          ...(filters.status && { status: filters.status }),
          ...(filters.joiningDate && { joiningDate: filters.joiningDate }),
          ...(filters.sortBy && { sortBy: filters.sortBy }),
        }

        const response = await adminAPI.getUsers(params)
        const data = response?.data?.data || response?.data
        
        if (data?.users) {
          setCustomers(data.users)
          setTotalCustomers(data.total || data.users.length)
        } else {
          setCustomers([])
          setTotalCustomers(0)
        }
      } catch (error) {
        console.error('Error fetching customers:', error)
        toast.error('Failed to load customers')
        setCustomers([])
        setTotalCustomers(0)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [searchQuery, filters.status, filters.joiningDate, filters.sortBy])

  const handleToggleStatus = async (customerId) => {
    try {
      // Find customer
      const customer = customers.find(c => c.id === customerId)
      if (!customer) return

      const newStatus = !customer.status

      // Optimistically update UI
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: newStatus } : c
      ))

      // Call API to update user status
      await adminAPI.updateUserStatus(customerId, newStatus)
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: !c.status } : c
      ))
    }
  }

  const handleViewDetails = async (customerId) => {
    try {
      setLoadingDetails(true)
      setShowUserDetails(true)
      setSelectedCustomer(customerId)

      const response = await adminAPI.getUserById(customerId)
      const data = response?.data?.data || response?.data
      
      if (data?.user) {
        setUserDetails(data.user)
      } else {
        toast.error('Failed to load user details')
        setShowUserDetails(false)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('Failed to load user details')
      setShowUserDetails(false)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleExport = (format) => {
    if (filteredCustomers.length === 0) {
      toast.error("No customers to export")
      return
    }

    const filename = "customers"
    try {
      switch (format) {
        case "csv":
          exportCustomersToCSV(filteredCustomers, filename)
          toast.success("CSV export started")
          break
        case "excel":
          exportCustomersToExcel(filteredCustomers, filename)
          toast.success("Excel export started")
          break
        case "pdf":
          exportCustomersToPDF(filteredCustomers, filename)
          toast.success("PDF download started")
          break
        default:
          toast.error("Invalid export format")
          break
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export customers")
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(229,57,53,0.08),_transparent_28%),linear-gradient(180deg,#ffffff_0%,#fffdf7_48%,#ffffff_100%)] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="mb-6 rounded-[28px] border border-[#F5F5F5] bg-white/90 p-6 shadow-[0_18px_50px_rgba(30,30,30,0.05)] backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E1E1E]">
                Order Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.orderDate}
                  onChange={(e) => handleFilterChange("orderDate", e.target.value)}
                  className="w-full rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 pr-10 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FFC400]" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E1E1E]">
                Customer Joining Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.joiningDate}
                  onChange={(e) => handleFilterChange("joiningDate", e.target.value)}
                  className="w-full rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 pr-10 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FFC400]" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E1E1E]">
                Customer status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E1E1E]">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="w-full rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
              >
                <option value="">Select Customer Sorting Order</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="orders-asc">Orders (Low to High)</option>
                <option value="orders-desc">Orders (High to Low)</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E1E1E]">
                Choose First
              </label>
              <input
                type="number"
                value={filters.chooseFirst}
                onChange={(e) => handleFilterChange("chooseFirst", e.target.value)}
                placeholder="Ex: 100"
                className="w-full rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  // Filters are applied automatically via useMemo
                }}
                className="rounded-2xl bg-[#e53935] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(229,57,53,0.22)] transition-all hover:brightness-105"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({
                    orderDate: "",
                    joiningDate: "",
                    status: "",
                    sortBy: "",
                    chooseFirst: "",
                  })
                }}
                className="rounded-2xl border border-[#F5F5F5] bg-white px-6 py-3 text-sm font-semibold text-[#1E1E1E] transition-all hover:border-[#e53935] hover:bg-[#fafafa]"
              >
                Reset Filters
              </button>
            </div>
            <div className="rounded-full bg-[#FFF8E1] px-4 py-2 text-sm font-medium text-[#1E1E1E]">
              {loading ? 'Loading...' : `Showing ${filteredCustomers.length} of ${totalCustomers} customers`}
            </div>
          </div>
        </div>

        {/* Customer List Section */}
        <div className="rounded-[28px] border border-[#F5F5F5] bg-white/95 p-6 shadow-[0_22px_54px_rgba(30,30,30,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1E1E1E]">Customer list</h2>
              <span className="rounded-full border border-[#F5F5F5] bg-[#FFF8E1] px-3 py-1 text-sm font-semibold text-[#1E1E1E]">
                {filteredCustomers.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Search by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-[#F5F5F5] bg-white py-3 pl-10 pr-4 text-sm text-[#1E1E1E] shadow-sm transition-all focus:border-[#e53935] focus:outline-none focus:ring-4 focus:ring-[#e53935]/10"
                />
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FFC400]" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-2xl border border-[#F5F5F5] bg-white px-4 py-3 text-sm font-semibold text-[#1E1E1E] transition-all hover:border-[#e53935] hover:bg-[#fafafa]">
                    <Download className="w-4 h-4" />
                    <span className="font-bold text-[#1E1E1E]">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                    <FileDown className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-hidden">
            <table className="w-full">
              <thead className="border-b border-[#F5F5F5] bg-[#fffdf8]">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Sl</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Contact Information</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Total Order</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Total Order Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Joining Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Active/Inactive</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#1E1E1E]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F5] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">Loading customers...</div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">No customers found</div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id || customer.sl} className="transition-colors hover:bg-[#fffdf8]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-[#1E1E1E]">{customer.sl}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FFF8E1] text-[#1E1E1E] shadow-sm">
                            <span className="text-sm">👤</span>
                          </div>
                          <span className="text-sm font-semibold text-[#1E1E1E]">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-[#1E1E1E]">{customer.email}</span>
                          <span className="text-xs text-[#1E1E1E]/70">{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-[#1E1E1E]">{customer.totalOrder || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-[#1E1E1E]">{formatCurrencyINR(customer.totalOrderAmount)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#1E1E1E]">{customer.joiningDate}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(customer.id || customer.sl)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:ring-offset-2 ${
                            customer.status ? "bg-[#e53935]" : "bg-[#F5F5F5]"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              customer.status ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => handleViewDetails(customer.id || customer.sl)}
                          className="rounded-xl p-2 text-[#e53935] transition-colors hover:bg-[#FFF8E1]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="mx-auto max-h-[85vh] max-w-2xl overflow-y-auto border border-[#F5F5F5] bg-[linear-gradient(180deg,#ffffff_0%,#fffdf8_100%)] p-0 shadow-[0_30px_80px_rgba(30,30,30,0.12)]">
          <DialogHeader>
            <div className="border-b border-[#F5F5F5] bg-[linear-gradient(135deg,#ffffff_0%,#fffdf8_45%,#ffffff_100%)] px-6 py-5">
              <DialogTitle className="text-2xl font-bold text-[#1E1E1E]">User Details</DialogTitle>
            </div>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="px-6 py-8 text-center">
              <div className="text-sm text-slate-500">Loading user details...</div>
            </div>
          ) : userDetails ? (
            <div className="space-y-5 px-6 pb-6">
              {/* Profile Section */}
              <div className="rounded-[24px] border border-[#F5F5F5] bg-[linear-gradient(135deg,#ffffff_0%,#fffdf8_100%)] p-5 shadow-[0_10px_28px_rgba(30,30,30,0.05)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[22px] bg-[#FFF8E1] shadow-sm">
                    {userDetails.profileImage ? (
                      <img src={userDetails.profileImage} alt={userDetails.name} className="h-full w-full rounded-[22px] object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-[#1E1E1E]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-[#1E1E1E]">{userDetails.name}</h3>
                      {userDetails.isActive ? (
                        <span className="flex items-center gap-1 rounded-full border border-[#c7f1d6] bg-[#eafcf0] px-3 py-1 text-xs font-semibold text-[#138a4d]">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full border border-[#ffd3d0] bg-[#fff1f0] px-3 py-1 text-xs font-semibold text-[#d93025]">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2 text-sm text-[#1E1E1E]">
                        <Mail className="w-4 h-4 text-[#FFC400]" />
                        <span>{userDetails.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1E1E1E]">
                        <Phone className="w-4 h-4 text-[#FFC400]" />
                        <span>{userDetails.phone}</span>
                        {userDetails.phoneVerified && (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1E1E1E]">
                        <CalendarIcon className="w-4 h-4 text-[#FFC400]" />
                        <span>Joined: {userDetails.joiningDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#1E1E1E]">
                        <User className="w-4 h-4 text-[#FFC400]" />
                        <span>Signup: {userDetails.signupMethod || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-[22px] border border-[#F5F5F5] bg-[#fffdf8] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-[#FFC400]" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#1E1E1E]">Total Orders</span>
                  </div>
                  <p className="text-3xl font-bold text-[#e53935]">{userDetails.totalOrders || 0}</p>
                </div>
                <div className="rounded-[22px] border border-[#F5F5F5] bg-[#fffdf8] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-[#FFC400]" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#1E1E1E]">Total Spent</span>
                  </div>
                  <p className="text-3xl font-bold text-[#e53935]">
                    {formatCurrencyINR(userDetails.totalOrderAmount)}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#F5F5F5] bg-[#FFF8E1] p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-[#FFC400]" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#1E1E1E]">Member Since</span>
                  </div>
                  <p className="text-lg font-bold text-[#1E1E1E]">{userDetails.joiningDate}</p>
                </div>
              </div>

              {/* Addresses Section */}
              {userDetails.addresses && userDetails.addresses.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1E1E1E]">
                    <MapPin className="w-4 h-4 text-[#FFC400]" />
                    Addresses
                  </h4>
                  <div className="space-y-2">
                    {userDetails.addresses.map((address, index) => (
                      <div key={index} className="rounded-[20px] border border-[#F5F5F5] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-[#1E1E1E]">{address.label || 'Address'}</span>
                          {address.isDefault && (
                            <span className="rounded-full border border-[#F5F5F5] bg-[#FFF8E1] px-3 py-1 text-xs font-semibold text-[#1E1E1E]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-6 text-[#1E1E1E]">
                          {address.street}
                          {address.additionalDetails && `, ${address.additionalDetails}`}
                          {address.city && `, ${address.city}`}
                          {address.state && `, ${address.state}`}
                          {address.zipCode && ` - ${address.zipCode}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders Section */}
              {userDetails.orders && userDetails.orders.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1E1E1E]">
                    <Package className="w-4 h-4 text-[#FFC400]" />
                    Recent Orders
                  </h4>
                  <div className="space-y-2">
                    {userDetails.orders.slice(0, 5).map((order, index) => (
                      <div key={index} className="flex items-center justify-between rounded-[20px] border border-[#F5F5F5] bg-white p-4 shadow-sm">
                        <div>
                          <p className="text-sm font-semibold text-[#1E1E1E]">{order.orderId}</p>
                          <p className="text-xs text-[#1E1E1E]/70">{order.cafeName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[#1E1E1E]">{formatCurrencyINR(order.total)}</p>
                          <p className="text-xs font-semibold capitalize text-[#e53935]">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userDetails.gender && (
                  <div className="rounded-[20px] border border-[#F5F5F5] bg-white p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#1E1E1E]">Gender</p>
                    <p className="text-sm font-medium capitalize text-[#1E1E1E]">{userDetails.gender}</p>
                  </div>
                )}
                {userDetails.dateOfBirth && (
                  <div className="rounded-[20px] border border-[#F5F5F5] bg-white p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#1E1E1E]">Date of Birth</p>
                    <p className="text-sm font-medium text-[#1E1E1E]">
                      {new Date(userDetails.dateOfBirth).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <div className="text-sm text-slate-500">No user details available</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
