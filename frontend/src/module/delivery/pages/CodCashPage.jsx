import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { deliveryAPI } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "../../cafe/utils/currency"
import { ArrowLeft } from "lucide-react"

const EMPTY_SUMMARY = {
  totalCollectedCash: 0,
  totalSubmittedCash: 0,
  pendingCash: 0
}

const SOURCE_LABELS = {
  COD_ORDER: "COD Order",
  SETTLEMENT: "Settlement"
}

const TYPE_LABELS = {
  credit: "Credit",
  debit: "Debit"
}

export default function CodCashPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [summaryRes, txRes] = await Promise.all([
        deliveryAPI.getPocketSummary(),
        deliveryAPI.getPocketTransactions({ limit: 50 })
      ])

      const pocket = summaryRes?.data?.data || summaryRes?.data || {}
      const txList = txRes?.data?.data?.transactions || txRes?.data?.transactions || []

      setSummary({
        totalCollectedCash: Number(pocket.totalCollectedCash) || 0,
        totalSubmittedCash: Number(pocket.totalSubmittedCash) || 0,
        pendingCash: Number(pocket.pendingCash) || 0
      })
      setTransactions(Array.isArray(txList) ? txList : [])
    } catch (error) {
      console.error("Error loading COD cash data:", error)
      setSummary(EMPTY_SUMMARY)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleRefresh = () => loadData()
    window.addEventListener("deliveryWalletStateUpdated", handleRefresh)
    window.addEventListener("storage", handleRefresh)
    return () => {
      window.removeEventListener("deliveryWalletStateUpdated", handleRefresh)
      window.removeEventListener("storage", handleRefresh)
    }
  }, [])

  return (
    <div className="w-full min-h-screen bg-gray-100">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold">COD Cash Collection</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Cash Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cash Collected</span>
                <span className="font-semibold">{formatCurrency(summary.totalCollectedCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cash Submitted to Admin</span>
                <span className="font-semibold">{formatCurrency(summary.totalSubmittedCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Cash to Submit</span>
                <span className="font-semibold">{formatCurrency(summary.pendingCash)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Transaction History</h2>
              {loading && <span className="text-xs text-gray-500">Loading...</span>}
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">No transactions found.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const type = String(tx?.type || "").toLowerCase()
                  const source = String(tx?.source || "").toUpperCase()
                  const amount = Number(tx?.amount) || 0
                  const orderId = tx?.orderId?.orderId || tx?.orderId || "-"
                  const dateValue = tx?.createdAt || tx?.date
                  const dateLabel = dateValue ? new Date(dateValue).toLocaleString() : "-"
                  return (
                    <div key={tx?._id || `${type}-${dateLabel}-${amount}`} className="flex items-start justify-between text-sm border-b border-gray-100 pb-3">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-800">
                          {TYPE_LABELS[type] || "Transaction"}
                        </div>
                        <div className="text-gray-600">
                          {SOURCE_LABELS[source] || source || "Unknown"}
                          {orderId !== "-" ? ` • ${orderId}` : ""}
                        </div>
                        <div className="text-xs text-gray-400">{dateLabel}</div>
                      </div>
                      <div className={`font-semibold ${type === "debit" ? "text-red-600" : "text-green-600"}`}>
                        {type === "debit" ? "-" : "+"}{formatCurrency(amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
