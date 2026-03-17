import { useState, useEffect, useRef } from "react"
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, ArrowUp, ArrowDown, Layout, Link as LinkIcon, Tag, UtensilsCrossed, FileText, Edit, X, CalendarDays, Clock3, Table2, Users, Info } from "lucide-react"
import api from "@/lib/api"
import { getModuleToken } from "@/lib/utils/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function DiningManagement() {
    const [activeTab, setActiveTab] = useState('categories')

    // Categories
    const [categories, setCategories] = useState([])
    const [categoriesLoading, setCategoriesLoading] = useState(true)
    const [categoriesUploading, setCategoriesUploading] = useState(false)
    const [categoriesDeleting, setCategoriesDeleting] = useState(null)
    const [categoryName, setCategoryName] = useState("")
    const [categoryFile, setCategoryFile] = useState(null)
    const categoryFileInputRef = useRef(null)

    // Banners
    const [banners, setBanners] = useState([])
    const [bannersLoading, setBannersLoading] = useState(true)
    const [bannersUploading, setBannersUploading] = useState(false)
    const [bannersDeleting, setBannersDeleting] = useState(null)
    const [bannerFile, setBannerFile] = useState(null)
    const [bannerPercentageOff, setBannerPercentageOff] = useState("")
    const [bannerTagline, setBannerTagline] = useState("")
    const [bannerCafe, setBannerCafe] = useState("")
    const [cafesList, setCafesList] = useState([])
    const [editingBannerId, setEditingBannerId] = useState(null)
    const bannerFileInputRef = useRef(null)

    // Stories
    const [stories, setStories] = useState([])
    const [storiesLoading, setStoriesLoading] = useState(true)
    const [storiesUploading, setStoriesUploading] = useState(false)
    const [storiesDeleting, setStoriesDeleting] = useState(null)
    const [storyName, setStoryName] = useState("")
    const [storyFile, setStoryFile] = useState(null)
    const [editingStoryId, setEditingStoryId] = useState(null)
    const storyFileInputRef = useRef(null)

    // Reservations config
    const [configCafeId, setConfigCafeId] = useState("")
    const [configLoading, setConfigLoading] = useState(false)
    const [configData, setConfigData] = useState({ availableDates: [], timeSlots: [], tables: [] })
    const [dateRangeStart, setDateRangeStart] = useState("")
    const [dateRangeEnd, setDateRangeEnd] = useState("")
    const [dateSubmitting, setDateSubmitting] = useState(false)
    const [dateProgress, setDateProgress] = useState({ done: 0, total: 0, active: false })
    const [slotDateInput, setSlotDateInput] = useState("")
    const [slotStartTime, setSlotStartTime] = useState("")
    const [slotEndTime, setSlotEndTime] = useState("")
    const [pendingSlots, setPendingSlots] = useState([])
    const [slotSubmitting, setSlotSubmitting] = useState(false)
    const [tableNumber, setTableNumber] = useState("")
    const [tableCapacity, setTableCapacity] = useState("")
    const [tableSubmitting, setTableSubmitting] = useState(false)

    // Booking requests
    const [bookingRequests, setBookingRequests] = useState([])
    const [bookingRequestsLoading, setBookingRequestsLoading] = useState(false)
    const [bookingActionLoading, setBookingActionLoading] = useState(null)
    const [selectedBookingInfo, setSelectedBookingInfo] = useState(null)

    const getTodayInputValue = () => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, "0")
        const day = String(now.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }

    // Common
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const getAuthConfig = (additionalConfig = {}) => {
        const adminToken = getModuleToken('admin')
        if (!adminToken) return additionalConfig
        return {
            ...additionalConfig,
            headers: {
                ...additionalConfig.headers,
                Authorization: `Bearer ${adminToken.trim()}`,
            }
        }
    }

    useEffect(() => {
        fetchCategories()
        fetchBanners()
        fetchStories()
        fetchCafesList()
    }, [])

    useEffect(() => {
        if (configCafeId) {
            fetchDiningConfig(configCafeId)
        } else {
            setConfigData({ availableDates: [], timeSlots: [], tables: [] })
        }
    }, [configCafeId])

    useEffect(() => {
        fetchBookingRequests()
    }, [])

    // ==================== CATEGORIES ====================
    const fetchCategories = async () => {
        try {
            setCategoriesLoading(true)
            const response = await api.get('/admin/dining/categories', getAuthConfig())
            if (response.data.success) setCategories(response.data.data.categories)
        } catch (err) { console.error(err) } finally { setCategoriesLoading(false) }
    }

    const handleCreateCategory = async () => {
        if (!categoryName || !categoryFile) return setError("Name and Image are required")
        try {
            setCategoriesUploading(true)
            const formData = new FormData()
            formData.append('name', categoryName)
            formData.append('image', categoryFile)

            const response = await api.post('/admin/dining/categories', formData, getAuthConfig({
                headers: { 'Content-Type': 'multipart/form-data' }
            }))

            if (response.data.success) {
                setSuccess("Category created successfully")
                setCategoryName("")
                setCategoryFile(null)
                if (categoryFileInputRef.current) categoryFileInputRef.current.value = ""
                fetchCategories()
            }
        } catch (err) { setError(err.response?.data?.message || "Failed to create category") }
        finally { setCategoriesUploading(false) }
    }

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("Delete this category?")) return
        try {
            setCategoriesDeleting(id)
            await api.delete(`/admin/dining/categories/${id}`, getAuthConfig())
            fetchCategories()
            setSuccess("Category deleted")
        } catch (err) { setError("Failed to delete category") }
        finally { setCategoriesDeleting(null) }
    }

    // ==================== BANNERS ====================
    const fetchBanners = async () => {
        try {
            setBannersLoading(true)
            const response = await api.get('/admin/dining/offer-banners', getAuthConfig())
            if (response.data.success) setBanners(response.data.data.banners)
        } catch (err) { console.error(err) } finally { setBannersLoading(false) }
    }

    const fetchCafesList = async () => {
        try {
            const response = await api.get('/admin/dining/cafes-list', getAuthConfig())
            if (response.data.success) setCafesList(response.data.data.cafes)
        } catch (err) { console.error(err) }
    }

    const handleSubmitBanner = async () => {
        if (!editingBannerId && (!bannerFile || !bannerPercentageOff || !bannerTagline || !bannerCafe)) {
            return setError("All fields and Image are required")
        }
        if (editingBannerId && (!bannerPercentageOff || !bannerTagline || !bannerCafe)) {
            return setError("All text fields are required")
        }

        try {
            setBannersUploading(true)
            const formData = new FormData()
            if (bannerFile) formData.append('image', bannerFile)
            formData.append('percentageOff', bannerPercentageOff)
            formData.append('tagline', bannerTagline)
            formData.append('cafe', bannerCafe)

            let response;
            if (editingBannerId) {
                response = await api.put(`/admin/dining/offer-banners/${editingBannerId}`, formData, getAuthConfig({
                    headers: { 'Content-Type': 'multipart/form-data' }
                }))
            } else {
                response = await api.post('/admin/dining/offer-banners', formData, getAuthConfig({
                    headers: { 'Content-Type': 'multipart/form-data' }
                }))
            }

            if (response.data.success) {
                setSuccess(editingBannerId ? "Banner updated successfully" : "Banner created successfully")
                resetBannerForm()
                fetchBanners()
            }
        } catch (err) { setError(err.response?.data?.message || (editingBannerId ? "Failed to update banner" : "Failed to create banner")) }
        finally { setBannersUploading(false) }
    }

    const resetBannerForm = () => {
        setBannerFile(null)
        setBannerPercentageOff("")
        setBannerTagline("")
        setBannerCafe("")
        setEditingBannerId(null)
        if (bannerFileInputRef.current) bannerFileInputRef.current.value = ""
    }

    const handleEditBanner = (banner) => {
        setEditingBannerId(banner._id)
        setBannerPercentageOff(banner.percentageOff)
        setBannerTagline(banner.tagline)
        setBannerCafe(banner.cafe._id || banner.cafe)
        setBannerFile(null)
        if (bannerFileInputRef.current) bannerFileInputRef.current.value = ""
    }

    const handleDeleteBanner = async (id) => {
        if (!window.confirm("Delete this banner?")) return
        try {
            setBannersDeleting(id)
            await api.delete(`/admin/dining/offer-banners/${id}`, getAuthConfig())
            fetchBanners()
            setSuccess("Banner deleted")
        } catch (err) { setError("Failed to delete banner") }
        finally { setBannersDeleting(null) }
    }

    // ==================== STORIES ====================
    const fetchStories = async () => {
        try {
            setStoriesLoading(true)
            const response = await api.get('/admin/dining/stories', getAuthConfig())
            if (response.data.success) setStories(response.data.data.stories)
        } catch (err) { console.error(err) } finally { setStoriesLoading(false) }
    }

    const handleSubmitStory = async () => {
        if (!editingStoryId && (!storyName || !storyFile)) return setError("Name and Image are required")
        if (editingStoryId && !storyName) return setError("Name is required")

        try {
            setStoriesUploading(true)
            const formData = new FormData()
            formData.append('name', storyName)
            if (storyFile) formData.append('image', storyFile)

            let response;
            if (editingStoryId) {
                response = await api.put(`/admin/dining/stories/${editingStoryId}`, formData, getAuthConfig({
                    headers: { 'Content-Type': 'multipart/form-data' }
                }))
            } else {
                response = await api.post('/admin/dining/stories', formData, getAuthConfig({
                    headers: { 'Content-Type': 'multipart/form-data' }
                }))
            }

            if (response.data.success) {
                setSuccess(editingStoryId ? "Story updated successfully" : "Story created successfully")
                resetStoryForm()
                fetchStories()
            }
        } catch (err) { setError(err.response?.data?.message || (editingStoryId ? "Failed to update story" : "Failed to create story")) }
        finally { setStoriesUploading(false) }
    }

    const resetStoryForm = () => {
        setStoryName("")
        setStoryFile(null)
        setEditingStoryId(null)
        if (storyFileInputRef.current) storyFileInputRef.current.value = ""
    }

    const handleEditStory = (story) => {
        setEditingStoryId(story._id)
        setStoryName(story.name)
        setStoryFile(null)
        if (storyFileInputRef.current) storyFileInputRef.current.value = ""
    }

    const handleDeleteStory = async (id) => {
        if (!window.confirm("Delete this story?")) return
        try {
            setStoriesDeleting(id)
            await api.delete(`/admin/dining/stories/${id}`, getAuthConfig())
            fetchStories()
            setSuccess("Story deleted")
        } catch (err) { setError("Failed to delete story") }
        finally { setStoriesDeleting(null) }
    }

    const fetchDiningConfig = async (cafeId) => {
        try {
            setConfigLoading(true)
            const response = await api.get(`/admin/dining/config/${cafeId}`, getAuthConfig())
            if (response.data?.success) {
                setConfigData({
                    availableDates: response.data.data?.availableDates || [],
                    timeSlots: response.data.data?.timeSlots || [],
                    tables: response.data.data?.tables || [],
                })
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load dining config")
        } finally {
            setConfigLoading(false)
        }
    }

    const handleCreateDateRange = async () => {
        if (!configCafeId || !dateRangeStart || !dateRangeEnd) {
            setError("Cafe, start date and end date are required")
            return
        }

        const start = new Date(dateRangeStart)
        const end = new Date(dateRangeEnd)

        if (end < start) {
            setError("End date must be on or after start date")
            return
        }

        // Max 31 days (1 month)
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
        if (diffDays > 31) {
            setError("Date range cannot exceed 31 days (1 month)")
            return
        }

        // Build array of all dates in range
        const datesToAdd = []
        const cursor = new Date(start)
        while (cursor <= end) {
            datesToAdd.push(cursor.toISOString().split("T")[0])
            cursor.setDate(cursor.getDate() + 1)
        }

        try {
            setDateSubmitting(true)
            setDateProgress({ done: 0, total: datesToAdd.length, active: true })
            let added = 0
            let failed = 0

            for (const dateStr of datesToAdd) {
                try {
                    await api.post(
                        "/admin/dining/date",
                        { cafeId: configCafeId, date: dateStr },
                        getAuthConfig(),
                    )
                    added++
                } catch {
                    failed++
                }
                setDateProgress((p) => ({ ...p, done: added + failed }))
            }

            setDateProgress({ done: 0, total: 0, active: false })
            if (failed === 0) {
                setSuccess(`${added} date${added > 1 ? "s" : ""} added successfully!`)
            } else {
                setSuccess(`${added} dates added. ${failed} already existed or failed.`)
            }
            setDateRangeStart("")
            setDateRangeEnd("")
            fetchDiningConfig(configCafeId)
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add dining dates")
            setDateProgress({ done: 0, total: 0, active: false })
        } finally {
            setDateSubmitting(false)
        }
    }

    const addPendingSlot = () => {
        if (!slotStartTime || !slotEndTime) {
            setError("Start and end time are required")
            return
        }

        const slotKey = `${slotStartTime}-${slotEndTime}`
        const exists = pendingSlots.some((slot) => `${slot.startTime}-${slot.endTime}` === slotKey)
        if (exists) {
            setError("This time slot is already added")
            return
        }

        setPendingSlots((prev) => [...prev, { startTime: slotStartTime, endTime: slotEndTime }])
        setSlotStartTime("")
        setSlotEndTime("")
    }

    const removePendingSlot = (index) => {
        setPendingSlots((prev) => prev.filter((_, idx) => idx !== index))
    }

    const handleSubmitTimeSlots = async () => {
        if (!configCafeId || !slotDateInput || pendingSlots.length === 0) {
            setError("Cafe, date and at least one time slot are required")
            return
        }

        try {
            setSlotSubmitting(true)
            const response = await api.post(
                "/admin/dining/timeslots",
                { cafeId: configCafeId, date: slotDateInput, timeSlots: pendingSlots },
                getAuthConfig(),
            )
            if (response.data?.success) {
                setSuccess("Time slots updated")
                setPendingSlots([])
                setSlotDateInput("")
                fetchDiningConfig(configCafeId)
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add time slots")
        } finally {
            setSlotSubmitting(false)
        }
    }

    const handleAddTable = async () => {
        if (!configCafeId || !tableNumber || !tableCapacity) {
            setError("Cafe, table number and capacity are required")
            return
        }

        try {
            setTableSubmitting(true)
            const response = await api.post(
                "/admin/tables",
                {
                    cafeId: configCafeId,
                    tableNumber: tableNumber.trim(),
                    capacity: Number(tableCapacity),
                },
                getAuthConfig(),
            )
            if (response.data?.success) {
                setSuccess("Dining table added")
                setTableNumber("")
                setTableCapacity("")
                fetchDiningConfig(configCafeId)
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add table")
        } finally {
            setTableSubmitting(false)
        }
    }

    const fetchBookingRequests = async () => {
        try {
            setBookingRequestsLoading(true)
            const response = await api.get("/admin/dining/booking-requests", getAuthConfig())
            if (response.data?.success) {
                setBookingRequests(response.data.data?.bookings || [])
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load booking requests")
        } finally {
            setBookingRequestsLoading(false)
        }
    }

    const handleApproveBooking = async (bookingId) => {
        try {
            setBookingActionLoading(bookingId)
            const response = await api.patch(`/admin/dining/approve/${bookingId}`, {}, getAuthConfig())
            if (response.data?.success) {
                setSuccess("Booking approved")
                setBookingRequests((prev) =>
                    prev.map((booking) =>
                        booking._id === bookingId
                            ? { ...booking, bookingStatus: "confirmed", status: "confirmed" }
                            : booking
                    )
                )
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to approve booking")
        } finally {
            setBookingActionLoading(null)
        }
    }

    const handleRejectBooking = async (bookingId) => {
        try {
            setBookingActionLoading(bookingId)
            const response = await api.patch(`/admin/dining/reject/${bookingId}`, {}, getAuthConfig())
            if (response.data?.success) {
                setSuccess("Booking rejected")
                setBookingRequests((prev) =>
                    prev.map((booking) =>
                        booking._id === bookingId
                            ? { ...booking, bookingStatus: "cancelled", status: "cancelled" }
                            : booking
                    )
                )
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to reject booking")
        } finally {
            setBookingActionLoading(null)
        }
    }

    const tabs = [
        { id: 'categories', label: 'Dining Categories', icon: Layout },
        { id: 'banners', label: 'Dining Banners', icon: ImageIcon },
        { id: 'stories', label: 'Dining Stories', icon: FileText },
        { id: 'reservations', label: 'Add Configuration', icon: CalendarDays },
        { id: 'dining-config', label: 'Current Config', icon: Table2 },
        { id: 'booking-requests', label: 'Booking Requests', icon: Users },
    ]

    return (
        <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#e53935] flex items-center justify-center">
                            <UtensilsCrossed className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1E1E1E]">Dining Banners</h1>
                            <p className="text-sm text-[#1E1E1E]/70 mt-1">Manage dining categories, banners, and stories</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-2 mb-6">
                    <div className="flex gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-[#e53935] text-white' : 'text-[#1E1E1E]/70 hover:bg-slate-100'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Messages */}
                {success && <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2 max-w-2xl"><CheckCircle2 className="w-5 h-5" />{success}</div>}
                {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2 max-w-2xl"><AlertCircle className="w-5 h-5" />{error}</div>}

                {/* Content */}
                {activeTab === 'categories' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Add Category</h2>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Category Name" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Image</Label>
                                        <Input type="file" ref={categoryFileInputRef} onChange={e => setCategoryFile(e.target.files[0])} accept="image/*" className="mt-1" />
                                    </div>
                                    <Button onClick={handleCreateCategory} disabled={categoriesUploading} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {categoriesUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Category"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Categories List</h2>
                                {categoriesLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#e53935]" /></div> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {categories.map(cat => (
                                            <div key={cat._id} className="border rounded-lg overflow-hidden group relative">
                                                <img src={cat.imageUrl} alt={cat.name} className="w-full h-32 object-cover" />
                                                <div className="p-3 bg-white">
                                                    <p className="font-medium text-[#1E1E1E]">{cat.name}</p>
                                                </div>
                                                <button onClick={() => handleDeleteCategory(cat._id)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {categoriesDeleting === cat._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}
                                        {categories.length === 0 && <p className="text-[#1E1E1E]/55 text-center col-span-full py-8">No categories found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'banners' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">{editingBannerId ? "Edit Offer Banner" : "Add Offer Banner"}</h2>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Image</Label>
                                        <Input type="file" ref={bannerFileInputRef} onChange={e => setBannerFile(e.target.files[0])} accept="image/*" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Percentage Off</Label>
                                        <Input value={bannerPercentageOff} onChange={e => setBannerPercentageOff(e.target.value)} placeholder="e.g. 50% OFF" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Tagline</Label>
                                        <Input value={bannerTagline} onChange={e => setBannerTagline(e.target.value)} placeholder="e.g. On selected items" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Cafe</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                                            value={bannerCafe}
                                            onChange={e => setBannerCafe(e.target.value)}
                                        >
                                            <option value="">Select Cafe</option>
                                            {cafesList.map(r => (
                                                <option key={r._id} value={r._id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button onClick={handleSubmitBanner} disabled={bannersUploading} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {bannersUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingBannerId ? "Update Banner" : "Create Banner")}
                                    </Button>
                                    {editingBannerId && (
                                        <Button onClick={resetBannerForm} variant="outline" className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                                            Cancel Edit
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Offer Banners List</h2>
                                {bannersLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#e53935]" /></div> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {banners.map(banner => (
                                            <div key={banner._id} className="border rounded-lg overflow-hidden group relative">
                                                <img src={banner.imageUrl} alt={banner.tagline} className="w-full h-32 object-cover" />
                                                <div className="p-3 bg-white">
                                                    <p className="font-bold text-[#1E1E1E]">{banner.percentageOff}</p>
                                                    <p className="text-sm text-[#1E1E1E]/70">{banner.tagline}</p>
                                                    <p className="text-xs text-[#e53935] mt-1">{banner.cafe?.name}</p>
                                                </div>
                                                <button onClick={() => handleDeleteBanner(banner._id)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {bannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => handleEditBanner(banner)} className="absolute top-2 right-10 p-1.5 bg-red-50 text-[#e53935] rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {banners.length === 0 && <p className="text-[#1E1E1E]/55 text-center col-span-full py-8">No banners found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'stories' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">{editingStoryId ? "Edit Story" : "Add Story"}</h2>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input value={storyName} onChange={e => setStoryName(e.target.value)} placeholder="Story Name" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>Image</Label>
                                        <Input type="file" ref={storyFileInputRef} onChange={e => setStoryFile(e.target.files[0])} accept="image/*" className="mt-1" />
                                    </div>
                                    <Button onClick={handleSubmitStory} disabled={storiesUploading} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {storiesUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingStoryId ? "Update Story" : "Create Story")}
                                    </Button>
                                    {editingStoryId && (
                                        <Button onClick={resetStoryForm} variant="outline" className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                                            Cancel Edit
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Stories List</h2>
                                {storiesLoading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#e53935]" /></div> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {stories.map(story => (
                                            <div key={story._id} className="border rounded-lg overflow-hidden group relative">
                                                <img src={story.imageUrl} alt={story.name} className="w-full h-32 object-cover" />
                                                <div className="p-3 bg-white">
                                                    <p className="font-medium text-[#1E1E1E]">{story.name}</p>
                                                </div>
                                                <button onClick={() => handleDeleteStory(story._id)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {storiesDeleting === story._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => handleEditStory(story)} className="absolute top-2 right-10 p-1.5 bg-red-50 text-[#e53935] rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {stories.length === 0 && <p className="text-[#1E1E1E]/55 text-center col-span-full py-8">No stories found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reservations' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* ── Left Sidebar: Cafe Selection ── */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 sticky top-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                    <UtensilsCrossed className="w-5 h-5 text-[#e53935]" />
                                    Configure Cafe
                                </h2>
                                <p className="text-xs text-[#1E1E1E]/50 mb-4 font-medium">Select a cafe to update its dining dates, slots, or tables.</p>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Target Cafe</Label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] outline-none transition-all"
                                    value={configCafeId}
                                    onChange={e => setConfigCafeId(e.target.value)}
                                >
                                    <option value="">Choose a Cafe</option>
                                    {cafesList.map((cafe) => (
                                        <option key={cafe._id} value={cafe._id}>{cafe.name}</option>
                                    ))}
                                </select>

                                {!configCafeId && (
                                    <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                                        <div className="flex gap-2">
                                            <AlertCircle className="w-4 h-4 text-[#e53935] shrink-0" />
                                            <p className="text-[11px] text-[#e53935] leading-relaxed font-bold">
                                                Please select a cafe first to enable the configuration forms.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {configCafeId && (
                                    <div className="mt-6">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full justify-start text-xs font-bold text-[#e53935] hover:bg-red-50"
                                            onClick={() => setActiveTab('dining-config')}
                                        >
                                            <Table2 className="w-4 h-4 mr-2" />
                                            View Active Config
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Main Content: Forms ── */}
                        <div className={`lg:col-span-3 space-y-6 ${!configCafeId ? "opacity-40 pointer-events-none grayscale-[0.5]" : ""}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Form: Dates */}
                                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 hover:shadow-md transition-shadow">
                                    <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                                            <CalendarDays className="w-4 h-4 text-[#e53935]" />
                                        </div>
                                        Add Dates
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#1E1E1E]/50 uppercase tracking-tight mb-1 block">Start Date</label>
                                            <Input
                                                type="date"
                                                min={getTodayInputValue()}
                                                value={dateRangeStart}
                                                onChange={e => {
                                                    setDateRangeStart(e.target.value)
                                                    if (!dateRangeEnd || dateRangeEnd < e.target.value) setDateRangeEnd(e.target.value)
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#1E1E1E]/50 uppercase tracking-tight mb-1 block">End Date</label>
                                            <Input
                                                type="date"
                                                min={dateRangeStart || getTodayInputValue()}
                                                max={(() => {
                                                    if (!dateRangeStart) return ""
                                                    const maxDate = new Date(dateRangeStart)
                                                    maxDate.setDate(maxDate.getDate() + 30)
                                                    return maxDate.toISOString().split("T")[0]
                                                })()}
                                                value={dateRangeEnd}
                                                onChange={e => setDateRangeEnd(e.target.value)}
                                            />
                                        </div>

                                        {dateRangeStart && dateRangeEnd && dateRangeEnd >= dateRangeStart && (() => {
                                            const diff = Math.round((new Date(dateRangeEnd) - new Date(dateRangeStart)) / (1000 * 60 * 60 * 24)) + 1
                                            return (
                                                <div className="py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-2">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    {diff} day{diff > 1 ? "s" : ""} will be added
                                                </div>
                                            )
                                        })()}

                                        {dateProgress.active && (
                                            <div className="space-y-1.5 pt-2">
                                                <div className="flex justify-between text-[10px] font-bold text-[#1E1E1E]/60 uppercase">
                                                    <span>Sync Status</span>
                                                    <span>{dateProgress.done}/{dateProgress.total}</span>
                                                </div>
                                                <div className="w-full bg-[#F5F5F5] rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-[#e53935] h-full transition-all duration-300" style={{ width: `${(dateProgress.done / dateProgress.total) * 100}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleCreateDateRange}
                                            disabled={dateSubmitting || !dateRangeStart || !dateRangeEnd}
                                            className="w-full bg-[#e53935] hover:bg-[#d32f2f] h-11 shadow-sm"
                                        >
                                            {dateSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync Dates"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Form: Slots */}
                                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 hover:shadow-md transition-shadow">
                                    <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                                            <Clock3 className="w-4 h-4 text-[#e53935]" />
                                        </div>
                                        Add Slots
                                    </h2>
                                    <div className="space-y-3">
                                        <Input type="date" min={getTodayInputValue()} value={slotDateInput} onChange={e => setSlotDateInput(e.target.value)} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input type="time" value={slotStartTime} onChange={e => setSlotStartTime(e.target.value)} />
                                            <Input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} />
                                        </div>
                                        <Button type="button" variant="outline" onClick={addPendingSlot} className="w-full border-dashed h-10 text-xs font-bold hover:border-[#e53935] hover:text-[#e53935]">Add to List</Button>
                                        
                                        {pendingSlots.length > 0 && (
                                            <div className="space-y-1.5 max-h-32 overflow-y-auto py-1">
                                                {pendingSlots.map((slot, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-600">
                                                        <span>{slot.startTime} - {slot.endTime}</span>
                                                        <button onClick={() => removePendingSlot(idx)} className="text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Button onClick={handleSubmitTimeSlots} disabled={slotSubmitting} className="w-full bg-[#e53935] hover:bg-[#d32f2f] h-11">
                                            {slotSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save All Slots"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Form: Tables */}
                                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 hover:shadow-md transition-shadow">
                                    <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                                            <Table2 className="w-4 h-4 text-[#e53935]" />
                                        </div>
                                        Add Tables
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Table ID</Label>
                                            <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. T-10" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Capacity (Persons)</Label>
                                            <Input type="number" min="1" value={tableCapacity} onChange={e => setTableCapacity(e.target.value)} placeholder="e.g. 4" />
                                        </div>
                                        <Button onClick={handleAddTable} disabled={tableSubmitting} className="w-full bg-[#e53935] hover:bg-[#d32f2f] h-11 mt-2 shadow-sm">
                                            {tableSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Physical Table"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'dining-config' && (
                    <div className="space-y-6">
                        {/* ── Top Dashboard Header ── */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#e53935] flex items-center justify-center shadow-lg shadow-red-100">
                                        <Table2 className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[#1E1E1E]">Dining Performance Dashboard</h2>
                                        <p className="text-sm text-[#1E1E1E]/50 font-medium">Monitoring active setup for your cafe locations</p>
                                    </div>
                                </div>
                                <div className="w-full md:w-64">
                                    <Label className="text-[10px] uppercase tracking-widest font-black text-[#e53935] mb-1.5 block">Active Cafe Filter</Label>
                                    <select
                                        className="flex h-11 w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-2 text-sm font-bold text-[#1E1E1E] focus:border-[#e53935] outline-none transition-all shadow-sm"
                                        value={configCafeId}
                                        onChange={e => setConfigCafeId(e.target.value)}
                                    >
                                        <option value="">Select a Cafe</option>
                                        {cafesList.map((cafe) => (
                                            <option key={cafe._id} value={cafe._id}>{cafe.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {!configCafeId ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-20 flex flex-col items-center justify-center text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <CalendarDays className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">No Cafe Selected</h3>
                                <p className="text-sm text-slate-400 max-w-xs mt-2">Pick a cafe from the filter above to see the available dates, slots, and tables.</p>
                            </div>
                        ) : configLoading ? (
                            <div className="bg-white rounded-2xl p-20 flex flex-col items-center">
                                <Loader2 className="w-12 h-12 animate-spin text-[#e53935] mb-4" />
                                <p className="text-sm font-bold text-slate-500">Fetching Configuration...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Section: Dates */}
                                <div className="lg:col-span-1 border border-[#F5F5F5] bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-red-50/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                                                <CalendarDays className="w-5 h-5 text-[#e53935]" />
                                            </div>
                                            <span className="font-bold text-[#1E1E1E]">Active Dates</span>
                                        </div>
                                        <span className="px-3 py-1 bg-[#e53935] text-white text-[10px] font-black rounded-full shadow-sm shadow-red-100">
                                            {configData.availableDates?.length || 0} TOTAL
                                        </span>
                                    </div>
                                    <div className="flex-1 max-h-[500px] overflow-y-auto">
                                        {(configData.availableDates || []).length > 0 ? (
                                            <div className="divide-y divide-slate-50">
                                                {(configData.availableDates || []).map((dateValue, idx) => {
                                                    const dateOnly = typeof dateValue === "string" ? dateValue : dateValue?.date
                                                    const statusRaw = typeof dateValue === "string" ? null : dateValue?.status
                                                    const isExpired = (statusRaw || "").toLowerCase() === "expired"
                                                    return (
                                                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-red-50/20 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[10px] font-mono text-slate-300 font-bold">{String(idx + 1).padStart(2, '0')}</span>
                                                                <p className="text-sm font-bold text-slate-700">
                                                                    {new Date(dateOnly).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${isExpired ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
                                                                {isExpired ? "Expired" : "Active"}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-10 text-center text-slate-400 text-xs italic">No dates available</div>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Slots & Tables */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Time Slots Card */}
                                    <div className="bg-white rounded-2xl border border-[#F5F5F5] shadow-sm overflow-hidden flex flex-col">
                                        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-red-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                                                    <Clock3 className="w-5 h-5 text-[#e53935]" />
                                                </div>
                                                <span className="font-bold text-[#1E1E1E]">Time Slots Matrix</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-[#e53935] bg-red-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                                {configData.timeSlots?.length || 0} Date Mappings
                                            </span>
                                        </div>
                                        <div className="p-5 max-h-[300px] overflow-y-auto">
                                            {(configData.timeSlots || []).length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {(configData.timeSlots).map((slotDoc) => (
                                                        <div key={slotDoc._id} className="p-3 rounded-xl border border-slate-100 bg-red-50/10">
                                                            <p className="text-[11px] font-black text-[#e53935]/60 uppercase mb-2">
                                                                {new Date(slotDoc.date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(slotDoc.timeSlots || []).filter(s => s.isActive !== false).map((s, si) => (
                                                                    <span key={si} className="px-2.5 py-1.5 bg-white border border-red-100 rounded-lg text-[10px] font-bold shadow-sm text-slate-600">
                                                                        {s.startTime} - {s.endTime}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-10 text-center text-slate-400 text-xs italic">No time slots mapped</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tables Card */}
                                    <div className="bg-white rounded-2xl border border-[#F5F5F5] shadow-sm overflow-hidden">
                                        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-red-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                                                    <Table2 className="w-5 h-5 text-[#e53935]" />
                                                </div>
                                                <span className="font-bold text-[#1E1E1E]">Furniture Setup</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-[#e53935] bg-red-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                                {configData.tables?.length || 0} Tables
                                            </span>
                                        </div>
                                        <div className="p-5">
                                            {(configData.tables || []).length > 0 ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[250px] overflow-y-auto pr-2">
                                                    {(configData.tables).map((table) => (
                                                        <div key={table._id} className="p-4 rounded-2xl border-2 border-slate-50 flex flex-col items-center justify-center gap-1 hover:border-red-100 hover:bg-red-50/20 transition-all group">
                                                            <p className="text-sm font-black text-slate-800">T-{table.tableNumber}</p>
                                                            <div className="flex items-center gap-1 opacity-60">
                                                                <Users className="w-3 h-3 text-[#e53935]" />
                                                                <span className="text-[10px] font-bold">{table.capacity}</span>
                                                            </div>
                                                            {table.isActive === false && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-10 text-center text-slate-400 text-xs italic">No tables configured</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'booking-requests' && (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        {/* ── Left Sidebar (Quick Config View) ── */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
                                <h3 className="text-sm font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                    <UtensilsCrossed className="w-4 h-4 text-[#e53935]" />
                                    Filter by Cafe
                                </h3>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-2"
                                    value={configCafeId}
                                    onChange={e => setConfigCafeId(e.target.value)}
                                >
                                    <option value="">All Cafes</option>
                                    {cafesList.map((cafe) => (
                                        <option key={cafe._id} value={cafe._id}>{cafe.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-[#1E1E1E]/40 italic uppercase tracking-wider">
                                    Selecting a cafe will filter requests and show its config
                                </p>
                            </div>

                            {configCafeId && !configLoading && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden">
                                        <div className="px-5 py-3 bg-slate-50 border-b border-[#F5F5F5] flex items-center justify-between">
                                            <span className="text-xs font-bold text-[#1E1E1E]">Active Dates</span>
                                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                                {configData.availableDates?.length || 0}
                                            </span>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto p-2">
                                            {configData.availableDates?.slice(0, 10).map((d, i) => (
                                                <div key={i} className="text-[11px] py-1 px-3 border-b border-slate-50 last:border-0 flex justify-between">
                                                    <span className="text-slate-600">
                                                        {new Date(typeof d === 'string' ? d : d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                    <span className="text-emerald-600 font-bold">Active</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden">
                                        <div className="px-5 py-3 bg-slate-50 border-b border-[#F5F5F5] flex items-center justify-between">
                                            <span className="text-xs font-bold text-[#1E1E1E]">Tables</span>
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                                {configData.tables?.length || 0}
                                            </span>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto p-2">
                                            {configData.tables?.map((t, i) => (
                                                <div key={i} className="text-[11px] py-1 px-3 border-b border-slate-50 last:border-0 flex justify-between items-center">
                                                    <span className="font-semibold">Table {t.tableNumber}</span>
                                                    <span className="text-slate-400">{t.capacity} seats</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        variant="outline" 
                                        className="w-full text-xs h-9 border-dashed border-slate-300 text-slate-500 hover:text-[#e53935]"
                                        onClick={() => setActiveTab('reservations')}
                                    >
                                        Edit Full Config
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* ── Right Content (Booking Requests Table) ── */}
                        <div className="xl:col-span-3 space-y-4">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden">
                                <div className="px-6 py-5 border-b border-[#F5F5F5] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-[#e53935]" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-[#1E1E1E]">Booking Requests</h2>
                                            <p className="text-xs text-[#1E1E1E]/50">Manage table reservations and customer approvals</p>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={fetchBookingRequests} 
                                        variant="outline" 
                                        className="h-9 px-4 text-xs font-bold gap-2 hover:border-[#e53935] hover:text-[#e53935] transition-all"
                                        disabled={bookingRequestsLoading}
                                    >
                                        {bookingRequestsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                        Refresh List
                                    </Button>
                                </div>

                                {bookingRequestsLoading ? (
                                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                                        <Loader2 className="w-10 h-10 animate-spin text-[#e53935]" />
                                        <p className="text-sm text-slate-400 font-medium">Fetching latest requests...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#FAFAFA] border-b border-[#F5F5F5]">
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Customer</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Cafe</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Date / Slot</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Table</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Guests</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Status</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-[#1E1E1E]/50 uppercase tracking-widest">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#F5F5F5]">
                                                {bookingRequests
                                                    .filter(b => !configCafeId || (b.cafe?._id || b.cafe) === configCafeId)
                                                    .map((booking) => {
                                                        const status = (booking.bookingStatus || booking.status || "pending").toLowerCase();
                                                        return (
                                                            <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-[#1E1E1E]">{booking.user?.name || "Customer"}</span>
                                                                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{booking.bookingId}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                                                        {booking.cafe?.name || "N/A"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-medium text-[#1E1E1E]">
                                                                            {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500">{booking.timeSlot}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                                        {booking.tableId?.tableNumber ? `T${booking.tableId.tableNumber}` : "—"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full">
                                                                        <Users className="w-3 h-3 text-slate-400" />
                                                                        <span className="text-xs font-bold text-slate-600">{booking.guests}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {status === "confirmed" ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                                                                            <CheckCircle2 className="w-3 h-3" /> Approved
                                                                        </span>
                                                                    ) : status === "cancelled" || status === "rejected" ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">
                                                                            <X className="w-3 h-3" /> Rejected
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase animate-pulse">
                                                                            <Clock3 className="w-3 h-3" /> Pending
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => setSelectedBookingInfo(booking)}
                                                                            className="h-8 w-8 rounded-lg border-slate-200 text-slate-400 hover:text-[#e53935] hover:bg-red-50"
                                                                        >
                                                                            <Info className="w-4 h-4" />
                                                                        </Button>
                                                                        {status === "pending" && (
                                                                            <>
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => handleApproveBooking(booking._id)}
                                                                                    disabled={bookingActionLoading === booking._id}
                                                                                    className="h-8 bg-green-600 hover:bg-green-700 px-3 text-[11px] font-bold"
                                                                                >
                                                                                    {bookingActionLoading === booking._id ? <Loader2 className="w-3 h-3 animate-spin" /> : "APPROVE"}
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => handleRejectBooking(booking._id)}
                                                                                    disabled={bookingActionLoading === booking._id}
                                                                                    className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 text-[11px] font-bold"
                                                                                >
                                                                                    REJECT
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                
                                                {bookingRequests.filter(b => !configCafeId || (b.cafe?._id || b.cafe) === configCafeId).length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-20 text-center">
                                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                                <Users className="w-12 h-12" />
                                                                <p className="text-sm font-bold">No booking requests found</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedBookingInfo && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-5 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-[#1E1E1E]">Customer Info</h3>
                                <button
                                    onClick={() => setSelectedBookingInfo(null)}
                                    className="p-2 rounded-full hover:bg-slate-100"
                                >
                                    <X className="w-4 h-4 text-[#1E1E1E]/70" />
                                </button>
                            </div>
                            <div className="p-5 space-y-3 text-sm">
                                <div>
                                    <p className="text-[#1E1E1E]/55">Name</p>
                                    <p className="text-[#1E1E1E] font-medium">{selectedBookingInfo.user?.name || "Customer"}</p>
                                </div>
                                <div>
                                    <p className="text-[#1E1E1E]/55">Phone</p>
                                    <p className="text-[#1E1E1E] font-medium">{selectedBookingInfo.user?.phone || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[#1E1E1E]/55">Email</p>
                                    <p className="text-[#1E1E1E] font-medium">{selectedBookingInfo.user?.email || "N/A"}</p>
                                </div>
                                <div className="pt-2 border-t border-[#F5F5F5]">
                                    <p className="text-[#1E1E1E]/55">Booking</p>
                                    <p className="text-[#1E1E1E] font-medium">
                                        {new Date(selectedBookingInfo.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {selectedBookingInfo.timeSlot}
                                    </p>
                                </div>
                            </div>
                            <div className="px-5 py-4 border-t border-[#F5F5F5] bg-slate-50/50">
                                <Button onClick={() => setSelectedBookingInfo(null)} className="w-full bg-[#e53935] hover:bg-[#d32f2f] h-11 font-bold">
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

