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
    const [dateInput, setDateInput] = useState("")
    const [dateSubmitting, setDateSubmitting] = useState(false)
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

    const handleCreateDate = async () => {
        if (!configCafeId || !dateInput) {
            setError("Cafe and date are required")
            return
        }

        try {
            setDateSubmitting(true)
            const response = await api.post(
                "/admin/dining/date",
                { cafeId: configCafeId, date: dateInput },
                getAuthConfig(),
            )
            if (response.data?.success) {
                setSuccess("Dining date added")
                setDateInput("")
                fetchDiningConfig(configCafeId)
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add dining date")
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
        { id: 'reservations', label: 'Dining Reservations', icon: CalendarDays },
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
                                                <button onClick={() => handleEditBanner(banner)} className="absolute top-2 right-10 p-1.5 bg-blue-100 text-[#e53935] rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                <button onClick={() => handleEditStory(story)} className="absolute top-2 right-10 p-1.5 bg-blue-100 text-[#e53935] rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="space-y-6 xl:col-span-1">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Select Cafe</h2>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                    value={configCafeId}
                                    onChange={e => setConfigCafeId(e.target.value)}
                                >
                                    <option value="">Select Cafe</option>
                                    {cafesList.map((cafe) => (
                                        <option key={cafe._id} value={cafe._id}>{cafe.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-[#e53935]" />
                                    Add Dining Date
                                </h2>
                                <div className="space-y-3">
                                    <Input type="date" min={getTodayInputValue()} value={dateInput} onChange={e => setDateInput(e.target.value)} />
                                    <Button onClick={handleCreateDate} disabled={dateSubmitting} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {dateSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Date"}
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                    <Clock3 className="w-4 h-4 text-[#e53935]" />
                                    Add Time Slots
                                </h2>
                                <div className="space-y-3">
                                    <Input type="date" min={getTodayInputValue()} value={slotDateInput} onChange={e => setSlotDateInput(e.target.value)} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input type="time" value={slotStartTime} onChange={e => setSlotStartTime(e.target.value)} />
                                        <Input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} />
                                    </div>
                                    <Button type="button" variant="outline" onClick={addPendingSlot} className="w-full">Add Slot</Button>
                                    {pendingSlots.length > 0 && (
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {pendingSlots.map((slot, idx) => (
                                                <div key={`${slot.startTime}-${slot.endTime}-${idx}`} className="flex items-center justify-between bg-[#F5F5F5] border border-[#F5F5F5] rounded-lg px-3 py-2 text-sm">
                                                    <span>{slot.startTime} - {slot.endTime}</span>
                                                    <button onClick={() => removePendingSlot(idx)} className="text-red-600 hover:text-red-700">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <Button onClick={handleSubmitTimeSlots} disabled={slotSubmitting} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {slotSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Time Slots"}
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                                    <Table2 className="w-4 h-4 text-[#e53935]" />
                                    Add Table
                                </h2>
                                <div className="space-y-3">
                                    <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table number (e.g. T1)" />
                                    <Input type="number" min="1" value={tableCapacity} onChange={e => setTableCapacity(e.target.value)} placeholder="Capacity" />
                                    <Button onClick={handleAddTable} disabled={tableSubmitting} className="w-full bg-[#e53935] hover:bg-[#d32f2f]">
                                        {tableSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Table"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="xl:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                                <h2 className="text-lg font-bold text-[#1E1E1E] mb-4">Current Dining Configuration</h2>
                                {!configCafeId ? (
                                    <p className="text-[#1E1E1E]/55">Select a cafe to load dining configuration.</p>
                                ) : configLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#e53935]" /></div>
                                ) : (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-2">Available Dates</h3>
                                            {(configData.availableDates || []).length > 0 ? (
                                                <div className="border border-[#F5F5F5] rounded-lg overflow-hidden">
                                                    <div className="grid grid-cols-2 bg-[#F5F5F5] text-xs font-semibold text-[#1E1E1E]/70 uppercase tracking-wide px-4 py-2">
                                                        <span>Date</span>
                                                        <span>Status</span>
                                                    </div>
                                                    <div className="divide-y divide-slate-200">
                                                        {(configData.availableDates || []).map((dateValue, idx) => {
                                                            const dateOnly = typeof dateValue === "string" ? dateValue : dateValue?.date
                                                            const statusRaw = typeof dateValue === "string" ? null : dateValue?.status
                                                            const status = (statusRaw || "").toLowerCase() === "expired" ? "expired" : "active"

                                                            return (
                                                                <div key={`${dateOnly}-${idx}`} className="grid grid-cols-2 items-center px-4 py-2 text-sm">
                                                                    <span className="text-slate-800 font-medium">
                                                                        {dateOnly ? new Date(dateOnly).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                                                                    </span>
                                                                    <span>
                                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status === "expired" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                                                            {status === "expired" ? "Expired" : "Active"}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-[#1E1E1E]/55 text-sm">No dates configured.</p>
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-2">Time Slots</h3>
                                            <div className="space-y-3">
                                                {(configData.timeSlots || []).map((slotDoc) => (
                                                    <div key={slotDoc._id} className="border border-[#F5F5F5] rounded-lg p-3">
                                                        <p className="text-sm font-semibold text-slate-800 mb-2">
                                                            {new Date(slotDoc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(slotDoc.timeSlots || []).filter(slot => slot.isActive !== false).map((slot, idx) => (
                                                                <span key={`${slot.startTime}-${slot.endTime}-${idx}`} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                                                                    {slot.startTime}-{slot.endTime}
                                                                </span>
                                                            ))}
                                                            {(!slotDoc.timeSlots || slotDoc.timeSlots.filter(slot => slot.isActive !== false).length === 0) && (
                                                                <p className="text-[#1E1E1E]/55 text-xs">No active slots.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!configData.timeSlots || configData.timeSlots.length === 0) && (
                                                    <p className="text-[#1E1E1E]/55 text-sm">No time slots configured.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-2">Tables</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(configData.tables || []).map((table) => (
                                                    <div key={table._id} className="border border-[#F5F5F5] rounded-lg p-3">
                                                        <p className="font-semibold text-[#1E1E1E]">Table {table.tableNumber}</p>
                                                        <p className="text-xs text-[#1E1E1E]/70 mt-1">{table.capacity} seats</p>
                                                    </div>
                                                ))}
                                                {(!configData.tables || configData.tables.length === 0) && (
                                                    <p className="text-[#1E1E1E]/55 text-sm">No tables configured.</p>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'booking-requests' && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                        <h2 className="text-lg font-bold text-[#1E1E1E] mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#e53935]" />
                            Dining Booking Requests
                        </h2>
                        {bookingRequestsLoading ? (
                            <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-[#e53935]" /></div>
                        ) : bookingRequests.length === 0 ? (
                            <p className="text-[#1E1E1E]/55 text-sm">No pending booking requests.</p>
                        ) : (
                            <div className="border border-[#F5F5F5] rounded-lg overflow-hidden">
                                <div className="grid grid-cols-7 bg-[#F5F5F5] text-xs font-semibold text-[#1E1E1E]/70 uppercase tracking-wide px-4 py-2">
                                    <span>Customer</span>
                                    <span>Date</span>
                                    <span>Slot</span>
                                    <span>Table</span>
                                    <span>Guests</span>
                                    <span>Status</span>
                                    <span>Action</span>
                                </div>
                                <div className="divide-y divide-slate-200">
                                    {bookingRequests.map((booking) => (
                                        <div key={booking._id} className="grid grid-cols-7 items-center px-4 py-3 text-sm">
                                            {(() => {
                                                const statusValue = booking.bookingStatus || booking.status || "pending"
                                                const statusLabel = statusValue === "confirmed"
                                                    ? "Approved"
                                                    : statusValue === "cancelled"
                                                        ? "Rejected"
                                                        : "Pending"
                                                return null
                                            })()}
                                            <span className="text-slate-800 font-medium">{booking.user?.name || "Customer"}</span>
                                            <span className="text-[#1E1E1E]/70">{new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            <span className="text-[#1E1E1E]/70">{booking.timeSlot}</span>
                                            <span className="text-[#1E1E1E]/70">{booking.tableId?.tableNumber ? `T${booking.tableId.tableNumber}` : "-"}</span>
                                            <span className="text-[#1E1E1E]/70">{booking.guests}</span>
                                            <span className="text-xs font-semibold">
                                                {(() => {
                                                    const statusValue = booking.bookingStatus || booking.status || "pending"
                                                    const statusLabel = statusValue === "confirmed"
                                                        ? "Approved"
                                                        : statusValue === "cancelled"
                                                            ? "Rejected"
                                                            : "Pending"
                                                    const statusClass = statusValue === "confirmed"
                                                        ? "bg-green-100 text-green-700"
                                                        : statusValue === "cancelled"
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                    return (
                                                        <span className={`px-2.5 py-1 rounded-full ${statusClass}`}>
                                                            {statusLabel}
                                                        </span>
                                                    )
                                                })()}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setSelectedBookingInfo(booking)}
                                                    className="h-8 w-8 p-0 border-[#F5F5F5] text-[#1E1E1E]/70 hover:bg-slate-100"
                                                    title="View customer info"
                                                >
                                                    <Info className="w-4 h-4" />
                                                </Button>
                                                {(booking.bookingStatus || booking.status) === "confirmed" || (booking.bookingStatus || booking.status) === "cancelled" ? null : (
                                                    <>
                                                        <Button
                                                            onClick={() => handleApproveBooking(booking._id)}
                                                            disabled={bookingActionLoading === booking._id}
                                                            className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                                        >
                                                            {bookingActionLoading === booking._id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleRejectBooking(booking._id)}
                                                            disabled={bookingActionLoading === booking._id}
                                                            className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                            <div className="px-5 py-4 border-t border-[#F5F5F5] bg-[#F5F5F5]">
                                <Button onClick={() => setSelectedBookingInfo(null)} className="w-full">
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

