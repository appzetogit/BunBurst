import { X } from "lucide-react"

const STATUS_OPTIONS = [
  "All",
  "Ordered",
  "Cafe Accepted",
  "Delivery Boy Assigned",
  "Delivery Boy Reached Pickup",
  "Order ID Accepted",
  "Reached Drop",
  "Ordered Delivered",
  "Rejected",
]

export default function OrderDetectDeliveryFilterPanel({
  isOpen,
  onClose,
  filters,
  setFilters,
  onApply,
  onReset,
  cafes = [],
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Filter Orders</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters(prev => ({ ...prev, status: status === "All" ? "" : status }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.status === status || (status === "All" && !filters.status)
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Delivery Assignment
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", value: "" },
                { label: "Assigned", value: "assigned" },
                { label: "Not Assigned", value: "unassigned" },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => setFilters(prev => ({ ...prev, deliveryAssignment: option.value }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.deliveryAssignment === option.value
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cafe
            </label>
            {cafes.length > 0 ? (
              <select
                value={filters.cafe || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, cafe: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Cafes</option>
                {cafes.map((cafe) => (
                  <option key={cafe} value={cafe}>{cafe}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={filters.cafe || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, cafe: e.target.value }))}
                placeholder="Enter cafe name"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Date Between
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={filters.fromDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="date"
                value={filters.toDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
          >
            Clear filters
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
