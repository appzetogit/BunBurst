import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Trash2, Loader2, Plus, Edit2, Check, X, Sparkles, Tag, Upload } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { adminAPI, uploadAPI } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

export default function AddonsList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [addons, setAddons] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    categoryIds: [],
    isActive: true,
    description: "",
    image: "",
  })

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [addonsRes, categoriesRes] = await Promise.all([
        adminAPI.getAddons(),
        adminAPI.getCategories()
      ])

      if (addonsRes.data?.success) {
        setAddons(addonsRes.data.data.addons || [])
      }

      if (categoriesRes.data?.success) {
        setCategories(categoriesRes.data.data.categories || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load addons or categories")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (addon = null) => {
    if (addon) {
      setEditingAddon(addon)
      const mappedCategoryIds = Array.isArray(addon.categoryIds) && addon.categoryIds.length > 0
        ? addon.categoryIds.map((cat) => (cat?._id || cat?.id || cat)?.toString()).filter(Boolean)
        : [
          addon.categoryId?._id?.toString() ||
          addon.categoryId?.id?.toString() ||
          (typeof addon.categoryId === "string" ? addon.categoryId : "")
        ].filter(Boolean)

      setFormData({
        name: addon.name,
        price: addon.price,
        categoryIds: mappedCategoryIds,
        isActive: addon.isActive,
        description: addon.description || "",
        image: addon.image || "",
      })
    } else {
      setEditingAddon(null)
      setFormData({
        name: "",
        price: "",
        categoryIds: [],
        isActive: true,
        description: "",
        image: "",
      })
    }
    setIsModalOpen(true)
  }

  const handleAddonImageUpload = async (file) => {
    if (!file) return

    try {
      setUploadingImage(true)
      const response = await uploadAPI.uploadMedia(file, { folder: "addons" })
      if (response.data?.success && response.data?.data?.url) {
        setFormData((prev) => ({ ...prev, image: response.data.data.url }))
        toast.success("Addon image uploaded successfully")
      } else {
        toast.error("Failed to upload image")
      }
    } catch (error) {
      console.error("Error uploading addon image:", error)
      toast.error("Failed to upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.price || !Array.isArray(formData.categoryIds) || formData.categoryIds.length === 0) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setSubmitting(true)
      let response
      if (editingAddon) {
        response = await adminAPI.updateAddon(editingAddon._id, formData)
      } else {
        response = await adminAPI.createAddon(formData)
      }

      if (response.data?.success) {
        toast.success(`Addon ${editingAddon ? 'updated' : 'created'} successfully`)
        setIsModalOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error("Error submitting addon:", error)
      toast.error(error.response?.data?.message || "Failed to save addon")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this addon?")) return

    try {
      setDeletingId(id)
      const response = await adminAPI.deleteAddon(id)
      if (response.data?.success) {
        toast.success("Addon deleted successfully")
        setAddons(addons.filter(a => a._id !== id))
      }
    } catch (error) {
      console.error("Error deleting addon:", error)
      toast.error("Failed to delete addon")
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleAddonStatus(id)
      if (response.data?.success) {
        setAddons(addons.map(a =>
          a._id === id ? { ...a, isActive: !a.isActive } : a
        ))
        toast.success(`Addon ${response.data.data.addon.isActive ? 'activated' : 'deactivated'}`)
      }
    } catch (error) {
      console.error("Error toggling status:", error)
      toast.error("Failed to update status")
    }
  }

  const filteredAddons = useMemo(() => {
    return addons.filter(addon =>
      addon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(addon.categoryIds) && addon.categoryIds.some((cat) =>
        cat?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )) ||
      addon.categoryId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [addons, searchQuery])

  const getAddonCategoryNames = (addon) => {
    if (Array.isArray(addon.categoryIds) && addon.categoryIds.length > 0) {
      return addon.categoryIds
        .map((cat) => cat?.name || "")
        .filter(Boolean)
    }

    if (addon.categoryId?.name) {
      return [addon.categoryId.name]
    }

    return []
  }

  return (
    <div className="p-4 lg:p-8 bg-white min-h-screen text-[#1E1E1E]">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-sm border border-[#F5F5F5] p-8 mb-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#FFC400] flex items-center justify-center shadow-sm ring-4 ring-[#FFF8E1]">
              <Sparkles className="text-[#1E1E1E] w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1E1E1E] tracking-tight">Manage Addons</h1>
              <p className="text-[#1E1E1E]/70 font-medium flex items-center gap-2 mt-1">
                <Tag className="w-4 h-4 text-[#FFC400]" />
                Customize your menu extras and options
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative group">
              <Input
                type="text"
                placeholder="Search addons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-6 w-full lg:w-[320px] rounded-2xl border-[#F5F5F5] bg-white group-hover:bg-white group-focus:bg-white transition-all shadow-none focus:ring-[#FFC400]/20 focus:border-[#FFC400]"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E1E1E]/50 group-hover:text-[#1E1E1E] transition-colors" />
            </div>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-[#e53935] hover:bg-[#d32f2f] text-white py-6 px-8 rounded-2xl shadow-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 mr-2 stroke-[3px]" />
              New Addon
            </Button>
          </div>
        </div>
      </motion.div>

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
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Name</th>
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Categories</th>
                <th className="px-8 py-5 text-left text-xs font-bold text-[#1E1E1E]/60 uppercase tracking-widest">Price</th>
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
                      <p className="text-[#1E1E1E]/60 font-medium animate-pulse">Fetching your addons...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAddons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-16 bg-[#FFF8E1] rounded-full flex items-center justify-center mb-2">
                        <Search className="w-8 h-8 text-[#1E1E1E]/30" />
                      </div>
                      <p className="text-[#1E1E1E] font-bold text-lg">No addons found</p>
                      <p className="text-[#1E1E1E]/60">Try adjusting your search or add a new one</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredAddons.map((addon, index) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={addon._id}
                      className="hover:bg-[#FFFDF5] transition-all group"
                    >
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-[#1E1E1E]/50">{index + 1}</td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="font-bold text-[#1E1E1E] group-hover:text-[#e53935] transition-colors">{addon.name}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          {getAddonCategoryNames(addon).length > 0 ? (
                            getAddonCategoryNames(addon).map((name) => (
                              <Badge
                                key={`${addon._id}-${name}`}
                                variant="secondary"
                                className="bg-[#FFF8E1] text-[#1E1E1E] border border-[#F5F5F5] px-3 py-1 rounded-lg font-semibold transition-all"
                              >
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="bg-[#FFF8E1] text-[#1E1E1E] border border-[#F5F5F5] px-3 py-1 rounded-lg font-semibold">
                              Uncategorized
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-[#1E1E1E]">
                          <span className="text-[#FFC400] text-xs">Rs</span>
                          <span>{addon.price.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={addon.isActive}
                            onCheckedChange={() => handleToggleStatus(addon._id)}
                            className="data-[state=checked]:bg-[#e53935]"
                          />
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(addon)}
                            className="w-10 h-10 rounded-xl text-[#1E1E1E]/70 hover:bg-[#FFF8E1] hover:text-[#1E1E1E] transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(addon._id)}
                            disabled={deletingId === addon._id}
                            className="w-10 h-10 rounded-xl text-[#e53935] hover:bg-[#FDECEC] hover:text-[#d32f2f] transition-all"
                          >
                            {deletingId === addon._id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-[#e53935]" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[88vh] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <div className="bg-[#e53935] p-4 text-white relative">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogHeader className="p-0">
                    <DialogTitle className="text-xl font-bold text-white leading-tight">
                      {editingAddon ? 'Update Addon' : 'Create New Addon'}
                    </DialogTitle>
                    <p className="text-white/80 text-sm mt-0.5">
                      {editingAddon ? 'Modify existing addon details' : 'Add a new extra item to your menu'}
                    </p>
                  </DialogHeader>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 bg-white space-y-4 overflow-y-auto max-h-[calc(88vh-72px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-[#1E1E1E]">Addon Name *</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Extra Cheese, Peri Peri..."
                      required
                      className="pl-4 h-10 bg-white border-[#F5F5F5] focus:bg-white focus:ring-[#FFC400]/20 focus:border-[#FFC400] transition-all rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryIds" className="text-sm font-semibold text-[#1E1E1E]">Categories *</Label>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-[#F5F5F5] bg-white p-2.5 space-y-1.5">
                    {categories && categories.length > 0 ? (
                      categories.map((cat) => {
                        const catId = (cat.id || cat._id || cat).toString()
                        const isChecked = formData.categoryIds.includes(catId)
                        return (
                          <label
                            key={catId}
                            className="flex items-center gap-2 text-sm text-[#1E1E1E] cursor-pointer py-0.5"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => {
                                  const next = new Set(prev.categoryIds)
                                  if (checked) next.add(catId)
                                  else next.delete(catId)
                                  return { ...prev, categoryIds: Array.from(next) }
                                })
                              }}
                            />
                            <span>{cat.name || "Unnamed Category"}</span>
                          </label>
                        )
                      })
                    ) : (
                      <div className="p-1 text-center text-xs text-[#1E1E1E]/60 italic">
                        No categories found
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-semibold text-[#1E1E1E]">Price * (Rs)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFC400] font-bold">Rs</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      required
                      className="pl-11 h-10 bg-white border-[#F5F5F5] focus:bg-white focus:ring-[#FFC400]/20 focus:border-[#FFC400] transition-all rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-[#1E1E1E]">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the addon..."
                    className="h-10 bg-white border-[#F5F5F5] focus:bg-white focus:ring-[#FFC400]/20 focus:border-[#FFC400] transition-all rounded-xl"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-semibold text-[#1E1E1E]">Addon Image (Optional)</Label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-[#F5F5F5] hover:bg-[#FFFDF5] cursor-pointer transition-all text-sm font-medium text-[#1E1E1E]">
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleAddonImageUpload(e.target.files?.[0])}
                        disabled={uploadingImage}
                      />
                    </label>
                    {formData.image ? (
                      <img
                        src={formData.image}
                        alt="Addon preview"
                        className="w-12 h-12 rounded-lg object-cover border border-[#F5F5F5]"
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-[#F5F5F5] transition-all hover:bg-[#FFFDF5]">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${formData.isActive ? 'bg-[#FFF8E1] text-[#FFC400]' : 'bg-[#F5F5F5] text-[#1E1E1E]/50'}`}>
                    <Check className={`w-4 h-4 transition-transform ${formData.isActive ? 'scale-110' : 'scale-90'}`} />
                  </div>
                  <div>
                    <Label htmlFor="isActive" className="text-sm font-bold text-[#1E1E1E] cursor-pointer block">
                      Active Status
                    </Label>
                    <p className="text-xs text-[#1E1E1E]/60">
                      {formData.isActive ? 'Addon will be visible in menu' : 'Addon will be hidden from menu'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  className="data-[state=checked]:bg-[#e53935]"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 h-10 rounded-xl text-[#1E1E1E]/70 hover:bg-[#FFFDF5] font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] h-10 bg-[#e53935] hover:bg-[#d32f2f] text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  {editingAddon ? 'Update Addon' : 'Create Addon'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AnimatePresence>
    </div>
  )
}

