import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Edit, Trash2, X, Check, Loader2, ArrowLeft, Image as ImageIcon, IndianRupee } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function CategoryAddons({ isOpen, onClose, category }) {
    const [addons, setAddons] = useState([])
    const [loading, setLoading] = useState(false)
    const [view, setView] = useState('list') // 'list' | 'form'
    const [editingAddon, setEditingAddon] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        price: "",
        description: "",
        isActive: true,
        image: ""
    })
    const [selectedImageFile, setSelectedImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (isOpen && category) {
            fetchAddons()
            setView('list')
            resetForm()
        }
    }, [isOpen, category])

    const fetchAddons = async () => {
        if (!category) return
        try {
            setLoading(true)
            const response = await adminAPI.getAddonsByCategory(category.id)
            if (response.data.success) {
                setAddons(response.data.data.addons || [])
            }
        } catch (error) {
            toast.error("Failed to fetch addons")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: "",
            price: "",
            description: "",
            isActive: true,
            image: ""
        })
        setEditingAddon(null)
        setSelectedImageFile(null)
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleEdit = (addon) => {
        setEditingAddon(addon)
        setFormData({
            name: addon.name || "",
            price: addon.price || 0,
            description: addon.description || "",
            isActive: addon.isActive !== false,
            image: addon.image || ""
        })
        setImagePreview(addon.image || null)
        setView('form')
    }

    const handleAddNew = () => {
        resetForm()
        setView('form')
    }

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size exceeds 5MB")
            return
        }

        setSelectedImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result)
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.name || !formData.price) {
            toast.error("Name and Price are required")
            return
        }

        try {
            setSaving(true)
            const formDataToSend = new FormData()
            formDataToSend.append('name', formData.name)
            formDataToSend.append('price', formData.price)
            formDataToSend.append('description', formData.description)
            formDataToSend.append('isActive', formData.isActive)
            formDataToSend.append('categoryId', category.id)

            if (selectedImageFile) {
                formDataToSend.append('image', selectedImageFile)
            } else if (formData.image) {
                formDataToSend.append('image', formData.image)
            }

            let response
            if (editingAddon) {
                response = await adminAPI.updateAddon(editingAddon.id || editingAddon._id, formDataToSend)
            } else {
                response = await adminAPI.createAddon(formDataToSend)
            }

            if (response.data.success) {
                toast.success(editingAddon ? "Addon updated" : "Addon created")
                fetchAddons()
                setView('list')
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to save addon")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm("Are you sure?")) return
        try {
            await adminAPI.deleteAddon(id)
            toast.success("Addon deleted")
            setAddons(prev => prev.filter(a => (a.id || a._id) !== id))
        } catch (error) {
            toast.error("Failed to delete addon")
        }
    }

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            await adminAPI.toggleAddonStatus(id)
            setAddons(prev => prev.map(a =>
                (a.id || a._id) === id ? { ...a, isActive: !a.isActive } : a
            ))
            toast.success("Status updated")
        } catch (error) {
            toast.error("Failed to update status")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b bg-slate-50/50">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        {view === 'list' ? (
                            <>
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <div>
                                    Addons for <span className="text-blue-600">{category?.name}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="icon" onClick={() => setView('list')}>
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                {editingAddon ? "Edit Addon" : "New Addon"}
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    {view === 'list' ? (
                        <div className="space-y-4">
                            <div className="flex justify-end mb-4">
                                <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Addon
                                </Button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : addons.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                                    No addons found used for this category
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {addons.map((addon) => (
                                        <div key={addon.id || addon._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                                            <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                                {addon.image ? (
                                                    <img src={addon.image} alt={addon.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                        <ImageIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 truncate">{addon.name}</h4>
                                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                    <span className="flex items-center text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                                                        ₹{addon.price}
                                                    </span>
                                                    {addon.description && <span className="truncate max-w-[200px]">{addon.description}</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <Switch
                                                    checked={addon.isActive}
                                                    onCheckedChange={() => handleToggleStatus(addon.id || addon._id)}
                                                />
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(addon)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(addon.id || addon._id)} className="h-8 w-8 text-red-500 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="space-y-4">
                                {/* Image Upload */}
                                <div className="relative group w-full h-48 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                                    onClick={() => fileInputRef.current?.click()}>
                                    {imagePreview ? (
                                        <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500">
                                            <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-medium">Click to upload image</span>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label>Addon Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., Extra Cheese"
                                            className="rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Price (₹)</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                type="number"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                placeholder="0.00"
                                                className="pl-9 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Description (Optional)</Label>
                                        <Textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Enter details about this addon..."
                                            className="rounded-xl min-h-[80px]"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Active Status</Label>
                                            <p className="text-xs text-slate-500">Enable or disable this addon</p>
                                        </div>
                                        <Switch
                                            checked={formData.isActive}
                                            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => setView('list')} className="flex-1 rounded-xl py-6">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-200">
                                    {saving ? <Loader2 className="animate-spin" /> : (editingAddon ? "Update Addon" : "Create Addon")}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
