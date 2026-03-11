import { useState, useEffect } from "react"
import { Search, PiggyBank, Loader2, Package, X } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

const formatCurrency = (amount) => {
  if (amount == null) return "₹0.00"
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function DeliveryBoyWallet() {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const limit = 20

  // Settlement modal states
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [settlementAmount, setSettlementAmount] = useState("")
  const [settlementReference, setSettlementReference] = useState("")
  const [isSettling, setIsSettling] = useState(false)

  const fetchWallets = async (overrides = {}) => {
    const p = overrides.page ?? page
    try {
      setLoading(true)
      const res = await adminAPI.getDeliveryWallets({
        search: searchQuery.trim() || undefined,
        page: p,
        limit,
      })
      if (res?.data?.success) {
        const data = res.data.data
        setWallets(data?.wallets || [])
        setTotal(data?.pagination?.total ?? 0)
        setPages(data?.pagination?.pages ?? 1)
      } else {
        toast.error(res?.data?.message || "Failed to fetch delivery boy wallets")
        setWallets([])
      }
    } catch (err) {
      console.error("Error fetching delivery boy wallets:", err)
      toast.error(err?.response?.data?.message || "Failed to fetch delivery boy wallets")
      setWallets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallets()
  }, [page])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchWallets({ page: 1 })
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  const handleSettle = (wallet) => {
    setSelectedWallet(wallet)
    setSettlementAmount(wallet.pendingCash)
    setSettlementReference("")
    setIsSettleModalOpen(true)
  }

  const submitSettlement = async () => {
    if (!settlementAmount || settlementAmount <= 0) {
      return toast.error("Please enter a valid amount")
    }

    if (settlementAmount > selectedWallet.pendingCash) {
      return toast.error("Settlement amount cannot exceed pending cash")
    }

    try {
      setIsSettling(true)
      const res = await adminAPI.settleDeliveryWallet({
        deliveryBoyId: selectedWallet?.deliveryIdString || selectedWallet?.deliveryBoyId || selectedWallet?.deliveryId,
        amount: parseFloat(settlementAmount),
        reference: settlementReference.trim()
      })

      if (res?.data?.success) {
        toast.success("Settlement recorded successfully")
        setIsSettleModalOpen(false)
        fetchWallets()
      } else {
        toast.error(res?.data?.message || "Failed to record settlement")
      }
    } catch (err) {
      console.error("Error submitting settlement:", err)
      toast.error(err?.response?.data?.message || "Something went wrong")
    } finally {
      setIsSettling(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-white min-h-screen text-[#1E1E1E]">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
          <div className="flex items-center gap-3">
            <PiggyBank className="w-5 h-5 text-[#e53935]" />
            <h1 className="text-2xl font-bold text-[#1E1E1E]">Cash Settlements</h1>
          </div>
          <p className="text-sm text-[#1E1E1E] mt-1">
            Track COD cash collected and settlements for each delivery boy.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1E1E1E]">Wallets</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#FFC400] text-[#1E1E1E]">
                {total}
              </span>
            </div>
            <div className="relative flex-1 sm:flex-initial min-w-[200px] max-w-xs">
              <input
                type="text"
                placeholder="Search by name, ID, phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#F5F5F5] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E1E1E]" />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#e53935] mx-auto mb-4" />
              <p className="text-[#1E1E1E]">Loading wallets…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white border-b border-[#F5F5F5]">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Total Collected (COD)</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Total Submitted</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#FFC400] uppercase tracking-wider">Pending Cash</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#F5F5F5]">
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-16 h-16 text-[#1E1E1E] mb-4" />
                          <p className="text-lg font-semibold text-[#1E1E1E]">No wallets</p>
                          <p className="text-sm text-[#1E1E1E]">No delivery boys found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w, i) => (
                      <tr key={w.walletId || w.deliveryId} className="hover:bg-white transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">{(page - 1) * limit + i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">{w.name || w?.deliveryBoyId?.name || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">{w.deliveryIdString || w?.deliveryBoyId?.deliveryId || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">{formatCurrency(w.totalCollectedCash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">{formatCurrency(w.totalSubmittedCash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#FFC400] font-bold">{formatCurrency(w.pendingCash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E1E1E]">
                          <button
                            onClick={() => handleSettle(w)}
                            disabled={!w.pendingCash || w.pendingCash <= 0}
                            className="px-3 py-1.5 bg-[#e53935] text-white text-xs font-bold rounded-lg hover:bg-[#c62828] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            SETTLE
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F5F5F5]">
              <p className="text-sm text-[#1E1E1E]">
                Page {page} of {pages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settlement Modal */}
        {isSettleModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-[#F5F5F5] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-6 border-b border-[#F5F5F5]">
                <h3 className="text-xl font-bold text-[#1E1E1E]">COD Cash Settlement</h3>
                <button
                  onClick={() => setIsSettleModalOpen(false)}
                  className="p-2 hover:bg-[#FFC400] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#1E1E1E]" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E] mb-1.5">Delivery Boy</label>
                  <div className="px-4 py-3 bg-white rounded-lg border border-[#F5F5F5] text-[#1E1E1E] font-medium">
                    {(selectedWallet?.name || selectedWallet?.deliveryBoyId?.name || "—")} ({selectedWallet?.deliveryIdString || selectedWallet?.deliveryBoyId?.deliveryId || "—"})
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1E1E1E] mb-1.5">Pending Cash</label>
                    <div className="px-4 py-3 bg-[#FFF7D6] rounded-lg border border-[#FFC400] text-[#FFC400] font-bold">
                      {formatCurrency(selectedWallet?.pendingCash)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1E1E1E] mb-1.5">Settlement Amount</label>
                    <input
                      type="number"
                      value={settlementAmount}
                      onChange={(e) => setSettlementAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 bg-white rounded-lg border border-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] font-bold text-[#1E1E1E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1E1E1E] mb-1.5">Reference / Notes</label>
                  <textarea
                    value={settlementReference}
                    onChange={(e) => setSettlementReference(e.target.value)}
                    placeholder="Transaction ID, Date, etc."
                    className="w-full px-4 py-3 bg-white rounded-lg border border-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-sm h-24 resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-white border-t border-[#F5F5F5] flex gap-3">
                <button
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-[#1E1E1E] bg-white border border-[#F5F5F5] rounded-xl hover:bg-white transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={submitSettlement}
                  disabled={isSettling}
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-[#e53935] rounded-xl hover:bg-[#c62828] transition-colors shadow-lg shadow-[0_10px_20px_rgba(255,196,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSettling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      SETTLING...
                    </>
                  ) : (
                    "CONFIRM SETTLEMENT"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


