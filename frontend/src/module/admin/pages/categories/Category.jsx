import { useState, useMemo, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Download, ChevronDown, Plus, Edit, Trash2, Info, MapPin, SlidersHorizontal, ArrowDownUp, Timer, Star, IndianRupee, UtensilsCrossed, BadgePercent, ShieldCheck, X, Loader2, Upload, Sparkles, LayoutGrid, FileText, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const normalizeSearchValue = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim()

export default function Category() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [sortBy, setSortBy] = useState(null)
  const [selectedCuisine, setSelectedCuisine] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [activeScrollSection, setActiveScrollSection] = useState('sort')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    image: "https://via.placeholder.com/40",
    status: true,
    type: ""
  })
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)

  // Simple filter toggle function
  const toggleFilter = (filterId) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
  }

  // Fetch categories from API
  useEffect(() => {
    // Check if admin is authenticated
    const adminToken = localStorage.getItem('admin_accessToken')
    if (!adminToken) {
      console.warn('No admin token found. User may need to login.')
      toast.error('Please login to access categories')
      setLoading(false)
      return
    }

    // Log API base URL for debugging
    console.log('API Base URL:', API_BASE_URL)
    console.log('Admin Token:', adminToken ? 'Present' : 'Missing')

    fetchCategories()
  }, [])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCategories()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setActiveScrollSection(sectionId)
            setActiveFilterTab(sectionId)
          }
        }
      })
    }, observerOptions)

    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isFilterOpen])

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoading(true)
      const params = {}
      const normalizedQuery = normalizeSearchValue(searchQuery)
      if (normalizedQuery) params.search = normalizedQuery

      const response = await adminAPI.getCategories(params)
      if (response.data.success) {
        setCategories(response.data.data.categories || [])
      } else {
        toast.error(response.data.message || 'Failed to load categories')
        setCategories([])
      }
    } catch (error) {
      // More detailed error logging
      console.error('Error fetching categories:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null,
        request: error.request ? {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        } : null
      })

      if (error.response) {
        // Server responded with error status
        const status = error.response.status
        const errorData = error.response.data

        if (status === 401) {
          toast.error('Authentication required. Please login again.')
        } else if (status === 403) {
          toast.error('Access denied. You do not have permission.')
        } else if (status === 404) {
          toast.error('Categories endpoint not found. Please check backend server.')
        } else if (status >= 500) {
          toast.error('Server error. Please try again later.')
        } else {
          toast.error(errorData?.message || `Error ${status}: Failed to load categories`)
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('Network error - No response from server')
        console.error('Request URL:', error.config?.baseURL + error.config?.url)
        toast.error('Cannot connect to server. Please check if backend is running on ' + API_BASE_URL.replace('/api', ''))
      } else {
        // Something else happened
        console.error('Request setup error:', error.message)
        toast.error(error.message || 'Failed to load categories')
      }

      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = useMemo(() => {
    let result = [...categories]

    const query = normalizeSearchValue(searchQuery)
    if (query) {
      result = result.filter(cat =>
        normalizeSearchValue(cat.name).includes(query) ||
        normalizeSearchValue(cat.id).includes(query)
      )
    }

    return result
  }, [categories, searchQuery])

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleCategoryStatus(id)
      if (response.data.success) {
        toast.success('Category status updated successfully')
        // Update local state immediately for better UX
        setCategories(prevCategories =>
          prevCategories.map(cat =>
            cat.id === id ? { ...cat, status: !cat.status } : cat
          )
        )
        // Refresh from server to ensure consistency
        setTimeout(() => fetchCategories(), 500)
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      const errorMessage = error.response?.data?.message || 'Failed to update category status'
      toast.error(errorMessage)
    }
  }


  const handleDelete = async (id) => {
    const categoryName = categories.find(cat => cat.id === id)?.name || 'this category'
    if (window.confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      try {
        const response = await adminAPI.deleteCategory(id)
        if (response.data.success) {
          toast.success('Category deleted successfully')
          // Remove from local state immediately for better UX
          setCategories(prevCategories => prevCategories.filter(cat => cat.id !== id))
          // Refresh from server to ensure consistency
          setTimeout(() => fetchCategories(), 500)
        }
      } catch (error) {
        console.error('Error deleting category:', error)
        const errorMessage = error.response?.data?.message || 'Failed to delete category'
        toast.error(errorMessage)
      }
    }
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name || "",
      image: category.image || "https://via.placeholder.com/40",
      status: category.status !== undefined ? category.status : true,
      type: category.type || ""
    })
    setSelectedImageFile(null)
    setImagePreview(category.image || null)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingCategory(null)
    setFormData({
      name: "",
      image: "https://via.placeholder.com/40",
      status: true,
      type: ""
    })
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setIsModalOpen(true)
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const now = new Date()
      const generatedOn = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const generatedAt = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })

      const getCategoryId = (category) =>
        category?.id ||
        category?._id ||
        category?.categoryId ||
        category?.category_id ||
        'N/A'

      const getCategoryType = (category) =>
        category?.type ||
        category?.categoryType ||
        category?.category_type ||
        'N/A'

      const isCategoryActive = (category) => {
        if (typeof category?.status === 'boolean') return category.status
        if (typeof category?.isActive === 'boolean') return category.isActive
        if (typeof category?.status === 'string') {
          const normalized = category.status.toLowerCase()
          return normalized === 'active' || normalized === 'true'
        }
        return false
      }

      const totalCount = filteredCategories.length
      const activeCount = filteredCategories.filter((category) => isCategoryActive(category)).length
      const inactiveCount = totalCount - activeCount

      // Top accent header
      doc.setFillColor(229, 57, 53)
      doc.rect(0, 0, pageWidth, 28, 'F')

      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text('Category Dashboard Export', 14, 18)

      doc.setFontSize(10)
      doc.setTextColor(245, 245, 245)
      doc.text(`Generated on ${generatedOn} at ${generatedAt}`, 14, 24)

      // Summary row
      doc.setFillColor(250, 250, 250)
      doc.roundedRect(14, 34, pageWidth - 28, 20, 3, 3, 'F')
      doc.setFontSize(10)
      doc.setTextColor(55, 65, 81)
      doc.text(`Total: ${totalCount}`, 20, 46)
      doc.text(`Active: ${activeCount}`, 60, 46)
      doc.text(`Inactive: ${inactiveCount}`, 100, 46)
      doc.text(`Search: ${searchQuery.trim() || 'All categories'}`, 140, 46)

      // Prepare table data
      const tableData = filteredCategories.map((category, index) => [
        category.sl || index + 1,
        category.name || 'N/A',
        getCategoryType(category),
        isCategoryActive(category) ? 'Active' : 'Inactive',
        getCategoryId(category)
      ])

      // Add table
      autoTable(doc, {
        startY: 60,
        head: [['SL', 'Category Name', 'Type', 'Status', 'ID']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [229, 57, 53],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30],
          cellPadding: { top: 3, right: 3, bottom: 3, left: 3 }
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252]
        },
        styles: {
          lineColor: [230, 230, 230],
          lineWidth: 0.25,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 56 },
          2: { cellWidth: 34 },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 62 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const statusValue = String(data.cell.raw || '').toLowerCase()
            if (statusValue === 'active') {
              data.cell.styles.textColor = [22, 163, 74]
            } else if (statusValue === 'inactive') {
              data.cell.styles.textColor = [220, 38, 38]
            }
          }
        },
        margin: { left: 14, right: 14 }
      })

      // Add footer
      const pageCount = doc.internal.pages.length - 1
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        )
        doc.text('Bun Burst - Category Report', 14, pageHeight - 8)
      }

      // Save PDF
      const fileName = `Categories_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

      toast.success('PDF exported successfully!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Failed to export PDF')
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.")
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit.")
      return
    }

    // Set file and create preview
    setSelectedImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setSelectedImageFile(null)
    setImagePreview(null)
    setFormData({
      name: "",
      image: "https://via.placeholder.com/40",
      status: true,
      type: ""
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setUploadingImage(true)

      // Prepare FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      formDataToSend.append('type', formData.type)
      formDataToSend.append('status', formData.status.toString())

      // Add image file if selected, otherwise use existing image URL
      if (selectedImageFile) {
        formDataToSend.append('image', selectedImageFile)
      } else if (formData.image && formData.image !== 'https://via.placeholder.com/40') {
        // If no new file but existing image URL, send it as string
        formDataToSend.append('image', formData.image)
      }

      console.log('Sending category data:', {
        name: formData.name,
        type: formData.type,
        status: formData.status,
        hasImageFile: !!selectedImageFile,
        imageUrl: formData.image
      })

      if (editingCategory) {
        const response = await adminAPI.updateCategory(editingCategory.id, formDataToSend)
        console.log('Category update response:', response.data)
        if (response.data.success) {
          toast.success('Category updated successfully')
          // Update local state immediately for better UX
          const updatedCategory = response.data.data.category
          setCategories(prevCategories =>
            prevCategories.map(cat =>
              cat.id === editingCategory.id
                ? { ...cat, ...updatedCategory, id: updatedCategory.id || cat.id }
                : cat
            )
          )
        }
      } else {
        const response = await adminAPI.createCategory(formDataToSend)
        console.log('Category create response:', response.data)
        if (response.data.success) {
          toast.success('Category created successfully')
        }
      }

      // Close modal and reset form
      handleCloseModal()

      // Refresh from server to ensure consistency
      setTimeout(() => fetchCategories(), 500)
    } catch (error) {
      console.error('Error saving category:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null,
        request: error.request ? {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        } : null
      })

      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        toast.error('Cannot connect to server. Please check if backend is running on ' + API_BASE_URL.replace('/api', ''))
      } else if (error.response) {
        toast.error(error.response.data?.message || `Error ${error.response.status}: Failed to save category`)
      } else {
        toast.error(error.message || 'Failed to save category')
      }
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 bg-white min-h-screen">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-sm border border-[#F5F5F5] p-8 mb-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#e53935] flex items-center justify-center shadow-lg shadow-[#e53935]/20 ring-4 ring-[#F5F5F5]">
              <LayoutGrid className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1E1E1E] tracking-tight">Category Dashboard</h1>
              <p className="text-[#1E1E1E]/60 font-medium flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-[#FFC400]" />
                Manage and organize your menu categories
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative group">
              <Input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-6 w-full lg:w-[280px] rounded-2xl border-[#F5F5F5] bg-white group-hover:bg-white group-focus:bg-white transition-all shadow-none focus:ring-[#e53935]/20"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E1E1E]/45 group-hover:text-[#e53935] transition-colors" />
            </div>

            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={filteredCategories.length === 0}
              className="py-6 px-6 rounded-2xl border-[#F5F5F5] text-[#1E1E1E] hover:bg-[#fff8f7] font-semibold gap-2 transition-all border-2"
            >
              <FileText className="w-5 h-5" />
              <span>Export</span>
            </Button>

            <Button
              onClick={handleAddNew}
              className="bg-[#e53935] hover:bg-[#c62828] text-white py-6 px-8 rounded-2xl shadow-xl shadow-[#e53935]/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
              New Category
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-3 mb-6">
        <div className="flex flex-col gap-1.5">
          {/* Row 1 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsFilterOpen(true)}
              className="h-5 px-1.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 transition-all bg-white border border-[#F5F5F5] hover:bg-[#fff8f7]"
            >
              <SlidersHorizontal className="h-2.5 w-2.5" />
              <span className="text-[10px] font-bold text-[#1E1E1E]">Filters</span>
            </Button>
            {[
              { id: 'delivery-under-30', label: 'Under 30 mins' },
              { id: 'delivery-under-45', label: 'Under 45 mins' },
            ].map((filter) => {
              const isActive = activeFilters.has(filter.id)
              return (
                <Button
                  key={filter.id}
                  variant="outline"
                  onClick={() => toggleFilter(filter.id)}
                  className={`h-5 px-1.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${isActive
                    ? 'bg-[#e53935] text-white border border-[#e53935] hover:bg-[#c62828]'
                    : 'bg-white border border-[#F5F5F5] hover:bg-[#fff8f7]'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-[#1E1E1E]'}`}>{filter.label}</span>
                </Button>
              )
            })}
          </div>

          {/* Row 2 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'distance-under-1km', label: 'Under 1km', icon: MapPin },
              { id: 'distance-under-2km', label: 'Under 2km', icon: MapPin },
            ].map((filter) => {
              const Icon = filter.icon
              const isActive = activeFilters.has(filter.id)
              return (
                <Button
                  key={filter.id}
                  variant="outline"
                  onClick={() => toggleFilter(filter.id)}
                  className={`h-5 px-1.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${isActive
                    ? 'bg-[#e53935] text-white border border-[#e53935] hover:bg-[#c62828]'
                    : 'bg-white border border-[#F5F5F5] hover:bg-[#fff8f7]'
                  }`}
                >
                  {Icon && <Icon className={`h-2.5 w-2.5 ${isActive ? 'text-white' : 'text-[#1E1E1E]'}`} />}
                  <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-[#1E1E1E]'}`}>{filter.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-sm border border-[#F5F5F5] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white border-b border-[#F5F5F5]">
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">SL</th>
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Image</th>
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Title</th>
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-center text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-center text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F5]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 border-4 border-[#F5F5F5] border-t-[#e53935] rounded-full animate-spin" />
                      <p className="text-[#1E1E1E]/60 font-medium animate-pulse">Fetching categories...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center text-[#1E1E1E]/60">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-16 bg-[#FFF9E0] rounded-full flex items-center justify-center mb-2">
                        <Search className="w-8 h-8 text-[#FFC400]" />
                      </div>
                      <p className="text-[#1E1E1E] font-bold text-lg">No categories found</p>
                      <p className="text-[#1E1E1E]/60">Try adjusting your search or add a new one</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredCategories.map((category, index) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={category.id}
                      className="hover:bg-[#fff8f7] transition-all group"
                    >
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-[#1E1E1E]/45">
                        {category.sl || index + 1}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white ring-2 ring-[#F5F5F5] group-hover:ring-[#F5F5F5] transition-all">
                          <img
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/40"
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="font-bold text-[#1E1E1E] group-hover:text-[#e53935] transition-colors uppercase tracking-tight">
                          {category.name}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <Badge variant="secondary" className="bg-[#FFF9E0] text-[#FFC400] border-none px-3 py-1 rounded-lg font-semibold">
                          {category.type || 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={category.status}
                            onCheckedChange={() => handleToggleStatus(category.id)}
                            className="data-[state=checked]:bg-[#e53935]"
                          />
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                            className="w-10 h-10 rounded-xl text-[#e53935] hover:bg-[#fff8f7] hover:text-[#c62828] transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(category.id)}
                            className="w-10 h-10 rounded-xl text-[#e53935] hover:bg-[#fff8f7] hover:text-[#c62828] transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isFilterOpen && (
              <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-4 border-b">
                    <h2 className="text-lg font-bold text-[#1E1E1E]">Filters and sorting</h2>
                    <button
                      onClick={() => {
                        setActiveFilters(new Set())
                        setSortBy(null)
                        setSelectedCuisine(null)
                      }}
                      className="text-[#e53935] font-medium text-sm"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 bg-white border-r flex flex-col">
                      {[
                        { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                        { id: 'time', label: 'Time', icon: Timer },
                        { id: 'rating', label: 'Rating', icon: Star },
                        { id: 'distance', label: 'Distance', icon: MapPin },
                        { id: 'price', label: 'Dish Price', icon: IndianRupee },
                        { id: 'cuisine', label: 'Cuisine', icon: UtensilsCrossed },
                        { id: 'offers', label: 'Offers', icon: BadgePercent },
                        { id: 'trust', label: 'Trust', icon: ShieldCheck },
                      ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveFilterTab(tab.id)
                              const section = filterSectionRefs.current[tab.id]
                              if (section) {
                                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white text-[#e53935]' : 'text-[#1E1E1E]/60 hover:bg-[#fff8f7]'
                              }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e53935] rounded-r" />
                            )}
                            <Icon className="h-5 w-5" strokeWidth={1.5} />
                            <span className="text-xs font-medium leading-tight">{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Right Content Area - Scrollable */}
                    <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4">
                      {/* Sort By Tab */}
                      <div
                        ref={el => filterSectionRefs.current['sort'] = el}
                        data-section-id="sort"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Sort by</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { id: null, label: 'Relevance' },
                            { id: 'price-low', label: 'Price: Low to High' },
                            { id: 'price-high', label: 'Price: High to Low' },
                            { id: 'rating-high', label: 'Rating: High to Low' },
                            { id: 'rating-low', label: 'Rating: Low to High' },
                          ].map((option) => (
                            <button
                              key={option.id || 'relevance'}
                              onClick={() => setSortBy(option.id)}
                              className={`px-4 py-3 rounded-xl border text-left transition-colors ${sortBy === option.id
                                ? 'border-[#e53935] bg-[#fff8f7]'
                                : 'border-[#F5F5F5] hover:border-[#e53935]'
                                }`}
                            >
                              <span className={`text-sm font-medium ${sortBy === option.id ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div
                        ref={el => filterSectionRefs.current['time'] = el}
                        data-section-id="time"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Delivery Time</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => toggleFilter('delivery-under-30')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-30')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-30') ? 'text-[#e53935]' : 'text-[#1E1E1E]/70'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('delivery-under-30') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under 30 mins</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('delivery-under-45')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-45') ? 'text-[#e53935]' : 'text-[#1E1E1E]/70'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('delivery-under-45') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under 45 mins</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div
                        ref={el => filterSectionRefs.current['rating'] = el}
                        data-section-id="rating"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Restaurant Rating</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => toggleFilter('rating-35-plus')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-35-plus') ? 'text-[#e53935] fill-[#FFC400]' : 'text-[#1E1E1E]/45'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-35-plus') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Rated 3.5+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-4-plus')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-4-plus') ? 'text-[#e53935] fill-[#FFC400]' : 'text-[#1E1E1E]/45'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-4-plus') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Rated 4.0+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-45-plus')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-45-plus') ? 'text-[#e53935] fill-[#FFC400]' : 'text-[#1E1E1E]/45'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-45-plus') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Rated 4.5+</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div
                        ref={el => filterSectionRefs.current['distance'] = el}
                        data-section-id="distance"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Distance</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => toggleFilter('distance-under-1km')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-1km') ? 'text-[#e53935]' : 'text-[#1E1E1E]/70'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('distance-under-1km') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under 1 km</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('distance-under-2km')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-2km') ? 'text-[#e53935]' : 'text-[#1E1E1E]/70'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('distance-under-2km') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under 2 km</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div
                        ref={el => filterSectionRefs.current['price'] = el}
                        data-section-id="price"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Dish Price</h3>
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => toggleFilter('price-under-200')}
                            className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <span className={`text-sm font-medium ${activeFilters.has('price-under-200') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under ₹200</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-under-500')}
                            className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500')
                              ? 'border-[#e53935] bg-[#fff8f7]'
                              : 'border-[#F5F5F5] hover:border-[#e53935]'
                              }`}
                          >
                            <span className={`text-sm font-medium ${activeFilters.has('price-under-500') ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>Under ₹500</span>
                          </button>
                        </div>
                      </div>

                      {/* Cuisine Tab */}
                      <div
                        ref={el => filterSectionRefs.current['cuisine'] = el}
                        data-section-id="cuisine"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Cuisine</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {['Chinese', 'American', 'Japanese', 'Italian', 'Mexican', 'Indian', 'Asian', 'Seafood', 'Desserts', 'Cafe', 'Healthy'].map((cuisine) => (
                            <button
                              key={cuisine}
                              onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
                              className={`px-4 py-3 rounded-xl border text-center transition-colors ${selectedCuisine === cuisine
                                ? 'border-[#e53935] bg-[#fff8f7]'
                                : 'border-[#F5F5F5] hover:border-[#e53935]'
                                }`}
                            >
                              <span className={`text-sm font-medium ${selectedCuisine === cuisine ? 'text-[#e53935]' : 'text-[#1E1E1E]'}`}>
                                {cuisine}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-[#1E1E1E]">Trust Markers</h3>
                          <div className="flex flex-col gap-3">
                            <button className="px-4 py-3 rounded-xl border border-[#F5F5F5] hover:border-[#e53935] text-left transition-colors">
                              <span className="text-sm font-medium text-[#1E1E1E]">Top Rated</span>
                            </button>
                            <button className="px-4 py-3 rounded-xl border border-[#F5F5F5] hover:border-[#e53935] text-left transition-colors">
                              <span className="text-sm font-medium text-[#1E1E1E]">Trusted by 1000+ users</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 py-4 border-t bg-white">
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 py-3 text-center font-semibold text-[#1E1E1E]"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${activeFilters.size > 0 || sortBy || selectedCuisine
                        ? 'bg-[#e53935] text-white hover:bg-[#c62828]'
                        : 'bg-[#F5F5F5] text-[#1E1E1E]/60'
                        }`}
                    >
                      {activeFilters.size > 0 || sortBy || selectedCuisine
                        ? 'Show results'
                        : 'Show results'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Create/Edit Category Modal */}
      <AnimatePresence>
        <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <div className="bg-gradient-to-r from-[#e53935] to-[#e53935] p-6 text-white relative">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <LayoutGrid className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogHeader className="p-0 text-left">
                    <DialogTitle className="text-xl font-bold text-white leading-tight">
                      {editingCategory ? 'Update Category' : 'Create New Category'}
                    </DialogTitle>
                    <p className="text-white/80 text-sm mt-0.5">
                      {editingCategory ? 'Modify existing category details' : 'Organize your menu with a new section'}
                    </p>
                  </DialogHeader>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="absolute top-6 right-6 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 bg-white space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-semibold text-[#1E1E1E]">Category Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="h-11 bg-white border-[#F5F5F5] focus:ring-[#e53935]/20 focus:border-[#e53935] transition-all rounded-xl">
                      <SelectValue placeholder="Select Category Type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Starters">Starters</SelectItem>
                      <SelectItem value="Main course">Main course</SelectItem>
                      <SelectItem value="Desserts">Desserts</SelectItem>
                      <SelectItem value="Beverages">Beverages</SelectItem>
                      <SelectItem value="Varieties">Varieties</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-[#1E1E1E]">Category Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter category name"
                    required
                    className="h-11 bg-white border-[#F5F5F5] focus:bg-white focus:ring-[#e53935]/20 focus:border-[#e53935] transition-all rounded-xl"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-[#1E1E1E]">Category Image</Label>
                  <div className="flex items-start gap-4">
                    <div className="relative group w-24 h-24 rounded-2xl overflow-hidden bg-white border-2 border-dashed border-[#F5F5F5] hover:border-[#e53935] transition-all">
                      {imagePreview || formData.image ? (
                        <>
                          <img
                            src={imagePreview || formData.image}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => e.target.src = "https://via.placeholder.com/100"}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="p-1.5 bg-white text-[#e53935] rounded-lg shadow-lg scale-90 group-hover:scale-100 transition-transform"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#1E1E1E]/45"
                        >
                          <Upload className="w-6 h-6" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg h-9 bg-white border-[#F5F5F5] text-[#1E1E1E]/70"
                        >
                          Upload File
                        </Button>
                        {imagePreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveImage}
                            className="text-[#e53935] hover:text-[#c62828] hover:bg-[#fff8f7]"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-[#1E1E1E]/60 leading-relaxed font-medium">
                        Supported: PNG, JPG, JPEG, WEBP. Max size 5MB.
                        A clear icon represents your category best.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#F5F5F5] transition-all hover:bg-[#fff8f7]">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${formData.status ? 'bg-[#FFF9E0] text-[#FFC400]' : 'bg-[#F5F5F5] text-[#1E1E1E]/55'}`}>
                    <Check className={`w-4 h-4 transition-transform ${formData.status ? 'scale-110' : 'scale-90'}`} />
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-sm font-bold text-[#1E1E1E] cursor-pointer block">
                      Active Status
                    </Label>
                    <p className="text-xs text-[#1E1E1E]/60 font-medium">
                      {formData.status ? 'Category will be live' : 'Hidden from customers'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="status"
                  checked={formData.status}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked })}
                  className="data-[state=checked]:bg-[#e53935]"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseModal}
                  disabled={uploadingImage}
                  className="flex-1 h-12 rounded-xl text-[#1E1E1E]/70 hover:bg-[#fff8f7] font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-[2] h-12 bg-[#e53935] hover:bg-[#c62828] text-white font-bold rounded-xl shadow-lg shadow-[#e53935]/20 transition-all active:scale-[0.98]"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AnimatePresence>

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}


