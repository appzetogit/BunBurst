import { useState, useEffect } from "react"
import { Phone, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

export default function DeliveryEmergencyHelp() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
  })
  const [formErrors, setFormErrors] = useState({})

  const sanitizePhoneInput = (value = "") => {
    const allowed = String(value).replace(/[^\d\s\-\+\(\)]/g, "")
    // Keep only one '+' and only at the beginning
    const hasLeadingPlus = allowed.trimStart().startsWith("+")
    const withoutPlus = allowed.replace(/\+/g, "")
    const rebuilt = hasLeadingPlus ? `+${withoutPlus}` : withoutPlus
    // Collapse spaces
    return rebuilt.replace(/\s+/g, " ").trimStart().slice(0, 24)
  }

  const normalizeForDial = (value = "") => {
    const raw = String(value).trim()
    if (!raw) return ""
    const stripped = raw.replace(/[\s\-\(\)]/g, "")
    const hasPlus = stripped.startsWith("+")
    const digitsOnly = stripped.replace(/[^\d]/g, "")
    return hasPlus ? `+${digitsOnly}` : digitsOnly
  }

  const validatePhoneValue = (value = "") => {
    const normalized = normalizeForDial(value)
    if (!normalized) return ""
    const digitsOnly = normalized.startsWith("+") ? normalized.slice(1) : normalized
    if (/^0+$/.test(digitsOnly)) return "Invalid phone number"
    if (normalized.startsWith("+")) {
      const digits = normalized.slice(1)
      if (!/^\d{8,15}$/.test(digits)) return "Invalid phone number"
      return ""
    }
    if (!/^\d{3,15}$/.test(normalized)) return "Invalid phone number"
    return ""
  }

  // Fetch emergency help numbers on component mount
  useEffect(() => {
    fetchEmergencyHelp()
  }, [])

  const fetchEmergencyHelp = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getEmergencyHelp()

      if (response?.data?.success && response?.data?.data) {
        const data = response.data.data
        const safeValue = (value) => {
          if (!value) return ""
          const error = validatePhoneValue(value)
          return error ? "" : value
        }
        setFormData({
          medicalEmergency: safeValue(data.medicalEmergency),
          accidentHelpline: safeValue(data.accidentHelpline),
          contactPolice: safeValue(data.contactPolice),
          insurance: safeValue(data.insurance),
        })
      }
    } catch (error) {
      console.error("Error fetching emergency help:", error)
      toast.error("Failed to load emergency help numbers")
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}

    const medicalError = validatePhoneValue(formData.medicalEmergency)
    if (medicalError) errors.medicalEmergency = medicalError

    const accidentError = validatePhoneValue(formData.accidentHelpline)
    if (accidentError) errors.accidentHelpline = accidentError

    const policeError = validatePhoneValue(formData.contactPolice)
    if (policeError) errors.contactPolice = policeError

    const insuranceError = validatePhoneValue(formData.insurance)
    if (insuranceError) errors.insurance = insuranceError

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field, value) => {
    const sanitized = sanitizePhoneInput(value)
    setFormData(prev => ({
      ...prev,
      [field]: sanitized
    }))
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleInputBlur = (field, value) => {
    const error = validatePhoneValue(value)
    if (error) {
      setFormErrors(prev => ({ ...prev, [field]: error }))
      return
    }
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSaving(true)
      const response = await adminAPI.createOrUpdateEmergencyHelp({
        medicalEmergency: normalizeForDial(formData.medicalEmergency),
        accidentHelpline: normalizeForDial(formData.accidentHelpline),
        contactPolice: normalizeForDial(formData.contactPolice),
        insurance: normalizeForDial(formData.insurance),
      })

      if (response?.data?.success) {
        toast.success("Emergency help numbers saved successfully!")
        // Refresh data
        await fetchEmergencyHelp()
      } else {
        toast.error(response?.data?.message || "Failed to save emergency help numbers")
      }
    } catch (error) {
      console.error("Error saving emergency help:", error)
      toast.error(error?.response?.data?.message || "Failed to save emergency help numbers")
    } finally {
      setSaving(false)
    }
  }

  const emergencyFields = [
    {
      id: "medicalEmergency",
      label: "Medical Emergency",
      placeholder: "Enter medical emergency phone number",
      icon: "🚑",
      description: "Phone number for medical emergencies (e.g., 108, +91-XXX-XXX-XXXX)"
    },
    {
      id: "accidentHelpline",
      label: "Accident Helpline",
      placeholder: "Enter accident helpline phone number",
      icon: "⚠️",
      description: "Phone number for accident helpline"
    },
    {
      id: "contactPolice",
      label: "Contact Police",
      placeholder: "Enter police emergency phone number",
      icon: "🚔",
      description: "Phone number for police emergency (e.g., 100)"
    },
    {
      id: "insurance",
      label: "Insurance",
      placeholder: "Enter insurance helpline phone number",
      icon: "🛡️",
      description: "Phone number for insurance claims and policy help"
    }
  ]

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#e53935]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-[#F5F5F5] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Phone className="w-6 h-6 text-[#e53935]" />
            <div>
              <h1 className="text-2xl font-bold text-[#1E1E1E]">Delivery Emergency Help</h1>
              <p className="text-sm text-[#1E1E1E]/70 mt-1">
                Manage emergency contact numbers for delivery partners
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="mb-6 p-4 bg-[#FFFBEA] border border-[#FFC400] rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#FFC400] mt-0.5 shrink-0" />
              <div className="text-sm text-[#1E1E1E]/80">
                <p className="font-semibold mb-1 text-[#1E1E1E]">Important Information</p>
                <p>
                  These phone numbers will be displayed to delivery partners in the emergency help section.
                  When a delivery partner clicks on any emergency option, it will automatically dial the corresponding number.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {emergencyFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-semibold text-[#1E1E1E]">
                  <span className="mr-2">{field.icon}</span>
                  {field.label}
                </label>
                <p className="text-xs text-[#1E1E1E]/70 mb-2">{field.description}</p>
                <div className="relative">
                  <input
                    type="text"
                    value={formData[field.id]}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    onBlur={(e) => handleInputBlur(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={24}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935]/20 focus:border-[#e53935] text-[#1E1E1E] placeholder:text-[#1E1E1E]/40 ${formErrors[field.id]
                      ? "border-red-300 focus:ring-red-500"
                      : "border-[#F5F5F5]"
                      }`}
                  />
                  {formErrors[field.id] && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors[field.id]}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Submit Button */}
            <div className="pt-4 border-t border-[#F5F5F5]">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-[#e53935] text-white rounded-lg font-semibold hover:bg-[#c62828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Emergency Numbers
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Success Message */}
          {!loading && !saving && (
            <div className="mt-6 p-4 bg-[#FFFBEA] border border-[#FFC400] rounded-lg">
              <div className="flex items-center gap-2 text-[#1E1E1E]">
                <CheckCircle2 className="w-5 h-5 text-[#FFC400]" />
                <p className="text-sm font-medium">
                  Changes will be reflected immediately for all delivery partners
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

