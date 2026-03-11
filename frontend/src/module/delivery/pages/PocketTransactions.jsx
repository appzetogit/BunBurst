import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
    ArrowLeft,
    ChevronRight,
    History,
    TrendingDown,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    FileText,
    AlertCircle
} from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"

const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

export default function PocketTransactions() {
    const navigate = useNavigate()
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState({
        totalCollected: 0,
        totalSubmitted: 0,
        pendingCash: 0
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const [sumRes, transRes] = await Promise.all([
                    deliveryAPI.getPocketSummary(),
                    deliveryAPI.getPocketTransactions({ limit: 50 })
                ])

                if (sumRes.data?.success) {
                    setSummary(sumRes.data.data.wallet)
                }

                if (transRes.data?.success) {
                    setTransactions(transRes.data.data.transactions)
                }
            } catch (error) {
                console.error("Error fetching pocket transactions:", error)
                toast.error("Failed to load transactions")
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-6">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Cash Transactions</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Quick Summary Card */}
                <div className="bg-black text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Total pending to submit</p>
                            <h2 className="text-3xl font-bold">{formatCurrency(summary.pendingCash)}</h2>
                        </div>
                        <div className="bg-white/10 p-2 rounded-full">
                            <History className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Total Collected</p>
                            <p className="text-sm font-bold text-white">{formatCurrency(summary.totalCollectedCash)}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Total Submitted</p>
                            <p className="text-sm font-bold text-green-400">{formatCurrency(summary.totalSubmittedCash)}</p>
                        </div>
                    </div>

                    {/* Decorative background circle */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                </div>

                {/* Transactions List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Recent History</h3>
                        <span className="text-[10px] text-gray-400 font-medium">SHOWING LAST 50</span>
                    </div>

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <Clock className="w-8 h-8 text-yellow-500 animate-spin mb-3" />
                            <p className="text-sm text-gray-500">Retrieving transactions...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300">
                            <FileText className="w-12 h-12 text-gray-200 mb-4" />
                            <p className="text-gray-500 font-medium">No transactions yet</p>
                            <p className="text-gray-400 text-xs mt-1">Cash collections from COD will appear here</p>
                        </div>
                    ) : (
                        transactions.map((tx) => (
                            <div
                                key={tx._id}
                                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-full ${tx.type === 'credit' ? 'bg-blue-50' : 'bg-green-50'}`}>
                                        {tx.type === 'credit' ? (
                                            <TrendingUp className="w-5 h-5 text-blue-600" />
                                        ) : (
                                            <TrendingDown className="w-5 h-5 text-green-600" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-gray-900">
                                                {tx.type === 'credit' ? 'Cash Collected' : 'Settlement'}
                                            </p>
                                            {tx.status === 'Completed' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                            ) : tx.status === 'Failed' ? (
                                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                                            ) : (
                                                <Clock className="w-3.5 h-3.5 text-yellow-500" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            {new Date(tx.createdAt).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                        <p className="text-[11px] text-gray-600 mt-1 line-clamp-1 max-w-[180px]">
                                            {tx.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${tx.type === 'credit' ? 'text-gray-900' : 'text-green-600'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                        {tx.status}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-yellow-900">Information for delivery partners</p>
                        <p className="text-[10px] text-yellow-800 leading-relaxed">
                            All "Cash Collected" transactions must be settled at the admin office periodically. Failure to settle balance may result in account suspension according to our policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
