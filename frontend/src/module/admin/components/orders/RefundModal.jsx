import { useState, useEffect } from "react"
import { Wallet, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function RefundModal({ isOpen, onOpenChange, order, onConfirm, isProcessing }) {
  const [refundAmount, setRefundAmount] = useState("")
  const [error, setError] = useState("")

  // Set default refund amount when order changes
  useEffect(() => {
    if (order && isOpen) {
      const defaultAmount = order.totalAmount || 0
      setRefundAmount(defaultAmount.toString())
      setError("")
    }
  }, [order, isOpen])

  const handleAmountChange = (e) => {
    const value = e.target.value
    // Allow only numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setRefundAmount(value)
      setError("")
    }
  }

  const handleConfirm = () => {
    const amount = parseFloat(refundAmount)
    const maxAmount = order?.totalAmount || 0

    if (!refundAmount || refundAmount.trim() === "") {
      setError("कृपया रिफंड राशि दर्ज करें")
      return
    }

    if (isNaN(amount) || amount <= 0) {
      setError("कृपया वैध राशि दर्ज करें")
      return
    }

    if (amount > maxAmount) {
      setError(`रिफंड राशि कुल राशि (₹${maxAmount.toFixed(2)}) से अधिक नहीं हो सकती`)
      return
    }

    onConfirm(amount)
  }

  const handleClose = () => {
    if (!isProcessing) {
      setRefundAmount("")
      setError("")
      onOpenChange(false)
    }
  }

  if (!order) return null

  const maxAmount = order.totalAmount || 0

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#1E1E1E]">
            <Wallet className="w-5 h-5 text-[#e53935]" />
            Wallet Refund
          </DialogTitle>
          <DialogDescription className="text-[#1E1E1E]">
            Order ID: <span className="font-semibold">{order.orderId}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1E1E1E]">
              Refund Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E1E1E] font-medium">
                ₹
              </span>
              <input
                type="text"
                value={refundAmount}
                onChange={handleAmountChange}
                placeholder="0.00"
                disabled={isProcessing}
                className={`w-full pl-8 pr-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-[#F5F5F5] focus:border-[#FFC400] focus:ring-[#FFF8E1]"
                } ${isProcessing ? "bg-[#F5F5F5] cursor-not-allowed" : "bg-white"}`}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
            <p className="text-xs text-[#1E1E1E]">
              Maximum refundable amount: ₹{maxAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-[#FFF8E1] border border-[#FFC400] rounded-lg p-3">
            <p className="text-sm text-[#1E1E1E]">
              <span className="font-semibold">Note:</span> यह राशि customer के wallet में credit हो जाएगी और order की status "Refunded" हो जाएगी।
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F5F5F5]">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !refundAmount || parseFloat(refundAmount) <= 0}
            className="px-4 py-2 bg-[#e53935] hover:bg-[#d32f2f] text-white"
          >
            {isProcessing ? "Processing..." : "Refund"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

