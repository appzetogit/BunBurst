import { useState, useEffect, useMemo } from "react"
import { Plus, Search, Edit2, Trash2, Power, PowerOff, Check, X, Calendar, Gift } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { format } from "date-fns"
import { toast } from "sonner"

export default function GlobalCouponManagement() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const initialFormState = {
    code: "",
    discountType: "flat",
    discountValue: "",
    minOrderAmount: "",
    maxDiscount: "",
    isFirstOrderOnly: false,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    usageLimit: "",
    isActive: true
  }

  const [form, setForm] = useState(initialFormState)

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getGlobalCoupons()
      if (response.data.success) {
        setCoupons(response.data.data)
      } else {
        setError("Failed to fetch coupons")
      }
    } catch (err) {
      console.error("Error fetching coupons:", err)
      setError(err?.response?.data?.message || "Failed to fetch coupons")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const filteredCoupons = useMemo(() => {
    return coupons.filter(coupon =>
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [coupons, searchQuery])

  const handleOpenAdd = () => {
    setForm(initialFormState)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (coupon) => {
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount || "",
      maxDiscount: coupon.maxDiscount || "",
      isFirstOrderOnly: coupon.isFirstOrderOnly,
      startDate: coupon.startDate ? format(new Date(coupon.startDate), "yyyy-MM-dd") : "",
      endDate: coupon.endDate ? format(new Date(coupon.endDate), "yyyy-MM-dd") : "",
      usageLimit: coupon.usageLimit || "",
      isActive: coupon.isActive
    })
    setSelectedId(coupon._id)
    setIsEditing(true)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Client-side uniqueness check for new coupons
    if (!isEditing) {
      const exists = coupons.some(c => c.code === form.code.toUpperCase())
      if (exists) {
        toast.error("Coupon code already exists")
        return
      }
    } else {
      // Check if code changed to something that exists on another coupon
      const exists = coupons.some(c => c._id !== selectedId && c.code === form.code.toUpperCase())
      if (exists) {
        toast.error("Coupon code already exists on another coupon")
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = { ...form }
      if (payload.usageLimit === "") payload.usageLimit = null
      
      if (isEditing) {
        await adminAPI.updateGlobalCoupon(selectedId, payload)
        toast.success("Coupon updated successfully")
      } else {
        await adminAPI.createGlobalCoupon(payload)
        toast.success("Coupon created successfully")
      }
      setIsModalOpen(false)
      fetchCoupons()
    } catch (err) {
      const msg = err?.response?.data?.message || "Something went wrong"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggleGlobalCoupon(id)
      toast.success("Status updated")
      fetchCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to toggle status")
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) return
    try {
      await adminAPI.deleteGlobalCoupon(id)
      toast.success("Coupon deleted successfully")
      fetchCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete coupon")
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 lg:p-6 text-[#1E1E1E]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-[#F5F5F5] bg-white p-6 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E]/60">Marketing</p>
              <h1 className="text-2xl font-bold text-[#1E1E1E]">Global Coupon Management</h1>
            </div>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 rounded-xl bg-[#e53935] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d32f2f]"
            >
              <Plus className="h-4 w-4" />
              Add Coupon
            </button>
          </div>

          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1E1E1E]/40" />
            <input
              type="text"
              placeholder="Search by coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#F5F5F5] bg-white px-10 py-3 text-sm text-[#1E1E1E] shadow-sm outline-none transition focus:border-[#e53935] focus:ring-2 focus:ring-[#e53935]/20"
            />
          </div>
        </div>

        {/* Coupons Table */}
        <div className="rounded-2xl border border-[#F5F5F5] bg-white p-6 shadow-[0_14px_40px_rgba(17,17,17,0.08)]">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#e53935]"></div>
              <p className="mt-4 text-sm text-[#1E1E1E]/60">Loading coupons...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fafafa]">
                <Gift className="h-8 w-8 text-[#1E1E1E]/20" />
              </div>
              <p className="text-lg font-semibold text-[#1E1E1E]">No Coupons Found</p>
              <p className="text-sm text-[#1E1E1E]/60">Try searching with a different code or create a new one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F5F5F5] bg-[#fafafa] text-left">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Code</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Value</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Min. Order</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Usage</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Dates</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {filteredCoupons.map((coupon) => (
                    <tr key={coupon._id} className="transition-colors hover:bg-[#FFFDF5]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-[#e53935] bg-[#e53935]/5 px-3 py-1 rounded-lg border border-[#e53935]/10">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize text-sm">
                        {coupon.discountType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-sm">
                        {coupon.discountType === 'flat' ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ₹{coupon.minOrderAmount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-col">
                          <span>{coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                          {coupon.isFirstOrderOnly && (
                            <span className="text-[10px] text-[#e53935] font-bold">FIRST ORDER ONLY</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-[#1E1E1E]/60">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {coupon.startDate ? format(new Date(coupon.startDate), "dd MMM yyyy") : 'No Start'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {coupon.endDate ? format(new Date(coupon.endDate), "dd MMM yyyy") : 'No expiry'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          coupon.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(coupon._id)}
                            title={coupon.isActive ? "Deactivate" : "Activate"}
                            className={`p-1.5 rounded-lg border transition-all ${
                              coupon.isActive 
                                ? 'border-green-200 text-green-600 hover:bg-green-50' 
                                : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {coupon.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 rounded-lg border border-[#F5F5F5] text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon._id)}
                            className="p-1.5 rounded-lg border border-[#F5F5F5] text-[#e53935] hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">{isEditing ? 'Edit Coupon' : 'Create New Coupon'}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 hover:bg-[#fafafa]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold opacity-70">Coupon Code</label>
                  <input
                    required
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className={`w-full rounded-xl border ${
                      !isEditing && coupons.some(c => c.code === form.code.toUpperCase()) 
                        ? 'border-red-400 focus:border-red-500' 
                        : 'border-[#F5F5F5] focus:border-[#e53935]'
                    } bg-[#fafafa] p-3 text-sm focus:outline-none`}
                    placeholder="e.g. WELCOME100"
                  />
                  {!isEditing && coupons.some(c => c.code === form.code.toUpperCase()) && (
                    <p className="mt-1 text-xs text-red-500 font-medium italic">This code already exists</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Discount Value</label>
                  <input
                    required
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                    placeholder="50 or 10"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Min. Order Amount (₹)</label>
                  <input
                    required
                    type="number"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                    placeholder="200"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Max. Discount (₹)</label>
                  <input
                    type="number"
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Usage Limit</label>
                  <input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                    placeholder="Unlimited if empty"
                  />
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input
                    id="firstOrderOnly"
                    type="checkbox"
                    checked={form.isFirstOrderOnly}
                    onChange={(e) => setForm({ ...form, isFirstOrderOnly: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-[#e53935] focus:ring-[#e53935]"
                  />
                  <label htmlFor="firstOrderOnly" className="text-sm font-semibold opacity-70 cursor-pointer">
                    First Order Only
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold opacity-70">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    min={form.startDate}
                    className="w-full rounded-xl border border-[#F5F5F5] bg-[#fafafa] p-3 text-sm focus:border-[#e53935] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-[#e53935] focus:ring-[#e53935]"
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold opacity-70 cursor-pointer">
                    Initially Active
                  </label>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full rounded-2xl border border-[#F5F5F5] p-4 text-sm font-bold transition hover:bg-[#fafafa]"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="w-full rounded-2xl bg-[#e53935] p-4 text-sm font-bold text-white shadow-lg transition hover:bg-[#d32f2f] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (isEditing ? 'Update Coupon' : 'Create Coupon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
