import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
    ArrowLeft,
    Search,
    Plus,
    X,
    Upload,
    Loader2,
    Utensils,
    ChevronDown,
    ChevronRight,
    Save,
    Edit2,
    Trash2,
    Minus
} from "lucide-react"
import { adminAPI, uploadAPI } from "@/lib/api"
import { toast } from "sonner"

export default function MenuAdd() {
    const navigate = useNavigate()
    const location = useLocation()
    const [cafes, setCafes] = useState([])
    const [selectedCafe, setSelectedCafe] = useState(null)
    const [menu, setMenu] = useState(null)
    const [globalCategories, setGlobalCategories] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [showAddDishModal, setShowAddDishModal] = useState(false)
    const [selectedSection, setSelectedSection] = useState(null)
    const [expandedSections, setExpandedSections] = useState({})
    const [saving, setSaving] = useState(false)
    const [editingDish, setEditingDish] = useState(null) // { dish, section }
    const [deletingDish, setDeletingDish] = useState(false)
    const dishSectionRef = useRef(null)

    const normalizeSearchValue = (value) =>
        String(value ?? "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim()

    const collapseSpaces = (value) =>
        String(value ?? "")
            .replace(/\s+/g, " ")
            .trim()

    const trimEdges = (value) => String(value ?? "").trim()

    const sanitizePriceInput = (value) => {
        const cleaned = String(value ?? "").replace(/[^0-9.]/g, "")
        const parts = cleaned.split(".")
        if (parts.length <= 1) return cleaned
        return `${parts[0]}.${parts.slice(1).join("")}`
    }

    const normalizePriceOnFocus = (value) => {
        const raw = String(value ?? "").trim()
        return raw === "0" ? "" : raw
    }

    const capitalizeWords = (value) => {
        const text = String(value ?? "")
        if (!text) return ""
        return text.replace(/\b([a-z])/g, (match) => match.toUpperCase())
    }

    const getCategoryKey = (category) =>
        String(category?._id || category?.id || "")

    const findGlobalCategoryById = (id) =>
        globalCategories.find((cat) => getCategoryKey(cat) === String(id))

    const findGlobalCategoryByName = (name) =>
        globalCategories.find((cat) =>
            normalizeSearchValue(cat?.name) === normalizeSearchValue(name) &&
            normalizeSearchValue(name).length > 0
        )

    // Preparation time options
    const preparationTimeOptions = [
        "10-20 mins",
        "20-25 mins",
        "25-35 mins",
        "35-45 mins",
        "45-60 mins",
        "60+ mins"
    ]

    // Form data for new dish
    const [formData, setFormData] = useState({
        name: "",
        image: "",
        images: [],
        price: 0,
        selectedCategoryId: "",
        /* add-ons category correlation disabled
        addonCategoryId: "",
        useManualAddonCategory: false,
        */
        foodType: "Non-Veg",
        category: "",
        description: "",
        preparationTime: "",
        isAvailable: true,
        isRecommended: false,
        stock: true, // Stock toggle - true means in stock
        hasVariants: false, // Checkbox to enable variants
        variants: [], // Array of variants: [{ id, name, price, stock }]
    })

    const getEmptyDishForm = (overrides = {}) => ({
        name: "",
        image: "",
        images: [],
        price: 0,
        selectedCategoryId: "",
        /* add-ons category correlation disabled
        addonCategoryId: "",
        useManualAddonCategory: false,
        */
        foodType: "Non-Veg",
        category: "",
        description: "",
        preparationTime: "",
        isAvailable: true,
        isRecommended: false,
        stock: true,
        hasVariants: false,
        variants: [],
        ...overrides,
    })

    // Fetch cafes and global categories
    useEffect(() => {
        fetchCafes()
        fetchGlobalCategories()
    }, [])

    useEffect(() => {
        if (!showAddDishModal || globalCategories.length === 0) return

        setFormData((prev) => {
            if (prev.selectedCategoryId || !prev.category) return prev
            const matchedCategory = findGlobalCategoryByName(prev.category)
            if (!matchedCategory) return prev

            return {
                ...prev,
                selectedCategoryId: getCategoryKey(matchedCategory),
            }
        })
    }, [globalCategories, showAddDishModal])

    useEffect(() => {
        if (!showAddDishModal) return

        const originalBodyOverflow = document.body.style.overflow
        const originalHtmlOverflow = document.documentElement.style.overflow

        document.body.style.overflow = "hidden"
        document.documentElement.style.overflow = "hidden"

        return () => {
            document.body.style.overflow = originalBodyOverflow
            document.documentElement.style.overflow = originalHtmlOverflow
        }
    }, [showAddDishModal])

    const fetchGlobalCategories = async () => {
        try {
            const response = await adminAPI.getCategories()
            if (response.data?.success) {
                setGlobalCategories(response.data.data.categories || [])
            }
        } catch (error) {
            console.error("Error fetching global categories:", error)
        }
    }

    // Pre-select cafe from navigation state
    useEffect(() => {
        if (cafes.length > 0 && location.state?.cafeId && !selectedCafe) {
            const found = cafes.find(r => r._id === location.state.cafeId || r.id === location.state.cafeId)
            if (found) {
                setSelectedCafe(found)
            }
        }
    }, [cafes, location.state])

    // Fetch menu when cafe is selected
    useEffect(() => {
        if (selectedCafe) {
            fetchMenu()
        }
    }, [selectedCafe])

    // Auto-scroll to dish management section when cafe is selected
    useEffect(() => {
        if (!selectedCafe || !dishSectionRef.current) return

        const timer = setTimeout(() => {
            dishSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            })
        }, 120)

        return () => clearTimeout(timer)
    }, [selectedCafe])

    const fetchCafes = async () => {
        try {
            setLoading(true)
            const response = await adminAPI.getCafes()
            if (response.data?.success) {
                const cafesData = response.data.data.cafes || response.data.data || []
                setCafes(cafesData)
            }
        } catch (error) {
            console.error("Error fetching cafes:", error)
            toast.error("Failed to load cafes")
        } finally {
            setLoading(false)
        }
    }

    const fetchMenu = async () => {
        if (!selectedCafe?._id) return

        try {
            setLoading(true)
            // Get menu by cafe ID using admin endpoint
            const response = await adminAPI.getCafeMenu(selectedCafe._id)
            if (response.data?.success) {
                setMenu(response.data.data.menu)
                // Initialize expanded sections
                const sections = response.data.data.menu?.sections || []
                const expanded = {}
                sections.forEach((section, index) => {
                    expanded[section.id] = index < 3 // Expand first 3 sections by default
                })
                setExpandedSections(expanded)
            }
        } catch (error) {
            console.error("Error fetching menu:", error)
            toast.error("Failed to load menu")
            setMenu({ sections: [] })
        } finally {
            setLoading(false)
        }
    }

    const handleCafeSelect = (cafe) => {
        // Always scroll to dish section on cafe card click, even if same cafe is clicked again.
        const scrollToDishSection = () => {
            if (!dishSectionRef.current) return
            dishSectionRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start"
            })
        }

        const selectedId = selectedCafe?._id || selectedCafe?.id
        const nextId = cafe?._id || cafe?.id

        if (selectedId && nextId && String(selectedId) === String(nextId)) {
            setTimeout(scrollToDishSection, 80)
            return
        }

        setSelectedCafe(cafe)
        setMenu(null)

        setTimeout(scrollToDishSection, 120)
    }

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }))
    }

    const handleAddDish = (section) => {
        setSelectedSection(section)
        setEditingDish(null)
        const matchedCategory = findGlobalCategoryByName(section?.name || "")
        const matchedCategoryId = matchedCategory ? getCategoryKey(matchedCategory) : ""
        setFormData(getEmptyDishForm({
            category: matchedCategory?.name || "",
            selectedCategoryId: matchedCategoryId,
        }))
        setShowAddDishModal(true)
    }

    // Variant management functions
    const handleAddVariant = () => {
        const newVariant = {
            id: `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: "",
            price: 0,
            stock: "Unlimited",
        }
        setFormData({
            ...formData,
            variants: [...formData.variants, newVariant],
        })
    }

    const handleRemoveVariant = (variantId) => {
        setFormData({
            ...formData,
            variants: formData.variants.filter((v) => v.id !== variantId),
        })
    }

    const handleUpdateVariant = (variantId, field, value) => {
        setFormData({
            ...formData,
            variants: formData.variants.map((v) =>
                v.id === variantId ? { ...v, [field]: value } : v
            ),
        })
    }

    const handleEditDish = (dish, section) => {
        setSelectedSection(section)
        setEditingDish({ dish, section })
        const hasVariants = Array.isArray(dish.variations) && dish.variations.length > 0
        const matchedCategoryByName = findGlobalCategoryByName(dish.category || section.name)
        const matchedCategoryById = findGlobalCategoryById(dish.categoryId)
        const selectedCategory = matchedCategoryByName || matchedCategoryById
        const selectedCategoryId = selectedCategory ? getCategoryKey(selectedCategory) : ""
        /* add-ons category correlation disabled
        const addonCategoryId = matchedCategoryById ? getCategoryKey(matchedCategoryById) : ""
        const useManualAddonCategory = Boolean(addonCategoryId && selectedCategoryId && addonCategoryId !== selectedCategoryId)
        */

        setFormData(getEmptyDishForm({
            name: dish.name || "",
            image: dish.image || "",
            images: Array.isArray(dish.images) ? dish.images : (dish.image ? [dish.image] : []),
            price: dish.price || 0,
            selectedCategoryId,
            /* add-ons category correlation disabled
            addonCategoryId: useManualAddonCategory ? addonCategoryId : "",
            useManualAddonCategory,
            */
            foodType: dish.foodType || "Non-Veg",
            category: selectedCategory?.name || dish.category || "",
            description: dish.description || "",
            preparationTime: dish.preparationTime || "",
            isAvailable: dish.isAvailable !== false,
            isRecommended: dish.isRecommended || false,
            stock: dish.stock === "Unlimited" || dish.stock === "unlimited"
                ? true
                : (typeof dish.stock === "number"
                    ? dish.stock > 0
                    : parseFloat(dish.stock) > 0),
            hasVariants: hasVariants,
            variants: hasVariants ? dish.variations.map((v) => ({
                id: v.id || `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: v.name || "",
                price: v.price || 0,
                stock: v.stock || "Unlimited",
            })) : [],
        }))
        setShowAddDishModal(true)
    }

    const handleDeleteDish = async (dish, section) => {
        if (!confirm(`Are you sure you want to delete "${dish.name}"? This action cannot be undone.`)) {
            return
        }

        if (!selectedCafe?._id) {
            toast.error("Please select a cafe")
            return
        }

        try {
            setDeletingDish(true)

            // Get current menu
            const currentMenu = menu || { sections: [] }

            // Remove item from section
            const updatedSections = currentMenu.sections.map(sec => {
                if (sec.id === section.id || sec.name === section.name) {
                    return {
                        ...sec,
                        items: (sec.items || []).filter(item => String(item.id) !== String(dish.id))
                    }
                }
                return sec
            })

            // Update menu via Admin API
            const updateResponse = await adminAPI.updateCafeMenu(selectedCafe._id, {
                sections: updatedSections
            })

            if (updateResponse.data?.success) {
                toast.success("Dish deleted successfully!")
                fetchMenu() // Refresh menu
            } else {
                toast.error("Failed to delete dish")
            }
        } catch (error) {
            console.error("Error deleting dish:", error)
            toast.error(error.response?.data?.message || "Failed to delete dish")
        } finally {
            setDeletingDish(false)
        }
    }

    const handleImageUpload = async (file) => {
        if (!file) return

        try {
            const response = await uploadAPI.uploadMedia(file, { folder: 'menu-items' })
            if (response.data?.success && response.data.data?.url) {
                const imageUrl = response.data.data.url
                setFormData(prev => ({
                    ...prev,
                    image: imageUrl,
                    images: prev.images.length === 0 ? [imageUrl] : [...prev.images, imageUrl]
                }))
                toast.success("Image uploaded successfully")
            }
        } catch (error) {
            console.error("Error uploading image:", error)
            toast.error("Failed to upload image")
        }
    }


    const handleSaveDish = async () => {
        if (!formData.name) {
            toast.error("Please fill in dish name")
            return
        }

        if (!formData.hasVariants && (!formData.price || formData.price <= 0)) {
            toast.error("Please fill in dish price")
            return
        }

        if (formData.hasVariants && formData.variants.length === 0) {
            toast.error("Please add at least one variant")
            return
        }

        if (formData.hasVariants) {
            // Validate variants
            for (const variant of formData.variants) {
                if (!variant.name || !variant.name.trim()) {
                    toast.error("Please fill in variant name for all variants")
                    return
                }
                if (!variant.price || variant.price <= 0) {
                    toast.error("Please fill in valid price for all variants")
                    return
                }
            }
        }

        if (!formData.selectedCategoryId) {
            toast.error("Please select a category")
            return
        }

        /* add-ons category correlation disabled
        if (formData.useManualAddonCategory && !formData.addonCategoryId) {
            toast.error("Please select add-on category correlation")
            return
        }
        */

        if (!selectedCafe?._id) {
            toast.error("Please select a cafe")
            return
        }

        try {
            setSaving(true)

            // Prepare dish data
            const existingDish = editingDish ? editingDish.dish : null
            const selectedCategory = findGlobalCategoryById(formData.selectedCategoryId)
            const dishCategoryName = selectedCategory?.name || formData.category || ""
            /* add-ons category correlation disabled
            const correlatedAddonCategoryId = formData.useManualAddonCategory
                ? formData.addonCategoryId
                : formData.selectedCategoryId
            */

            // Prepare variations array
            const variations = formData.hasVariants && formData.variants.length > 0
                ? formData.variants.map((v) => ({
                    id: String(v.id),
                    name: v.name.trim(),
                    price: parseFloat(v.price) || 0,
                    stock: v.stock || "Unlimited",
                }))
                : []

            const dishData = {
                id: editingDish ? editingDish.dish.id : Date.now().toString(),
                name: formData.name.trim(),
                nameArabic: existingDish?.nameArabic || "",
                image: formData.image || (formData.images?.[0] || ""),
                images: formData.images.length > 0 ? formData.images : (formData.image ? [formData.image] : []),
                price: formData.hasVariants && variations.length > 0
                    ? Math.min(...variations.map(v => v.price)) // Base price as minimum variant price
                    : parseFloat(formData.price),
                stock: formData.stock ? "Unlimited" : 0,
                discount: existingDish?.discount || null,
                originalPrice: existingDish?.originalPrice || null,
                discountType: existingDish?.discountType || "Percent",
                discountAmount: existingDish?.discountAmount || 0,
                foodType: formData.foodType,
                category: dishCategoryName,
                // add-ons category correlation disabled
                categoryId: formData.selectedCategoryId || null,
                description: formData.description || "",
                availabilityTimeStart: existingDish?.availabilityTimeStart || "12:01 AM",
                availabilityTimeEnd: existingDish?.availabilityTimeEnd || "11:57 PM",
                isAvailable: formData.isAvailable !== false,
                isRecommended: formData.isRecommended || false,
                variations: variations,
                tags: existingDish?.tags || [],
                nutrition: existingDish?.nutrition || [],
                allergies: existingDish?.allergies || [],
                subCategory: existingDish?.subCategory || "",
                servesInfo: existingDish?.servesInfo || "",
                itemSize: existingDish?.itemSize || "",
                itemSizeQuantity: existingDish?.itemSizeQuantity || "",
                itemSizeUnit: existingDish?.itemSizeUnit || "piece",
                gst: existingDish?.gst || 0,
                preparationTime: formData.preparationTime || "",
                photoCount: formData.images.length || 1,
                rating: existingDish?.rating || 0,
                reviews: existingDish?.reviews || 0,
                approvalStatus: existingDish?.approvalStatus || 'approved',
                approvedAt: existingDish?.approvedAt || new Date(),
                requestedAt: existingDish?.requestedAt,
                approvedBy: existingDish?.approvedBy,
                rejectedAt: existingDish?.rejectedAt,
                rejectionReason: existingDish?.rejectionReason || "",
            }

            // Get current menu
            const currentMenu = menu || { sections: [] }

            let updatedSections = []

            if (editingDish) {
                // Editing existing dish - replace it
                updatedSections = currentMenu.sections.map(section => {
                    if (section.id === editingDish.section.id || section.name === editingDish.section.name) {
                        return {
                            ...section,
                            items: (section.items || []).map(item =>
                                String(item.id) === String(editingDish.dish.id) ? dishData : item
                            )
                        }
                    }
                    return section
                })
            } else {
                // Adding new dish
                // Add the new dish to the selected section.
                // If there is no existing section yet, create the first one using the selected category.
                let sectionFound = false
                updatedSections = currentMenu.sections.map(section => {
                    if (section.id === selectedSection?.id) {
                        sectionFound = true
                        return {
                            ...section,
                            items: [...(section.items || []), dishData]
                        }
                    }
                    return section
                })

                // If section not found, create new section
                if (!sectionFound) {
                    const newSection = {
                        id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: selectedSection?.name || dishCategoryName,
                        items: [dishData],
                        subsections: [],
                        isEnabled: true,
                        order: updatedSections.length,
                    }
                    updatedSections.push(newSection)
                }
            }

            // Update menu via Admin API
            try {
                const updateResponse = await adminAPI.updateCafeMenu(selectedCafe._id, {
                    sections: updatedSections
                })

                if (updateResponse.data?.success) {
                    toast.success(editingDish ? "Dish updated successfully!" : "Dish added successfully!")
                    setShowAddDishModal(false)
                    setEditingDish(null)
                    fetchMenu() // Refresh menu
                    // Reset form
                    setFormData(getEmptyDishForm({
                        category: dishCategoryName,
                        selectedCategoryId: formData.selectedCategoryId,
                        /* add-ons category correlation disabled
                        useManualAddonCategory: formData.useManualAddonCategory,
                        addonCategoryId: formData.useManualAddonCategory ? formData.addonCategoryId : "",
                        */
                    }))
                } else {
                    toast.error(editingDish ? "Failed to update dish" : "Failed to add dish")
                }
            } catch (apiError) {
                throw apiError
            }
        } catch (error) {
            console.error("Error saving dish:", error)
            toast.error(error.response?.data?.message || "Failed to add dish")
        } finally {
            setSaving(false)
        }
    }

    const normalizedCafeQuery = normalizeSearchValue(searchQuery)
    const filteredCafes = cafes.filter((cafe) =>
        normalizeSearchValue(cafe.name).includes(normalizedCafeQuery) ||
        normalizeSearchValue(cafe.ownerName).includes(normalizedCafeQuery)
    )

    return (
        <div className="min-h-screen bg-[#F5F5F5]">
            {/* Header */}
            <div className="bg-white border-b border-[#F5F5F5] sticky top-0 z-10">
                <div className="px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#1E1E1E]" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-[#1E1E1E]">Menu Add</h1>
                        <p className="text-sm text-[#1E1E1E]">Add dishes to cafe menus</p>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-7xl mx-auto">
                {/* Cafe Selection */}
                <div className="bg-white rounded-lg shadow-sm border border-[#F5F5F5] p-4 mb-6">
                    <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Select Cafe</h2>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#1E1E1E]" />
                        <input
                            type="text"
                            placeholder="Search cafes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                        />
                    </div>

                    {/* Cafe List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-[#1E1E1E]" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                            {filteredCafes.map((cafe) => (
                                <button
                                    key={cafe._id || cafe.id}
                                    onClick={() => handleCafeSelect(cafe)}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${selectedCafe?._id === cafe._id
                                        ? "border-[#e53935] bg-[#FFF8E1]"
                                        : "border-[#F5F5F5] hover:border-[#F5F5F5] hover:bg-[#F5F5F5]"
                                        }`}
                                >
                                    <div className="font-semibold text-[#1E1E1E]">{cafe.name}</div>
                                    <div className="text-sm text-[#1E1E1E] mt-1">
                                        Owner: {cafe.ownerName || "N/A"}
                                    </div>
                                    {cafe.location?.area && (
                                        <div className="text-xs text-[#1E1E1E] mt-1">
                                            {cafe.location.area}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Menu Sections */}
                {selectedCafe && (
                    <div ref={dishSectionRef} className="bg-white rounded-lg shadow-sm border border-[#F5F5F5] p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-[#1E1E1E]">
                                Menu for {selectedCafe.name}
                            </h2>
                            {loading && (
                                <Loader2 className="w-5 h-5 animate-spin text-[#1E1E1E]" />
                            )}
                        </div>

                        {menu && menu.sections && menu.sections.length > 0 ? (
                            <div className="space-y-2">
                                {menu.sections.map((section) => (
                                    <div key={section.id} className="border border-[#F5F5F5] rounded-lg">
                                        <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors">
                                            <button
                                                type="button"
                                                onClick={() => toggleSection(section.id)}
                                                className="flex items-center gap-3 text-left"
                                            >
                                                {expandedSections[section.id] ? (
                                                    <ChevronDown className="w-5 h-5 text-[#1E1E1E]" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5 text-[#1E1E1E]" />
                                                )}
                                                <Utensils className="w-5 h-5 text-[#1E1E1E]" />
                                                <span className="font-semibold text-[#1E1E1E]">{section.name}</span>
                                                <span className="text-sm text-[#1E1E1E]">
                                                    ({section.items?.length || 0} items)
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAddDish(section)}
                                                className="px-3 py-1 bg-[#e53935] text-white rounded-lg hover:bg-[#d32f2f] transition-colors text-sm flex items-center gap-1"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Dish
                                            </button>
                                        </div>

                                        {expandedSections[section.id] && (
                                            <div className="px-4 pb-4 border-t border-[#F5F5F5]">
                                                <div className="mt-3 space-y-2">
                                                    {section.items && section.items.length > 0 ? (
                                                        section.items.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center gap-3 p-3 bg-[#F5F5F5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                                                            >
                                                                {item.image && (
                                                                    <img
                                                                        src={item.image}
                                                                        alt={item.name}
                                                                        className="w-16 h-16 object-cover rounded"
                                                                    />
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-[#1E1E1E] truncate">{item.name}</div>
                                                                    <div className="text-sm text-[#1E1E1E]">
                                                                        ₹{item.price} • {item.foodType}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-sm font-semibold text-[#1E1E1E]">
                                                                        ₹{item.price}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleEditDish(item, section)}
                                                                        className="p-2 text-[#e53935] hover:bg-[#FFF8E1] rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteDish(item, section)}
                                                                        disabled={deletingDish}
                                                                        className="p-2 text-[#e53935] hover:bg-[#FFF8E1] rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Delete"
                                                                    >
                                                                        {deletingDish ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-center py-8 text-[#1E1E1E]">
                                                            No dishes in this section
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-[#1E1E1E]">
                                {loading ? (
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                ) : (
                                    <>
                                        <p className="mb-4">No menu sections found</p>
                                        <p className="text-sm mb-6">Menu will be created when you add the first dish</p>
                                        <button
                                            onClick={() => {
                                                setSelectedSection(null)
                                                setEditingDish(null)
                                                setFormData(getEmptyDishForm())
                                                setShowAddDishModal(true)
                                            }}
                                            className="px-4 py-2 bg-[#e53935] text-white rounded-lg hover:bg-[#d32f2f] transition-colors text-sm flex items-center gap-2 mx-auto"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add First Dish
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!selectedCafe && (
                    <div className="bg-white rounded-lg shadow-sm border border-[#F5F5F5] p-12 text-center">
                        <Utensils className="w-16 h-16 text-[#1E1E1E] mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#1E1E1E] mb-2">
                            Select a Cafe
                        </h3>
                        <p className="text-[#1E1E1E]">
                            Choose a cafe from the list above to view and manage its menu
                        </p>
                    </div>
                )}
            </div>

            {/* Add Dish Modal */}
            {showAddDishModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 z-20 bg-white border-b border-[#F5F5F5] px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#1E1E1E]">
                                {editingDish ? "Edit Dish" : "Add Dish"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAddDishModal(false)
                                    setEditingDish(null)
                                    // Reset form when closing
                                    setFormData(getEmptyDishForm())
                                }}
                                className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-[#1E1E1E]" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Category Selection */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Category</h3>
                                <select
                                    value={formData.selectedCategoryId}
                                    onChange={(e) => {
                                        const nextCategory = findGlobalCategoryById(e.target.value)
                                        setFormData((prev) => ({
                                            ...prev,
                                            selectedCategoryId: e.target.value,
                                            category: nextCategory?.name || "",
                                            /* add-ons category correlation disabled
                                            addonCategoryId: prev.useManualAddonCategory
                                                ? (prev.addonCategoryId || e.target.value)
                                                : "",
                                            */
                                        }))
                                    }}
                                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                >
                                    <option value="">Select Category</option>
                                    {globalCategories.map((cat) => {
                                        const categoryKey = getCategoryKey(cat)
                                        return (
                                            <option key={categoryKey} value={categoryKey}>
                                                {cat.name}
                                            </option>
                                        )
                                    })}
                                </select>
                                <p className="text-sm text-[#1E1E1E]/70 mt-2">
                                    Categories are managed from the admin categories dashboard.
                                </p>
                            </div>

                            {/* Add-ons category correlation disabled
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Add-on Category Correlation</h3>
                                <p className="text-sm text-[#1E1E1E] mb-3">Select the global category to link add-ons for this dish</p>
                                <label className="flex items-center gap-2 text-sm text-[#1E1E1E] mb-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.useManualAddonCategory}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked
                                            setFormData((prev) => ({
                                                ...prev,
                                                useManualAddonCategory: isChecked,
                                                addonCategoryId: isChecked
                                                    ? (prev.addonCategoryId || prev.selectedCategoryId)
                                                    : "",
                                            }))
                                        }}
                                        className="rounded border-[#D9D9D9] text-[#e53935] focus:ring-[#e53935]"
                                    />
                                    Create manual add-on category correlation
                                </label>

                                {formData.useManualAddonCategory ? (
                                    <select
                                        value={formData.addonCategoryId}
                                        onChange={(e) => setFormData({ ...formData, addonCategoryId: e.target.value })}
                                        className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                    >
                                        <option value="">Select Global Category</option>
                                        {globalCategories.map((cat) => {
                                            const categoryKey = getCategoryKey(cat)
                                            return (
                                                <option key={categoryKey} value={categoryKey}>
                                                    {cat.name}
                                                </option>
                                            )
                                        })}
                                    </select>
                                ) : (
                                    <div className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg bg-[#FAFAFA] text-sm text-[#1E1E1E]/80">
                                        {findGlobalCategoryById(formData.selectedCategoryId)?.name || "Select category first"}
                                    </div>
                                )}
                            </div>
                            */}

                            {/* Basic Information */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Basic Information</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                            Dish Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: capitalizeWords(e.target.value) })}
                                            onBlur={(e) => setFormData({ ...formData, name: collapseSpaces(e.target.value) })}
                                            maxLength={80}
                                            autoComplete="off"
                                            placeholder="Enter dish name"
                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                            Item Description
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            onBlur={(e) => setFormData({ ...formData, description: trimEdges(e.target.value) })}
                                            maxLength={300}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                            placeholder="Describe the dish..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Image</h3>
                                <div className="flex items-center gap-4">
                                    {formData.image && (
                                        <img
                                            src={formData.image}
                                            alt="Dish"
                                            className="w-32 h-32 object-cover rounded-lg"
                                        />
                                    )}
                                    <label className="flex items-center gap-2 px-4 py-2 bg-[#e53935] text-white rounded-lg hover:bg-[#d32f2f] cursor-pointer transition-colors">
                                        {!formData.image && <Upload className="w-5 h-5" />}
                                        {formData.image ? "Uploaded" : "Upload Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e.target.files[0])}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Variants Toggle */}
                            <div>
                                <div className="flex items-center justify-between p-4 border border-[#F5F5F5] rounded-lg bg-[#F5F5F5]">
                                    <div>
                                        <span className="text-sm font-medium text-[#1E1E1E]">Enable Variants</span>
                                        <p className="text-xs text-[#1E1E1E] mt-1">
                                            Add multiple sizes/prices (e.g., Small, Medium, Large)
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (formData.hasVariants) {
                                                // Disabling variants - clear variants array
                                                setFormData({ ...formData, hasVariants: false, variants: [] })
                                            } else {
                                                // Enabling variants - add first variant
                                                setFormData({
                                                    ...formData,
                                                    hasVariants: true,
                                                    variants: [{
                                                        id: `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                        name: "",
                                                        price: 0,
                                                        stock: "Unlimited",
                                                    }],
                                                })
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.hasVariants ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.hasVariants ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Variants Section */}
                            {formData.hasVariants && (
                                <div>
                                    <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Variants</h3>
                                    <div className="space-y-4">
                                        {formData.variants.map((variant, index) => (
                                            <div
                                                key={variant.id}
                                                className="p-4 border border-[#F5F5F5] rounded-lg bg-[#F5F5F5]"
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-medium text-[#1E1E1E]">
                                                        Variant {index + 1}
                                                    </span>
                                                    {formData.variants.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveVariant(variant.id)}
                                                            className="p-1 text-[#e53935] hover:bg-[#FFF8E1] rounded transition-colors"
                                                            title="Remove variant"
                                                        >
                                                            <Minus className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                                            Size/Name * (e.g., Small, Medium, Large)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={variant.name}
                                                            onChange={(e) =>
                                                                handleUpdateVariant(variant.id, "name", capitalizeWords(e.target.value))
                                                            }
                                                            onBlur={(e) =>
                                                                handleUpdateVariant(variant.id, "name", collapseSpaces(e.target.value))
                                                            }
                                                            maxLength={40}
                                                            autoComplete="off"
                                                            placeholder="e.g., Small, Medium, Large"
                                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                                            Price (INR) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={variant.price}
                                                            onFocus={(e) =>
                                                                handleUpdateVariant(variant.id, "price", normalizePriceOnFocus(e.target.value))
                                                            }
                                                            onChange={(e) =>
                                                                handleUpdateVariant(variant.id, "price", sanitizePriceInput(e.target.value))
                                                            }
                                                            min="0"
                                                            inputMode="decimal"
                                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={handleAddVariant}
                                            className="w-full px-4 py-2 border-2 border-dashed border-[#F5F5F5] rounded-lg hover:border-[#e53935] hover:bg-[#FFF8E1] transition-colors flex items-center justify-center gap-2 text-[#1E1E1E] hover:text-[#e53935]"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Another Variant
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Price & Food Type */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Price & Food Type</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                            {formData.hasVariants ? "Base Price (INR)" : "Price (INR) *"}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.price}
                                            onFocus={(e) =>
                                                setFormData({ ...formData, price: normalizePriceOnFocus(e.target.value) })
                                            }
                                            onChange={(e) => setFormData({ ...formData, price: sanitizePriceInput(e.target.value) })}
                                            min="0"
                                            inputMode="decimal"
                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                            disabled={formData.hasVariants}
                                            required={!formData.hasVariants}
                                        />
                                        {formData.hasVariants && (
                                            <p className="text-xs text-[#1E1E1E] mt-1">
                                                Base price will be set to minimum variant price
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#1E1E1E] mb-2">
                                            Food Type
                                        </label>
                                        <select
                                            value={formData.foodType}
                                            onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
                                            className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                        >
                                            <option value="Veg">Veg</option>
                                            <option value="Non-Veg">Non-Veg</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Preparation Time */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Preparation Time</h3>
                                <select
                                    value={formData.preparationTime}
                                    onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]"
                                >
                                    <option value="">Select timing</option>
                                    {preparationTimeOptions.map((time) => (
                                        <option key={time} value={time}>
                                            {time}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Toggles */}
                            <div>
                                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-4">Settings</h3>
                                <div className="space-y-4">
                                    {/* Stock Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium text-[#1E1E1E]">Stock</span>
                                            <p className="text-xs text-[#1E1E1E] mt-1">
                                                {formData.stock ? "In Stock" : "Out of Stock"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, stock: !formData.stock })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.stock ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.stock ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Recommended Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium text-[#1E1E1E]">Recommended</span>
                                            <p className="text-xs text-[#1E1E1E] mt-1">
                                                Show as recommended dish
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isRecommended: !formData.isRecommended })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isRecommended ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isRecommended ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Available Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium text-[#1E1E1E]">Available</span>
                                            <p className="text-xs text-[#1E1E1E] mt-1">
                                                Make dish available for ordering
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isAvailable ? 'bg-[#e53935]' : 'bg-[#F5F5F5]'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white border-t border-[#F5F5F5] px-6 py-4 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAddDishModal(false)
                                    setEditingDish(null)
                                    // Reset form when canceling
                                    setFormData(getEmptyDishForm())
                                }}
                                className="px-4 py-2 border border-[#F5F5F5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDish}
                                disabled={saving}
                                className="px-4 py-2 bg-[#e53935] text-white rounded-lg hover:bg-[#d32f2f] transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingDish ? "Update Dish" : "Save Dish"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


