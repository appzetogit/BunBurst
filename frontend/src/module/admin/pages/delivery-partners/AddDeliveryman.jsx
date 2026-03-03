import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Upload, Calendar, Eye, EyeOff, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function AddDeliveryman() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    deliverymanType: "",
    zone: "",
    vehicle: "",
    identityType: "Passport",
    identityNumber: "",
    age: "",
    birthdate: "",
    phone: "+1",
    password: "",
    confirmPassword: "",
    salary: "",
    joiningDate: new Date().toISOString().split('T')[0],
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigate = useNavigate()

  const imageRef = useRef(null)
  const identityImageRef = useRef(null)

  const handleImageChange = (e, field) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: file,
          [`${field}Preview`]: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.firstName.trim()) errors.firstName = "First name is required"
    if (!formData.lastName.trim()) errors.lastName = "Last name is required"
    if (!formData.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format"
    }
    if (!formData.deliverymanType) errors.deliverymanType = "Deliveryman type is required"
    if (!formData.zone) errors.zone = "Zone is required"
    if (!formData.vehicle) errors.vehicle = "Vehicle is required"
    if (!formData.identityNumber.trim()) errors.identityNumber = "Identity number is required"
    if (!formData.age || parseInt(formData.age) < 18) errors.age = "Age must be at least 18"
    if (!formData.birthdate) errors.birthdate = "Birthdate is required"
    if (!formData.phone || formData.phone.length < 10) errors.phone = "Valid phone number is required"
    if (!formData.password || formData.password.length < 8) errors.password = "Password must be at least 8 characters"
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Passwords do not match"
    if (!formData.salary) errors.salary = "Salary is required"
    if (!formData.joiningDate) errors.joiningDate = "Joining date is required"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Structure payload for backend
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        zone: formData.zone,
        vehicle: formData.vehicle,
        identityType: formData.identityType,
        identityNumber: formData.identityNumber,
        age: formData.age,
        birthdate: formData.birthdate,
        // Send salary as number (amount)
        salary: formData.salary,
        joiningDate: formData.joiningDate,
        // Handle images? AddDeliveryman implementation used refs but didn't actually upload to cloud in simulation
        // Assuming backend handles base64 or separate upload.
        // For this task, we focus on salary setup.
        // Backend createDeliveryPartner takes profileImage url.
        // We'll skip image upload logic unless critical.
      }

      await adminAPI.addDeliveryPartner(payload)
      setShowSuccessDialog(true)
      handleReset()
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || "Failed to create delivery partner")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      deliverymanType: "",
      zone: "",
      vehicle: "",
      identityType: "Passport",
      identityNumber: "",
      age: "",
      birthdate: "",
      phone: "+1",
      password: "",
      confirmPassword: "",
      salary: "",
      joiningDate: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
          {/* Settings Icon */}
          <button className="absolute top-6 right-6 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
            <Settings className="w-5 h-5 text-slate-600" />
          </button>

          <h1 className="text-2xl font-bold text-slate-900 mb-6">Add New Deliveryman</h1>

          <form onSubmit={handleSubmit}>
            {/* 1. General info */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">1. General info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    placeholder="Ex: Jhone"
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.firstName ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                  {formErrors.firstName && <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    placeholder="Ex: Joe"
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.lastName ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                  {formErrors.lastName && <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Ex: ex@example.com"
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.email ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Deliveryman Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.deliverymanType}
                    onChange={(e) => handleInputChange("deliverymanType", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Delivery man type</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Zone <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.zone}
                    onChange={(e) => handleInputChange("zone", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select Zone</option>
                    <option value="asia">Asia</option>
                    <option value="europe">Europe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    ref={imageRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'image')}
                  />
                  <div
                    onClick={() => imageRef.current.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden group"
                  >
                    {formData.imagePreview ? (
                      <div className="relative">
                        <img
                          src={formData.imagePreview}
                          alt="Profile Preview"
                          className="w-32 h-32 mx-auto object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <p className="text-white text-xs font-medium">Click to change</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-blue-600 mb-1">Click to upload Or drag and drop</p>
                        <p className="text-xs text-slate-500">JPG, JPEG, PNG, Gif Image size: Max 2 MB (1:1)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Identification Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">2. Identification Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Vehicle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.vehicle}
                    onChange={(e) => handleInputChange("vehicle", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select Vehicle</option>
                    <option value="car">Car</option>
                    <option value="motorcycle">Motorcycle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Identity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.identityType}
                    onChange={(e) => handleInputChange("identityType", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="National ID">National ID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Identity Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.identityNumber}
                    onChange={(e) => handleInputChange("identityNumber", e.target.value)}
                    placeholder="Ex: DH-23434-LS"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Identity Image
                  </label>
                  <input
                    type="file"
                    ref={identityImageRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleImageChange(e, 'identityImage')}
                  />
                  <div
                    onClick={() => identityImageRef.current.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden group"
                  >
                    {formData.identityImagePreview ? (
                      <div className="relative">
                        <img
                          src={formData.identityImagePreview}
                          alt="Identity Preview"
                          className="w-full h-32 object-contain rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <p className="text-white text-xs font-medium">Click to change</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-blue-600 mb-1">Select a file or Drag & Drop here</p>
                        <p className="text-xs text-slate-500">Pdf, doc, jpg. File size: max 2 MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Additional Data */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">3. Additional Data</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Enter your age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    placeholder="Enter Age"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Enter your birthdate <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.birthdate}
                      onChange={(e) => handleInputChange("birthdate", e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Driving license
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="file"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Account info */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">4. Account info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2.5 border border-slate-300 rounded-l-lg bg-slate-50 text-sm">
                      +1
                    </div>
                    <input
                      type="tel"
                      value={formData.phone.replace("+1", "")}
                      onChange={(e) => handleInputChange("phone", "+1" + e.target.value)}
                      placeholder="Enter phone number"
                      className="flex-1 px-4 py-2.5 border border-slate-300 border-l-0 rounded-r-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      placeholder="Ex: 8+ Character"
                      className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      placeholder="Ex: 8+ Character"
                      className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Salary Information */}
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-yellow-100 p-1 rounded">💰</span>
                5. Salary Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Monthly Fixed Salary (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => handleInputChange("salary", e.target.value)}
                    placeholder="Ex: 15000"
                    min="0"
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.salary ? "border-red-500" : "border-slate-300"}`}
                  />
                  {formErrors.salary && <p className="text-xs text-red-500 mt-1">{formErrors.salary}</p>}
                  <p className="text-xs text-slate-500 mt-1">This is a fixed monthly salary. No per-order commission.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Joining Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => handleInputChange("joiningDate", e.target.value)}
                      className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.joiningDate ? "border-red-500" : "border-slate-300"}`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {formErrors.joiningDate && <p className="text-xs text-red-500 mt-1">{formErrors.joiningDate}</p>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-green-600">Success!</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Deliveryman added successfully!
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => {
                setShowSuccessDialog(false)
                navigate('/admin/delivery-partners')
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
