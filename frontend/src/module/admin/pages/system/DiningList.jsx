import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, Settings, ArrowUpDown, Loader2, Star, Building2, User, FileText, Phone, Mail, MapPin, ShieldX, Trash2, Plus, ArrowRight } from "lucide-react"
import { adminAPI, restaurantAPI } from "@/lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { exportRestaurantsToPDF } from "../../components/restaurants/restaurantsExportUtils"

export default function DiningList() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState("")
    const [restaurants, setRestaurants] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState("All")
    const [loading, setLoading] = useState(true)
    const [categoryLoading, setCategoryLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingRestaurant, setEditingRestaurant] = useState(null)

    // Fetch restaurants from backend API
    useEffect(() => {
        const fetchRestaurants = async () => {
            try {
                setLoading(true)
                setError(null)

                let response
                try {
                    // Try admin API first
                    response = await adminAPI.getRestaurants()
                } catch (adminErr) {
                    console.log("Admin restaurants endpoint not available, using fallback")
                    response = await restaurantAPI.getRestaurants()
                }

                if (response.data && response.data.success && response.data.data) {
                    const restaurantsData = response.data.data.restaurants || response.data.data || []

                    const mappedRestaurants = restaurantsData.map((restaurant, index) => ({
                        id: restaurant._id || restaurant.id || index + 1,
                        _id: restaurant._id,
                        name: restaurant.name || "N/A",
                        ownerName: restaurant.ownerName || "N/A",
                        ownerPhone: restaurant.ownerPhone || restaurant.phone || "N/A",
                        zone: restaurant.location?.area || restaurant.location?.city || restaurant.zone || "N/A",
                        cuisine: Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
                            ? restaurant.cuisines[0]
                            : (restaurant.cuisine || "N/A"),
                        status: restaurant.isActive !== false,
                        rating: restaurant.ratings?.average || restaurant.rating || 0,
                        logo: restaurant.profileImage?.url || restaurant.logo || "https://via.placeholder.com/40",

                        diningSettings: restaurant.diningSettings || { isEnabled: false, maxGuests: 6 },
                        originalData: restaurant,
                    }))

                    setRestaurants(mappedRestaurants)
                } else {
                    setRestaurants([])
                }
            } catch (err) {
                console.error("Error fetching restaurants:", err)
                setError(err.message || "Failed to fetch restaurants")
                setRestaurants([])
            } finally {
                setLoading(false)
            }
        }

        fetchRestaurants()
    }, [])

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setCategoryLoading(true)
                const response = await adminAPI.getDiningCategories()
                if (response.data && response.data.success) {
                    const cats = (response.data.data.categories || []).map(cat => ({
                        ...cat,
                        slug: cat.name.toLowerCase().replace(/\s+/g, '-')
                    }))
                    setCategories(cats)
                }
            } catch (err) {
                console.error("Error fetching categories:", err)
            } finally {
                setCategoryLoading(false)
            }
        }
        fetchCategories()
    }, [])

    const filteredRestaurants = useMemo(() => {
        let result = [...restaurants]

        // Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(restaurant =>
                restaurant.name.toLowerCase().includes(query) ||
                restaurant.ownerName.toLowerCase().includes(query) ||
                restaurant.ownerPhone.includes(query)
            )
        }

        // Category Filter
        if (selectedCategory !== "All") {
            result = result.filter(restaurant =>
                restaurant.diningSettings?.diningType === selectedCategory ||
                (selectedCategory === "Uncategorized" && !restaurant.diningSettings?.diningType)
            )
        }

        return result
    }, [restaurants, searchQuery, selectedCategory])

    const formatRestaurantId = (id) => {
        if (!id) return "REST000000"
        return `REST${String(id).slice(-6).toUpperCase()}`
    }

    const renderStars = (rating) => {
        return "★".repeat(Math.floor(rating)) + "☆".repeat(5 - Math.floor(rating))
    }

    const handleDiningToggle = async (restaurant) => {
        const newStatus = !restaurant.diningSettings?.isEnabled
        try {
            // Optimistic update
            setRestaurants(prev => prev.map(r =>
                r.id === restaurant.id
                    ? { ...r, diningSettings: { ...r.diningSettings, isEnabled: newStatus } }
                    : r
            ))

            await adminAPI.updateRestaurantDiningSettings(restaurant._id, {
                isEnabled: newStatus
            })
            // Could show success toast here
        } catch (error) {
            console.error("Failed to update dining settings", error)
            // Revert on error
            setRestaurants(prev => prev.map(r =>
                r.id === restaurant.id
                    ? { ...r, diningSettings: { ...r.diningSettings, isEnabled: !newStatus } }
                    : r
            ))
        }
    }

    const handleMaxGuestsUpdate = async (restaurant, newValue) => {
        const guests = parseInt(newValue)
        if (isNaN(guests) || guests < 1) return

        // Prevent unnecessary API calls
        if (guests === restaurant.diningSettings?.maxGuests) return

        try {
            // Optimistic update
            setRestaurants(prev => prev.map(r =>
                r.id === restaurant.id
                    ? { ...r, diningSettings: { ...r.diningSettings, maxGuests: guests } }
                    : r
            ))

            await adminAPI.updateRestaurantDiningSettings(restaurant._id, {
                maxGuests: guests
            })
        } catch (error) {
            console.error("Failed to update max guests", error)
            // Revert would require tracking previous value better
        }
    }

    return (
        <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-[#1E1E1E]">Dining List</h1>
                        </div>
                        <button
                            onClick={() => navigate("/admin/restaurants/add")}
                            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2 transition-all shadow-sm hover:shadow"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Restaurant</span>
                        </button>
                    </div>
                    <p className="text-[#1E1E1E]/70">Manage restaurants available for dining.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-[#e53935]" />
                            <span className="ml-3 text-[#1E1E1E]/70">Loading dining list...</span>
                        </div>
                    ) : restaurants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-[#F5F5F5] rounded-full flex items-center justify-center mb-6">
                                <Building2 className="w-10 h-10 text-[#1E1E1E]/30" />
                            </div>
                            <h2 className="text-xl font-bold text-[#1E1E1E] mb-2">No dining restaurants added yet</h2>
                            <p className="text-[#1E1E1E]/70 max-w-sm mb-8">
                                Get started by adding your first restaurant to the dining management system.
                            </p>
                            <button
                                onClick={() => navigate("/admin/restaurants/add")}
                                className="px-6 py-3 text-sm font-medium rounded-lg bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2 transition-all shadow-md"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Register First Restaurant</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                <h2 className="text-xl font-bold text-[#1E1E1E]">Registered Dining Restaurants</h2>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                                        <input
                                            type="text"
                                            placeholder="Search dining restaurants..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#F5F5F5] bg-white focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:border-[#e53935]"
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E1E1E]/45" />
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter Chips */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-2">
                                <button
                                    onClick={() => setSelectedCategory("All")}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === "All"
                                        ? "bg-[#e53935] text-white shadow-md"
                                        : "bg-[#F5F5F5] text-[#1E1E1E]/70 hover:bg-[#F5F5F5]"
                                        }`}
                                >
                                    All ({restaurants.length})
                                </button>
                                {categories.map((cat) => {
                                    const count = restaurants.filter(r => r.diningSettings?.diningType === cat.slug).length;
                                    return (
                                        <button
                                            key={cat._id}
                                            onClick={() => setSelectedCategory(cat.slug)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === cat.slug
                                                ? "bg-[#e53935] text-white shadow-md"
                                                : "bg-[#F5F5F5] text-[#1E1E1E]/70 hover:bg-[#F5F5F5]"
                                                }`}
                                        >
                                            {cat.name} ({count})
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#F5F5F5] border-b border-[#F5F5F5]">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Restaurant</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Owner</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Zone</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Dining</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Guests</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Rating</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-[#F5F5F5]">
                                        {filteredRestaurants.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mb-4">
                                                            <Search className="w-8 h-8 text-[#1E1E1E]/30" />
                                                        </div>
                                                        <p className="text-lg font-semibold text-[#1E1E1E] mb-1">No dining restaurants found</p>
                                                        <p className="text-sm text-[#1E1E1E]/70">
                                                            Try adjusting your search query or filters.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRestaurants.map((restaurant, index) => (
                                                <tr key={restaurant.id} className="hover:bg-[#F5F5F5] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F5F5F5] flex-shrink-0">
                                                                <img
                                                                    src={restaurant.logo}
                                                                    alt={restaurant.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => { e.target.src = "https://via.placeholder.com/40" }}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-[#1E1E1E]">{restaurant.name}</span>
                                                                <span className="text-xs text-[#1E1E1E]/70">#{formatRestaurantId(restaurant.originalData?.restaurantId || restaurant._id)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-[#1E1E1E]">{restaurant.ownerName}</span>
                                                            <span className="text-xs text-[#1E1E1E]/70">{restaurant.ownerPhone}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm text-[#1E1E1E]">{restaurant.zone}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => handleDiningToggle(restaurant)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${restaurant.diningSettings?.isEnabled ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${restaurant.diningSettings?.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                defaultValue={restaurant.diningSettings?.maxGuests || 6}
                                                                onBlur={(e) => handleMaxGuestsUpdate(restaurant, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.currentTarget.blur()
                                                                    }
                                                                }}
                                                                className="w-16 px-2 py-1 text-sm border border-[#F5F5F5] rounded focus:outline-none focus:border-[#e53935] text-center"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm text-[#FFC400] font-medium">{renderStars(restaurant.rating)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${restaurant.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                            {restaurant.status ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRestaurant({ ...restaurant })
                                                                setIsEditModalOpen(true)
                                                            }}
                                                            className="p-2 text-[#1E1E1E]/45 hover:text-[#e53935] transition-colors"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingRestaurant && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-5 border-b border-[#F5F5F5] flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[#1E1E1E]">Edit Dining Settings</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors">
                                <Plus className="w-5 h-5 rotate-45 text-[#1E1E1E]/70" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1E1E1E]">Dining Status</p>
                                    <p className="text-xs text-[#1E1E1E]/70">Enable or disable dining for this restaurant</p>
                                </div>
                                <button
                                    onClick={() => setEditingRestaurant(prev => ({
                                        ...prev,
                                        diningSettings: { ...prev.diningSettings, isEnabled: !prev.diningSettings.isEnabled }
                                    }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingRestaurant.diningSettings?.isEnabled ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${editingRestaurant.diningSettings?.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Max Guests */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#1E1E1E]">Maximum Guests</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={editingRestaurant.diningSettings?.maxGuests}
                                    onChange={(e) => setEditingRestaurant(prev => ({
                                        ...prev,
                                        diningSettings: { ...prev.diningSettings, maxGuests: parseInt(e.target.value) || 1 }
                                    }))}
                                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:border-[#e53935]"
                                />
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#1E1E1E]">Dining Category</label>
                                <select
                                    value={editingRestaurant.diningSettings?.diningType || ""}
                                    onChange={(e) => setEditingRestaurant(prev => ({
                                        ...prev,
                                        diningSettings: { ...prev.diningSettings, diningType: e.target.value }
                                    }))}
                                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:border-[#e53935] bg-white"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map(cat => (
                                        <option key={cat._id} value={cat.slug}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-[#F5F5F5] flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-[#1E1E1E] hover:bg-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        setLoading(true)
                                        await adminAPI.updateRestaurantDiningSettings(editingRestaurant._id, editingRestaurant.diningSettings)

                                        // Update local state
                                        setRestaurants(prev => prev.map(r =>
                                            r._id === editingRestaurant._id ? editingRestaurant : r
                                        ))

                                        setIsEditModalOpen(false)
                                        // toast.success("Settings updated")
                                    } catch (err) {
                                        console.error("Update failed", err)
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-[#e53935] hover:bg-[#d32f2f] rounded-lg transition-colors shadow-sm"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
