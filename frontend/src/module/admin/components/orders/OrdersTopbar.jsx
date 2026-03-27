import { Search, Filter, Download, ChevronDown, Settings, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileSpreadsheet, FileText } from "lucide-react"

export default function OrdersTopbar({
  title,
  count,
  searchQuery,
  setSearchQuery,
  onFilterClick,
  activeFiltersCount,
  onExport,
  onSettingsClick,
  layoutVariant = "default",
}) {
  const navigate = useNavigate()
  const isAllOrdersVariant = layoutVariant === "all-orders"
  const isCancelledVariant = layoutVariant === "cancelled-orders"
  const isRefundedVariant = layoutVariant === "refunded-orders"
  const isFeatureVariant = isAllOrdersVariant || isCancelledVariant || isRefundedVariant
  return (
    <div className={`${
      isAllOrdersVariant
        ? "mb-7 rounded-[28px] border border-[#F5F5F5] bg-white px-6 py-7 shadow-[0_16px_36px_rgba(30,30,30,0.06)]"
        : isCancelledVariant
          ? "mb-7 rounded-[28px] border border-[#F5F5F5] bg-[linear-gradient(180deg,#ffffff_0%,#fffafa_100%)] px-6 py-7 shadow-[0_16px_36px_rgba(229,57,53,0.08)]"
          : isRefundedVariant
            ? "mb-7 rounded-[28px] border border-[#F5F5F5] bg-[linear-gradient(180deg,#ffffff_0%,#f8fdff_100%)] px-6 py-7 shadow-[0_16px_36px_rgba(34,139,230,0.08)]"
          : "mb-6 rounded-xl border border-[#F5F5F5] bg-white p-6 shadow-sm"
    }`}>
      <div className={`flex flex-col gap-5 ${isFeatureVariant ? "xl:flex-row xl:items-center xl:justify-between" : "sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="flex items-center gap-3">
          <h1 className={`flex items-center gap-3 font-bold text-[#1E1E1E] ${isFeatureVariant ? "text-[2rem] leading-tight" : "text-2xl"}`}>
            <span>{title}</span>
            <span className={`font-semibold text-[#1E1E1E] ${
              isAllOrdersVariant
                ? "rounded-full bg-[#FFC400] px-4 py-2 text-base shadow-sm"
                : isCancelledVariant
                  ? "rounded-full border border-[#ffd7d6] bg-[#fff1f1] px-4 py-2 text-base shadow-sm"
                  : isRefundedVariant
                    ? "rounded-full border border-[#dceefe] bg-[#eef8ff] px-4 py-2 text-base shadow-sm"
                  : "rounded-full bg-[#FFC400] px-3 py-1 text-sm"
            }`}>
              {count}
            </span>
          </h1>
        </div>
        <div className={`flex flex-col gap-3 ${isFeatureVariant ? "lg:flex-row lg:items-center lg:justify-end lg:flex-nowrap" : "items-center"}`}>
          <div className={`relative ${isFeatureVariant ? "w-full lg:min-w-0 lg:flex-1 lg:max-w-[520px]" : "flex-1 sm:flex-initial"}`}>
            <input
              type="text"
              placeholder="Search your order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border border-[#F5F5F5] bg-white text-sm text-[#1E1E1E] transition-all focus:border-[#FFC400] focus:outline-none focus:ring-2 focus:ring-[#FFC400] ${isFeatureVariant ? "h-14 rounded-2xl pl-5 pr-14 text-base shadow-sm" : "rounded-lg py-2.5 pl-4 pr-12 sm:w-80"}`}
            />
            <button className={`absolute top-1/2 -translate-y-1/2 rounded-md hover:bg-[#F5F5F5] ${isFeatureVariant ? "right-3 p-2" : "right-2 p-1.5"}`}>
              <Search className="w-4 h-4 text-[#1E1E1E]" />
            </button>
          </div>

          <div className={`flex items-center gap-3 ${isFeatureVariant ? "shrink-0 flex-nowrap justify-end" : ""}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-2 border border-[#e53935] bg-[#e53935] text-sm font-medium text-white transition-all hover:bg-[#d32f2f] ${isFeatureVariant ? "h-14 rounded-2xl px-5 shadow-sm" : "rounded-lg px-4 py-2.5"}`}>
                  <Download className="w-4 h-4" />
                  <span className="font-bold text-white">Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 w-56 rounded-lg border border-[#F5F5F5] bg-white shadow-lg">
                <DropdownMenuLabel className="text-[#1E1E1E]">Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onExport("excel")} className="cursor-pointer">
                  <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-md bg-[#FFF8E1]">
                    <FileSpreadsheet className="w-4 h-4 text-[#1E1E1E]" />
                  </div>
                  <span className="text-[#1E1E1E]">Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("pdf")} className="cursor-pointer">
                  <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-md bg-[#FFF8E1]">
                    <FileText className="w-4 h-4 text-[#1E1E1E]" />
                  </div>
                  <span className="text-[#1E1E1E]">PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={onFilterClick}
              className={`relative flex items-center gap-2 border border-[#e53935] bg-[#e53935] text-sm font-medium text-white transition-all hover:bg-[#d32f2f] ${activeFiltersCount > 0 ? "ring-2 ring-[#FFC400]" : ""} ${isFeatureVariant ? "h-14 rounded-2xl px-5 shadow-sm" : "rounded-lg px-4 py-2.5"}`}
            >
              <Filter className="w-4 h-4" />
              <span className="font-bold text-white">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC400] text-[10px] font-bold text-[#1E1E1E]">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              onClick={onSettingsClick}
              className={`border border-[#e53935] bg-[#e53935] text-white transition-all hover:bg-[#d32f2f] ${isFeatureVariant ? "flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm" : "rounded-lg p-2.5"}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
