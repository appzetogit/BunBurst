import { useState, useEffect, useMemo } from "react"
import { Plus, Search } from "lucide-react"
import { adminAPI } from "@/lib/api"

export default function Coupons() {
  const [searchQuery, setSearchQuery] = useState("")
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [cafes, setCafes] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [createForm, setCreateForm] = useState({
    cafeId: "",
    goalId: "delight-customers",
    discountType: "percentage",
    itemId: "",
    dishName: "",
    couponCode: "",
    originalPrice: "",
    discountPercentage: "",
    discountedPrice: "",
    endDate: "",
  })
  const [editForm, setEditForm] = useState({
    offerId: "",
    itemIndex: null,
    cafeName: "",
    dishName: "",
    discountType: "percentage",
    couponCode: "",
    originalPrice: "",
    discountPercentage: "",
    discountedPrice: "",
    endDate: "",
    status: "active",
  })

  const fetchOffers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getAllOffers({})

      if (response?.data?.success) {
        setOffers(response.data.data.offers || [])
      } else {
        setError("Failed to fetch offers")
      }
    } catch (err) {
      console.error("Error fetching offers:", err)
      setError(err?.response?.data?.message || "Failed to fetch offers")
    } finally {
      setLoading(false)
    }
  }

  const fetchCafes = async () => {
    try {
      const res = await adminAPI.getCafes({})
      const list = res?.data?.data?.cafes || res?.data?.data || res?.data?.cafes || []
      setCafes(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error("Error fetching cafes:", err)
      setCafes([])
    }
  }

  // Fetch offers from backend
  useEffect(() => {
    fetchOffers()
    fetchCafes()
  }, [])

  useEffect(() => {
    const shouldLockScroll = isAddOpen || isEditOpen
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight

    if (shouldLockScroll) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = "hidden"
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isAddOpen, isEditOpen])

  // Filter offers based on search query
  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) {
      return offers
    }

    const query = searchQuery.toLowerCase().trim()
    return offers.filter(offer =>
      offer.cafeName?.toLowerCase().includes(query) ||
      offer.dishName?.toLowerCase().includes(query) ||
      offer.couponCode?.toLowerCase().includes(query)
    )
  }, [offers, searchQuery])
  const openEditModal = (offer) => {
    setEditForm({
      offerId: offer.offerId || "",
      itemIndex: offer.itemIndex ?? null,
      cafeName: offer.cafeName || "",
      dishName: offer.dishName || "",
      discountType: offer.discountType || "percentage",
      couponCode: offer.couponCode || "",
      originalPrice: offer.originalPrice || "",
      discountPercentage: offer.discountPercentage || "",
      discountedPrice: offer.discountedPrice || "",
      endDate: offer.endDate ? new Date(offer.endDate).toISOString().split("T")[0] : "",
      status: offer.status || "active",
    })
    setIsEditOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 lg:p-6 text-[#1E1E1E]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-[#F5F5F5] bg-white p-6 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E]/60">Promotions</p>
              <h1 className="text-2xl font-bold text-[#1E1E1E]">Cafe Offers & Coupons</h1>
            </div>
            <span className="rounded-full border border-[#F5F5F5] bg-[#FFF7D1] px-3 py-1 text-xs font-semibold text-[#1E1E1E]">
              Highlighted deals
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1E1E1E]/40" />
            <input
              type="text"
              placeholder="Search by cafe name, dish name, or coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#F5F5F5] bg-white px-10 py-3 text-sm text-[#1E1E1E] shadow-sm outline-none transition focus:border-[#e53935] focus:ring-2 focus:ring-[#e53935]/20"
            />
          </div>
        </div>

        {/* Offers List */}
        <div className="rounded-2xl border border-[#F5F5F5] bg-white p-6 shadow-[0_14px_40px_rgba(17,17,17,0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#1E1E1E]">
              Offers List
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#e53935] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d32f2f]"
              >
                <Plus className="h-4 w-4" />
                Add Offer
              </button>
              <span className="rounded-full border border-[#F5F5F5] bg-[#FFF7D1] px-3 py-1 text-sm font-semibold text-[#1E1E1E]">
                {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#e53935]"></div>
              <p className="mt-4 text-sm text-[#1E1E1E]/60">Loading offers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="mb-1 text-lg font-semibold text-[#e53935]">Error</p>
              <p className="text-sm text-[#1E1E1E]/60">{error}</p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-20">
              <p className="mb-1 text-lg font-semibold text-[#1E1E1E]">No Offers Found</p>
              <p className="text-sm text-[#1E1E1E]/60">
                {searchQuery ? "No offers match your search criteria" : "No offers have been created yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#F5F5F5] bg-[#fafafa]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">SI</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Cafe</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Dish</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Coupon Code</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Discount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Valid Until</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#1E1E1E]/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5] bg-white">
                  {filteredOffers.map((offer) => (
                    <tr key={`${offer.offerId}-${offer.dishId}`} className="transition-colors hover:bg-[#FFFDF5]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-[#1E1E1E]/70">{offer.sl}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-[#1E1E1E]">{offer.cafeName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#1E1E1E]/80">{offer.dishName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="rounded-full bg-[#FFC400]/20 px-3 py-1 text-xs font-semibold text-[#1E1E1E]">
                          {offer.couponCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#1E1E1E]/80">
                          {offer.discountType === 'flat-price'
                            ? `₹${offer.originalPrice - offer.discountedPrice} OFF`
                            : `${offer.discountPercentage}% OFF`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#1E1E1E]/40 line-through">₹{offer.originalPrice}</span>
                          <span className="text-sm font-semibold text-[#1E1E1E]">₹{offer.discountedPrice}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${offer.status === 'active'
                            ? 'bg-[#FFC400]/25 text-[#1E1E1E]'
                            : offer.status === 'paused'
                              ? 'bg-[#F5F5F5] text-[#1E1E1E]/70'
                              : 'bg-[#F5F5F5] text-[#1E1E1E]/70'
                          }`}>
                          {offer.status || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#1E1E1E]/80">
                          {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : 'No expiry'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditModal(offer)}
                          className="rounded-lg border border-[#F5F5F5] px-3 py-1.5 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#FFF7D1]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Offer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#F5F5F5] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.18)] max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="p-5 border-b border-[#F5F5F5] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1E1E1E]">Add Offer</h3>
              <button
                type="button"
                onClick={() => !isCreating && setIsAddOpen(false)}
                className="text-[#1E1E1E]/60 hover:text-[#1E1E1E]/80"
              >
                x
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Cafe</label>
                <select
                  value={createForm.cafeId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cafeId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                >
                  <option value="">Select cafe</option>
                  {cafes.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name || c.cafeName || "Unnamed Cafe"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Goal</label>
                <select
                  value={createForm.goalId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, goalId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                >
                  <option value="delight-customers">Delight customers</option>
                  <option value="grow-customers">Grow customers</option>
                  <option value="increase-value">Increase value</option>
                  <option value="mealtime-orders">Mealtime orders</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discount Type</label>
                <select
                  value={createForm.discountType}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, discountType: e.target.value, discountPercentage: "", discountedPrice: "" }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat-price">Flat price</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Dish / Item Name</label>
                <input
                  type="text"
                  value={createForm.dishName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, dishName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  placeholder="e.g., Paneer Burger"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Item ID (Optional)</label>
                <input
                  type="text"
                  value={createForm.itemId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, itemId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  placeholder="e.g., 65f..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={createForm.couponCode}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  placeholder="e.g., SAVE20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Original Price</label>
                <input
                  type="number"
                  min="0"
                  value={createForm.originalPrice}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, originalPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  placeholder="e.g., 199"
                />
              </div>

              {createForm.discountType === "percentage" ? (
                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={createForm.discountPercentage}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountPercentage: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                    placeholder="e.g., 20"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discounted Price</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.discountedPrice}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountedPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                    placeholder="e.g., 149"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Valid Until (Optional)</label>
                <input
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, endDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                />
              </div>
            </div>

            <div className="p-5 border-t border-[#F5F5F5] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={isCreating}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E]/80 hover:bg-[#fafafa] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={async () => {
                  if (isCreating) return
                  const cafeId = createForm.cafeId
                  const itemName = createForm.dishName.trim()
                  const couponCode = createForm.couponCode.trim()
                  const originalPrice = Number(createForm.originalPrice)

                  if (!cafeId || !itemName || !couponCode || !Number.isFinite(originalPrice) || originalPrice <= 0) {
                    alert("Please fill Cafe, Item Name, Coupon Code and a valid Original Price")
                    return
                  }

                  const payloadItem = {
                    itemId: createForm.itemId.trim() || undefined,
                    itemName,
                    originalPrice,
                    couponCode,
                  }

                  if (createForm.discountType === "percentage") {
                    const discountPercentage = Number(createForm.discountPercentage)
                    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
                      alert("Please enter a valid discount percentage (0-100)")
                      return
                    }
                    payloadItem.discountPercentage = discountPercentage
                  } else {
                    const discountedPrice = Number(createForm.discountedPrice)
                    if (!Number.isFinite(discountedPrice) || discountedPrice < 0 || discountedPrice > originalPrice) {
                      alert("Please enter a valid discounted price")
                      return
                    }
                    payloadItem.discountedPrice = discountedPrice
                  }

                  setIsCreating(true)
                  try {
                    await adminAPI.createOffer({
                      cafeId,
                      goalId: createForm.goalId,
                      discountType: createForm.discountType,
                      items: [payloadItem],
                      endDate: createForm.endDate ? new Date(createForm.endDate).toISOString() : null,
                    })
                    setIsAddOpen(false)
                    setCreateForm(prev => ({
                      ...prev,
                      cafeId: "",
                      itemId: "",
                      dishName: "",
                      couponCode: "",
                      originalPrice: "",
                      discountPercentage: "",
                      discountedPrice: "",
                      endDate: "",
                    }))
                    fetchOffers()
                  } catch (err) {
                    console.error("Error creating offer:", err)
                    alert(err?.response?.data?.message || "Failed to create offer")
                  } finally {
                    setIsCreating(false)
                  }
                }}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#e53935] text-white hover:bg-[#d32f2f] transition-all disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Offer Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#F5F5F5] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.18)] max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="p-5 border-b border-[#F5F5F5] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1E1E1E]">Edit Offer</h3>
              <button
                type="button"
                onClick={() => !isUpdating && setIsEditOpen(false)}
                className="text-[#1E1E1E]/60 hover:text-[#1E1E1E]/80"
              >
                x
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Cafe</label>
                <input
                  type="text"
                  value={editForm.cafeName}
                  readOnly
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Dish / Item Name</label>
                <input
                  type="text"
                  value={editForm.dishName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, dishName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#e53935]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discount Type</label>
                <select
                  value={editForm.discountType}
                  onChange={(e) => setEditForm(prev => ({ ...prev, discountType: e.target.value, discountPercentage: "", discountedPrice: "" }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat-price">Flat price</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={editForm.couponCode}
                  onChange={(e) => setEditForm(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Original Price</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.originalPrice}
                  onChange={(e) => setEditForm(prev => ({ ...prev, originalPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                />
              </div>

              {editForm.discountType === "percentage" ? (
                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.discountPercentage}
                    onChange={(e) => setEditForm(prev => ({ ...prev, discountPercentage: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Discounted Price</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.discountedPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, discountedPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Valid Until (Optional)</label>
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E]/80 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-[#F5F5F5] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={isUpdating}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E]/80 hover:bg-[#fafafa] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={async () => {
                  if (isUpdating) return
                  if (!editForm.offerId || editForm.itemIndex === null) {
                    alert("Offer item is missing. Please refresh and try again.")
                    return
                  }
                  if (!editForm.dishName.trim()) {
                    alert("Please enter a valid dish/item name")
                    return
                  }

                  const payload = {
                    itemIndex: editForm.itemIndex,
                    itemName: editForm.dishName.trim(),
                    discountType: editForm.discountType,
                    couponCode: editForm.couponCode.trim(),
                    originalPrice: Number(editForm.originalPrice),
                    endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
                    status: editForm.status,
                  }

                  if (editForm.discountType === "percentage") {
                    payload.discountPercentage = Number(editForm.discountPercentage)
                  } else {
                    payload.discountedPrice = Number(editForm.discountedPrice)
                  }

                  setIsUpdating(true)
                  try {
                    const updateResponse = await adminAPI.updateOfferItem(editForm.offerId, payload)
                    const updatedItem = updateResponse?.data?.data?.item || null
                    const updatedItemName = updatedItem?.itemName || payload.itemName || editForm.dishName

                    setOffers((prev) => {
                      if (!Array.isArray(prev)) return prev
                      return prev.map((offer) => {
                        if (offer.offerId !== editForm.offerId) return offer
                        if (offer.itemIndex !== editForm.itemIndex) return offer
                        return {
                          ...offer,
                          dishName: updatedItemName,
                          couponCode: payload.couponCode,
                          originalPrice: payload.originalPrice,
                          discountPercentage: payload.discountPercentage ?? offer.discountPercentage,
                          discountedPrice: payload.discountedPrice ?? offer.discountedPrice,
                          discountType: payload.discountType,
                          endDate: payload.endDate || null,
                          status: payload.status || offer.status,
                        }
                      })
                    })

                    setIsEditOpen(false)
                    fetchOffers()
                  } catch (err) {
                    console.error("Error updating offer:", err)
                    alert(err?.response?.data?.message || "Failed to update offer")
                  } finally {
                    setIsUpdating(false)
                  }
                }}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#e53935] text-white hover:bg-[#d32f2f] transition-all disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : "Update Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
