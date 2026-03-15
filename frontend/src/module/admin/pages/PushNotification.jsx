import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Bell, Edit, Trash2, Upload, Image as ImageIcon } from "lucide-react"
import { adminAPI, uploadAPI } from "@/lib/api"
// Using placeholders for notification images
const notificationImage1 = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop"
const notificationImage2 = "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=400&fit=crop"
const notificationImage3 = "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=400&fit=crop"

const notificationImages = {
  15: notificationImage1,
  17: notificationImage2,
  18: notificationImage3,
}

export default function PushNotification() {
  const [formData, setFormData] = useState({
    title: "",
    zone: "All",
    sendTo: "Customer",
    description: "",
    imageUrl: "",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [notifications, setNotifications] = useState([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const fetchNotifications = async (query = "") => {
    try {
      setLoading(true)
      const response = await adminAPI.getAdminNotifications(query ? { search: query } : {})
      const items = response?.data?.data?.notifications || []
      setNotifications(items)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchNotifications(searchQuery.trim())
    }, 400)

    return () => clearTimeout(handler)
  }, [searchQuery])

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications
    }
    
    const query = searchQuery.toLowerCase().trim()
    return notifications.filter(notification =>
      String(notification.title || "").toLowerCase().includes(query) ||
      String(notification.description || "").toLowerCase().includes(query)
    )
  }, [notifications, searchQuery])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      event.target.value = ""
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be 2 MB or less")
      event.target.value = ""
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)

    try {
      setUploadingImage(true)
      const response = await uploadAPI.uploadMedia(file, { folder: "admin/notifications" })
      const url = response?.data?.data?.url
      if (!url) {
        throw new Error("Image upload failed")
      }
      setFormData(prev => ({ ...prev, imageUrl: url }))
    } catch (error) {
      console.error("Failed to upload image:", error)
      alert(error?.response?.data?.message || error?.message || "Failed to upload image")
      setPreviewUrl("")
      setFormData(prev => ({ ...prev, imageUrl: "" }))
    } finally {
      setUploadingImage(false)
      event.target.value = ""
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Title and Description are required")
      return
    }

    try {
      setSending(true)
      const response = editingId
        ? await adminAPI.updateAdminNotification(editingId, formData)
        : await adminAPI.sendPushNotification(formData)
      const data = response?.data?.data || {}
      if (editingId) {
        const updated = data.notification
        if (updated) {
          setNotifications(prev => prev.map(item => item._id === updated._id ? updated : item))
        } else {
          await fetchNotifications(searchQuery.trim())
        }
        alert("Notification updated successfully")
      } else {
        alert(
          `Push notification sent.\nDelivered: ${data.sentCount || 0}\nFailed: ${data.failedCount || 0}\nTotal Tokens: ${data.totalTokens || 0}`
        )
        if (data.notification) {
          setNotifications(prev => [data.notification, ...prev])
        } else {
          await fetchNotifications(searchQuery.trim())
        }
      }
      handleReset()
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to send notification"
      alert(message)
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setFormData({
      title: "",
      zone: "All",
      sendTo: "Customer",
      description: "",
      imageUrl: "",
    })
    setPreviewUrl("")
    setEditingId(null)
  }

  const handleToggleStatus = async (id, nextStatus) => {
    try {
      await adminAPI.updateAdminNotificationStatus(id, nextStatus)
      setNotifications(prev => prev.map(notification =>
        notification._id === id ? { ...notification, status: nextStatus } : notification
      ))
    } catch (error) {
      console.error("Failed to update notification status:", error)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notification?")) {
      return
    }

    try {
      await adminAPI.deleteAdminNotification(id)
      setNotifications(prev => prev.filter(notification => notification._id !== id))
    } catch (error) {
      console.error("Failed to delete notification:", error)
    }
  }

  const handleEdit = (notification) => {
    setEditingId(notification._id || null)
    setFormData({
      title: notification.title || "",
      zone: notification.zone || "All",
      sendTo: notification.sendTo || notification.target || "Customer",
      description: notification.description || "",
      imageUrl: notification.imageUrl || notification.image || "",
    })
    setPreviewUrl(notification.imageUrl || notification.image || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const exportCSV = (rows) => {
    const headers = ["Title", "Description", "Zone", "Target", "Status", "Created At"]
    const csvRows = [
      headers.join(","),
      ...rows.map((row) => {
        const status = row.status ? "Active" : "Inactive"
        const createdAt = row.createdAt ? new Date(row.createdAt).toLocaleString() : ""
        const values = [
          row.title,
          row.description,
          row.zone,
          row.sendTo || row.target,
          status,
          createdAt
        ]
        return values.map(value => `"${String(value ?? "").replace(/\"/g, "\"\"")}"`).join(",")
      })
    ]
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `notifications_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Create New Notification Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-[#e53935]" />
            <h1 className="text-2xl font-bold text-[#1E1E1E]">Notification</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Ex: Notification Title"
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-sm text-[#1E1E1E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                  Zone
                </label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleInputChange("zone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-sm text-[#1E1E1E]"
                >
                  <option value="All">All</option>
                  <option value="Asia">Asia</option>
                  <option value="Europe">Europe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                  Send To
                </label>
                <select
                  value={formData.sendTo}
                  onChange={(e) => handleInputChange("sendTo", e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-sm text-[#1E1E1E]"
                >
                  <option value="Customer">Customer</option>
                  <option value="Delivery Man">Delivery Man</option>
                </select>
              </div>
            </div>

            {/* Notification Banner Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-3">
                Notification banner
              </label>
              <input
                id="notification-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="notification-image-upload"
                className="border-2 border-dashed border-[#F5F5F5] rounded-lg p-10 text-center hover:border-[#FFC400] transition-colors cursor-pointer block"
              >
                {previewUrl || formData.imageUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-full max-w-md rounded-lg overflow-hidden border border-[#F5F5F5]">
                      <img
                        src={previewUrl || formData.imageUrl}
                        alt="Notification banner preview"
                        className="w-full h-40 object-cover"
                      />
                    </div>
                    <span className="text-sm font-medium text-[#1E1E1E]">
                      {uploadingImage ? "Uploading..." : "Click to replace image"}
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-[#1E1E1E] mx-auto mb-3" />
                    <p className="text-sm font-medium text-[#e53935] mb-1">
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                    </p>
                    <p className="text-xs text-[#1E1E1E]">
                      Image format - jpg png jpeg gif webp Image Size - maximum size 2 MB Image Ratio - 3:1
                    </p>
                  </>
                )}
              </label>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1E1E1E] mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Ex: Notification Descriptions"
                rows={4}
                className="w-full px-4 py-2.5 border border-[#F5F5F5] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-sm resize-none text-[#1E1E1E]"
              />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] transition-all"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={sending || uploadingImage}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#e53935] text-white hover:bg-[#d32f2f] transition-all shadow-md disabled:opacity-60"
                >
                  {sending ? "Saving..." : editingId ? "Update Notification" : "Send Notification"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Notification List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1E1E1E]">Notification List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#FFC400]/20 text-[#1E1E1E]">
                {filteredNotifications.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#F5F5F5] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:border-[#FFC400] text-[#1E1E1E]"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E1E1E]" />
              </div>

              <div className="relative">
                <button
                  onClick={() => setExportOpen(prev => !prev)}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#F5F5F5] bg-white hover:bg-[#F5F5F5] text-[#1E1E1E] flex items-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4 text-[#1E1E1E]" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-[#1E1E1E]" />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-[#F5F5F5] rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        exportCSV(filteredNotifications)
                        setExportOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#1E1E1E] hover:bg-[#F5F5F5]"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        exportCSV(notifications)
                        setExportOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#1E1E1E] hover:bg-[#F5F5F5]"
                    >
                      Export All
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F5F5] border-b border-[#F5F5F5]">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Image</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-[#1E1E1E] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F5F5F5]">
                {filteredNotifications.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#1E1E1E]">
                      No notifications found
                    </td>
                  </tr>
                )}
                {filteredNotifications.map((notification, index) => {
                  const imageUrl = notification.imageUrl || notification.image
                  return (
                    <tr
                      key={notification._id || index}
                      className="hover:bg-[#F5F5F5] transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-[#1E1E1E]">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-[#1E1E1E]">{notification.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#1E1E1E]">{notification.description}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {imageUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F5F5F5]">
                            <img
                              src={imageUrl || notificationImages[notification.sl] || notificationImage1}
                              alt={notification.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none"
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-[#1E1E1E]" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#1E1E1E]">{notification.zone || "All"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#1E1E1E]">{notification.target || notification.sendTo || "Customer"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(notification._id, !notification.status)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFC400] focus:ring-offset-2 ${
                            notification.status ? "bg-[#e53935]" : "bg-[#F5F5F5]"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              notification.status ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(notification)}
                            className="p-1.5 rounded text-[#e53935] hover:bg-[#F5F5F5] transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(notification._id)}
                            className="p-1.5 rounded text-[#e53935] hover:bg-[#F5F5F5] transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
