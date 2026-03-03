import { X } from "lucide-react"

export default function FilterPanel({ isOpen, onClose, filters, setFilters, onApply, onReset, restaurants = [] }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#F5F5F5] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1E1E1E]">Filter Orders</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#1E1E1E]" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Payment Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
              Payment Status
            </label>
            <div className="flex flex-wrap gap-2">
              {["All", "Paid", "Unpaid", "Failed", "Refunded"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters(prev => ({ ...prev, paymentStatus: status === "All" ? "" : status }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.paymentStatus === status || (status === "All" && !filters.paymentStatus)
                      ? "bg-[#e53935] text-white shadow-md"
                      : "bg-[#F5F5F5] text-[#1E1E1E] hover:bg-[#ececec]"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Type Filter */}
          <div>
            <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
              Delivery Type
            </label>
            <div className="flex flex-wrap gap-2">
              {["All", "Home Delivery", "Take Away", "Dine In"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilters(prev => ({ ...prev, deliveryType: type === "All" ? "" : type }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.deliveryType === type || (type === "All" && !filters.deliveryType)
                      ? "bg-[#e53935] text-white shadow-md"
                      : "bg-[#F5F5F5] text-[#1E1E1E] hover:bg-[#ececec]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                Min Amount ($)
              </label>
              <input
                type="number"
                value={filters.minAmount || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC400]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                Max Amount ($)
              </label>
              <input
                type="number"
                value={filters.maxAmount || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                placeholder="10000"
                className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC400]"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.fromDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC400]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.toDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC400]"
              />
            </div>
          </div>

          {/* Restaurant Filter */}
          {restaurants.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                Restaurant
              </label>
              <select
                value={filters.restaurant || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC400]"
              >
                <option value="">All Restaurants</option>
                {restaurants.map((rest) => (
                  <option key={rest} value={rest}>{rest}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#F5F5F5] border-t border-[#F5F5F5] px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#f9f9f9] transition-all"
          >
            Reset
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#d32f2f] transition-all shadow-md"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}

