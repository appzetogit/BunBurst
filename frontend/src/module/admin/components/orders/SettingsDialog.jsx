import { Settings, Columns, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function SettingsDialog({ isOpen, onOpenChange, visibleColumns, toggleColumn, resetColumns, columnsConfig }) {
  const defaultColumnsConfig = {
    si: "Serial Number",
    orderId: "Order ID",
    orderDate: "Order Date",
    customer: "Customer Information",
    restaurant: "Restaurant",
    foodItems: "Food Items",
    totalAmount: "Total Amount",
    paymentType: "Payment Type",
    paymentCollectionStatus: "Payment Status",
    orderStatus: "Order Status",
    actions: "Actions",
  }

  const columnLabels = columnsConfig || defaultColumnsConfig

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[#1E1E1E]">
            <Settings className="w-5 h-5" />
            Table Settings
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1E1E1E] mb-3 flex items-center gap-2">
              <Columns className="w-4 h-4" />
              Visible Columns
            </h3>
            <div className="space-y-2">
              {Object.entries(columnLabels).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f9f9f9] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() => toggleColumn(key)}
                    className="w-4 h-4 text-[#e53935] border-[#F5F5F5] rounded focus:ring-[#FFC400]"
                  />
                  <span className="text-sm text-[#1E1E1E]">{label}</span>
                  {visibleColumns[key] && (
                    <Check className="w-4 h-4 text-[#e53935] ml-auto" />
                  )}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F5F5F5]">
            <button
              onClick={resetColumns}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#f9f9f9] transition-all"
            >
              Reset
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#d32f2f] transition-all shadow-md"
            >
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

