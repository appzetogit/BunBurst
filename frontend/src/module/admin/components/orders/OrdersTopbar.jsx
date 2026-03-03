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
}) {
  const navigate = useNavigate()
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1E1E1E] flex items-center gap-2">
            {title}
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#FFC400] text-[#1E1E1E]">
              {count}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search your order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-12 py-2.5 w-full sm:w-80 text-sm rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-[#F5F5F5]">
              <Search className="w-4 h-4 text-[#1E1E1E]" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#e53935] bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                <span className="text-white font-bold">Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-[#F5F5F5] rounded-lg shadow-lg z-50">
              <DropdownMenuLabel className="text-[#1E1E1E]">Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport("excel")} className="cursor-pointer">
                <div className="w-6 h-6 rounded-md bg-[#FFF8E1] flex items-center justify-center mr-3">
                  <FileSpreadsheet className="w-4 h-4 text-[#1E1E1E]" />
                </div>
                <span className="text-[#1E1E1E]">Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("pdf")} className="cursor-pointer">
                <div className="w-6 h-6 rounded-md bg-[#FFF8E1] flex items-center justify-center mr-3">
                  <FileText className="w-4 h-4 text-[#1E1E1E]" />
                </div>
                <span className="text-[#1E1E1E]">PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onFilterClick}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-[#e53935] bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2 transition-all relative ${activeFiltersCount > 0 ? "ring-2 ring-[#FFC400]" : ""
              }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-white font-bold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FFC400] text-[#1E1E1E] rounded-full text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2.5 rounded-lg border border-[#e53935] bg-[#e53935] hover:bg-[#d32f2f] text-white transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

