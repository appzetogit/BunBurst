import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, User, MapPin, Car, FileText, ChevronRight } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"

// Indian vehicle registration number format: MH12AB1234, DL8CAB1234, KA03MX9876
const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/

export default function SignupStep1() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    vehicleType: "bike",
    vehicleName: "",
    vehicleNumber: "",
    panNumber: "",
    aadharNumber: ""
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill form: first from sessionStorage (instant), then API as fallback
  useEffect(() => {
    // 1. Load immediately from sessionStorage (set when user submits Step 1)
    const saved = sessionStorage.getItem('deliverySignupStep1')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData(prev => ({ ...prev, ...parsed }))
        return // already have data, no need to hit API
      } catch { /* ignore parse errors */ }
    }
    // 2. Fallback: fetch from API (if sessionStorage is empty)
    const prefill = async () => {
      try {
        const res = await deliveryAPI.getProfile()
        const p = res?.data?.data || res?.data
        if (!p) return
        setFormData(prev => ({
          ...prev,
          name: p.name || "",
          email: p.email || "",
          address: p.address || "",
          city: p.city || "",
          state: p.state || "",
          vehicleType: p.vehicle?.type || "bike",
          vehicleName: p.vehicle?.name || "",
          vehicleNumber: p.vehicle?.number || "",
          panNumber: p.panNumber || "",
          aadharNumber: p.aadharNumber || "",
        }))
      } catch { /* silently ignore */ }
    }
    prefill()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Real-time vehicle number validation
    if (name === 'vehicleNumber') {
      const upper = value.toUpperCase().trim()
      if (!upper) {
        setErrors(prev => ({ ...prev, vehicleNumber: '' }))
      } else if (!VEHICLE_NUMBER_REGEX.test(upper)) {
        setErrors(prev => ({ ...prev, vehicleNumber: 'Invalid format · e.g., MH12AB1234' }))
      } else {
        setErrors(prev => ({ ...prev, vehicleNumber: '' }))
      }
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email format"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.city.trim()) newErrors.city = "City is required"
    if (!formData.state.trim()) newErrors.state = "State is required"
    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required'
    } else if (!VEHICLE_NUMBER_REGEX.test(formData.vehicleNumber.trim().toUpperCase())) {
      newErrors.vehicleNumber = 'Invalid format · e.g., MH12AB1234'
    }
    if (!formData.panNumber.trim()) {
      newErrors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.toUpperCase())) {
      newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }
    if (!formData.aadharNumber.trim()) {
      newErrors.aadharNumber = "Aadhar number is required"
    } else if (!/^\d{12}$/.test(formData.aadharNumber.replace(/\s/g, ""))) {
      newErrors.aadharNumber = "Aadhar number must be 12 digits"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      toast.error("Please fill all required fields correctly")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await deliveryAPI.submitSignupDetails({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicleType: formData.vehicleType,
        vehicleName: formData.vehicleName.trim() || null,
        vehicleNumber: formData.vehicleNumber.trim(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      })
      if (response?.data?.success) {
        // Persist to sessionStorage so navigating back pre-fills the form
        sessionStorage.setItem('deliverySignupStep1', JSON.stringify(formData))
        toast.success("Details saved successfully")
        navigate("/delivery/signup/documents")
      }
    } catch (error) {
      console.error("Error submitting signup details:", error)
      const message = error?.response?.data?.message || "Failed to save details. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputStyle = (hasError) => ({
    border: `1.5px solid ${hasError ? '#e53935' : '#EEEEEE'}`,
    color: '#1E1E1E',
    backgroundColor: '#FAFAFA',
    borderRadius: '10px',
    transition: 'border-color 0.2s',
    width: '100%',
  })

  const labelStyle = { color: '#1E1E1E', fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>

      {/* Sticky Header */}
      <div
        className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ borderBottom: '1.5px solid #F5F5F5', boxShadow: '0 1px 10px rgba(0,0,0,0.07)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full"
          style={{ backgroundColor: '#F5F5F5', color: '#1E1E1E' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-[15px] font-bold" style={{ color: '#1E1E1E' }}>Complete Your Profile</h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#1E1E1E', opacity: 0.45 }}>Step 1 of 2 · Basic Details</p>
        </div>
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-1.5 rounded-full" style={{ backgroundColor: '#e53935' }} />
          <div className="w-7 h-1.5 rounded-full" style={{ backgroundColor: '#EEEEEE' }} />
        </div>
      </div>

      <div className="px-4 pt-4 pb-10 space-y-4">

        {/* ── Personal Info Card ── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0F0' }}>
              <User className="w-4 h-4" style={{ color: '#e53935' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Personal Information</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name <span style={{ color: '#e53935' }}>*</span></label>
              <input
                type="text" name="name" value={formData.name}
                onChange={handleChange}
                className="px-4 py-3 outline-none text-sm"
                style={inputStyle(errors.name)}
                placeholder="Enter your full name"
              />
              {errors.name && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.name}</p>}
            </div>
            {/* Email */}
            <div>
              <label style={labelStyle}>
                Email &nbsp;<span style={{ color: '#1E1E1E', opacity: 0.4, fontWeight: 400, fontSize: '11px' }}>(Optional)</span>
              </label>
              <input
                type="email" name="email" value={formData.email}
                onChange={handleChange}
                className="px-4 py-3 outline-none text-sm"
                style={inputStyle(errors.email)}
                placeholder="Enter your email address"
              />
              {errors.email && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.email}</p>}
            </div>
          </div>
        </div>

        {/* ── Address Card ── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEA' }}>
              <MapPin className="w-4 h-4" style={{ color: '#FFC400' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Address Details</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Address */}
            <div>
              <label style={labelStyle}>Address <span style={{ color: '#e53935' }}>*</span></label>
              <textarea
                name="address" value={formData.address}
                onChange={handleChange} rows={2}
                className="px-4 py-3 outline-none text-sm resize-none"
                style={inputStyle(errors.address)}
                placeholder="Enter your full address"
              />
              {errors.address && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.address}</p>}
            </div>
            {/* City + State */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>City <span style={{ color: '#e53935' }}>*</span></label>
                <input
                  type="text" name="city" value={formData.city}
                  onChange={handleChange}
                  className="px-4 py-3 outline-none text-sm"
                  style={inputStyle(errors.city)} placeholder="City"
                />
                {errors.city && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.city}</p>}
              </div>
              <div>
                <label style={labelStyle}>State <span style={{ color: '#e53935' }}>*</span></label>
                <input
                  type="text" name="state" value={formData.state}
                  onChange={handleChange}
                  className="px-4 py-3 outline-none text-sm"
                  style={inputStyle(errors.state)} placeholder="State"
                />
                {errors.state && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.state}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Vehicle Card ── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0F0' }}>
              <Car className="w-4 h-4" style={{ color: '#e53935' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Vehicle Details</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Vehicle Type toggle buttons */}
            <div>
              <label style={labelStyle}>Vehicle Type <span style={{ color: '#e53935' }}>*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {['bike', 'scooter', 'bicycle', 'car'].map(type => (
                  <button
                    key={type} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, vehicleType: type }))}
                    className="py-2.5 rounded-xl text-xs font-semibold capitalize transition-all"
                    style={{
                      backgroundColor: formData.vehicleType === type ? '#e53935' : '#F5F5F5',
                      color: formData.vehicleType === type ? '#fff' : '#555',
                      border: `1.5px solid ${formData.vehicleType === type ? '#e53935' : '#EEEEEE'}`,
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            {/* Vehicle Model */}
            <div>
              <label style={labelStyle}>
                Vehicle Model &nbsp;<span style={{ color: '#1E1E1E', opacity: 0.4, fontWeight: 400, fontSize: '11px' }}>(Optional)</span>
              </label>
              <input
                type="text" name="vehicleName" value={formData.vehicleName}
                onChange={handleChange}
                className="px-4 py-3 outline-none text-sm"
                style={inputStyle(false)} placeholder="e.g., Honda Activa"
              />
            </div>
            {/* Vehicle Number */}
            <div>
              <label style={labelStyle}>Vehicle Number <span style={{ color: '#e53935' }}>*</span></label>
              <input
                type="text" name="vehicleNumber" value={formData.vehicleNumber}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase()
                  setFormData(prev => ({ ...prev, vehicleNumber: upper }))
                  if (!upper) {
                    setErrors(prev => ({ ...prev, vehicleNumber: '' }))
                  } else if (!VEHICLE_NUMBER_REGEX.test(upper.trim())) {
                    setErrors(prev => ({ ...prev, vehicleNumber: 'Invalid format · e.g., MH12AB1234' }))
                  } else {
                    setErrors(prev => ({ ...prev, vehicleNumber: '' }))
                  }
                }}
                className="px-4 py-3 outline-none text-sm font-bold tracking-widest"
                style={{ ...inputStyle(errors.vehicleNumber), textTransform: 'uppercase' }}
                placeholder="e.g., MH12AB1234"
              />
              {errors.vehicleNumber && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.vehicleNumber}</p>}
            </div>
          </div>
        </div>

        {/* ── Documents Card ── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEA' }}>
              <FileText className="w-4 h-4" style={{ color: '#FFC400' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Identity Documents</span>
          </div>
          <div className="p-4 space-y-4">
            {/* PAN */}
            <div>
              <label style={labelStyle}>PAN Number <span style={{ color: '#e53935' }}>*</span></label>
              <input
                type="text" name="panNumber" value={formData.panNumber}
                onChange={handleChange} maxLength={10}
                className="px-4 py-3 outline-none text-sm uppercase font-bold tracking-widest"
                style={inputStyle(errors.panNumber)} placeholder="ABCDE1234F"
              />
              {errors.panNumber && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.panNumber}</p>}
            </div>
            {/* Aadhar */}
            <div>
              <label style={labelStyle}>Aadhar Number <span style={{ color: '#e53935' }}>*</span></label>
              <input
                type="text" name="aadharNumber" value={formData.aadharNumber}
                onChange={handleChange} maxLength={12}
                className="px-4 py-3 outline-none text-sm font-bold tracking-widest"
                style={inputStyle(errors.aadharNumber)} placeholder="1234 5678 9012"
              />
              {errors.aadharNumber && <p className="text-xs mt-1 font-medium" style={{ color: '#e53935' }}>{errors.aadharNumber}</p>}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            backgroundColor: isSubmitting ? '#EEE' : '#e53935',
            color: isSubmitting ? '#999' : '#fff',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: isSubmitting ? 'none' : '0 6px 20px rgba(229,57,53,0.3)',
          }}
        >
          {isSubmitting ? "Saving..." : (
            <>
              Save & Continue
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

      </div>
    </div>
  )
}
