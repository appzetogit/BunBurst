import { useState, useEffect, useMemo } from "react"
import { Plus, Search } from "lucide-react"
import { adminAPI } from "@/lib/api"

export default function Coupons() {
  const [searchQuery, setSearchQuery] = useState("")
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [cafes, setCafes] = useState([])
  const [isCreating, setIsCreating] = useState(false)
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

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Cafe Offers & Coupons</h1>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by cafe name, dish name, or coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Offers List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Offers List
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Offer
              </button>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500 mt-4">Loading offers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-red-600 mb-1">Error</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-slate-700 mb-1">No Offers Found</p>
              <p className="text-sm text-slate-500">
                {searchQuery ? "No offers match your search criteria" : "No offers have been created yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SI</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Cafe</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Dish</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Coupon Code</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Valid Until</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredOffers.map((offer) => (
                    <tr key={`${offer.offerId}-${offer.dishId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{offer.sl}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">{offer.cafeName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{offer.dishName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {offer.couponCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {offer.discountType === 'flat-price'
                            ? `₹${offer.originalPrice - offer.discountedPrice} OFF`
                            : `${offer.discountPercentage}% OFF`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 line-through">₹{offer.originalPrice}</span>
                          <span className="text-sm font-semibold text-green-600">₹{offer.discountedPrice}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${offer.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : offer.status === 'paused'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                          {offer.status || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : 'No expiry'}
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add Offer</h3>
              <button
                type="button"
                onClick={() => !isCreating && setIsAddOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cafe</label>
                <select
                  value={createForm.cafeId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cafeId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Goal</label>
                <select
                  value={createForm.goalId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, goalId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="delight-customers">Delight customers</option>
                  <option value="grow-customers">Grow customers</option>
                  <option value="increase-value">Increase value</option>
                  <option value="mealtime-orders">Mealtime orders</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Discount Type</label>
                <select
                  value={createForm.discountType}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, discountType: e.target.value, discountPercentage: "", discountedPrice: "" }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat-price">Flat price</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Dish / Item Name</label>
                <input
                  type="text"
                  value={createForm.dishName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, dishName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Paneer Burger"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Item ID (Optional)</label>
                <input
                  type="text"
                  value={createForm.itemId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, itemId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., 65f..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={createForm.couponCode}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., SAVE20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Original Price</label>
                <input
                  type="number"
                  min="0"
                  value={createForm.originalPrice}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, originalPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., 199"
                />
              </div>

              {createForm.discountType === "percentage" ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={createForm.discountPercentage}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountPercentage: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., 20"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Discounted Price</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.discountedPrice}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, discountedPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., 149"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Valid Until (Optional)</label>
                <input
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={isCreating}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
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
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
