import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deliveryAPI } from "@/lib/api"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

// Common country codes
const countryCodes = [
  { code: "+1", country: "US/CA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+39", country: "IT", flag: "🇮🇹" },
  { code: "+34", country: "ES", flag: "🇪🇸" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+7", country: "RU", flag: "🇷🇺" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+52", country: "MX", flag: "🇲🇽" },
  { code: "+82", country: "KR", flag: "🇰🇷" },
  { code: "+65", country: "SG", flag: "🇸🇬" },
  { code: "+971", country: "AE", flag: "🇦🇪" },
  { code: "+966", country: "SA", flag: "🇸🇦" },
  { code: "+27", country: "ZA", flag: "🇿🇦" },
  { code: "+31", country: "NL", flag: "🇳🇱" },
  { code: "+46", country: "SE", flag: "🇸🇪" },
]

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [showTermsCard, setShowTermsCard] = useState(false)
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length === 0) {
      return "Phone number is required"
    }

    if (digitsOnly.length > 10) {
      return `Phone number too long (${digitsOnly.length} digits). Please enter exactly 10 digits`
    }

    if (digitsOnly.length < 10) {
      return "Phone number must be exactly 10 digits"
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/delivery/otp")
    } catch (err) {
      console.error("Send OTP Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP. Please try again."
      setError(message)
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, "")
    setFormData({
      ...formData,
      phone: value,
    })
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        {/* Company Logo */}
        <div>
          <h1 className="text-3xl font-extrabold italic lowercase tracking-tight" style={{ color: '#1E1E1E' }}>
            {companyName.toLowerCase()}
          </h1>
        </div>

        {/* DELIVERY Badge */}
        <div className="px-6 py-2 rounded mt-2" style={{ backgroundColor: '#e53935' }}>
          <span className="text-white font-semibold text-sm uppercase tracking-wide">
            DELIVERY
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px" style={{ backgroundColor: '#F5F5F5' }} />

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6 pt-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Sign In Heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold" style={{ color: '#1E1E1E' }}>
              Sign in to your account
            </h2>
            <p className="text-base" style={{ color: '#1E1E1E', opacity: 0.6 }}>
              Login or create an account
            </p>
          </div>

          {/* Mobile Number Input */}
          <div className="space-y-2 w-full">
            <div className="flex gap-2 items-stretch w-full">
              <Select
                value={formData.countryCode}
                onValueChange={handleCountryCodeChange}
              >
                <SelectTrigger
                  className="w-[100px] !h-12 rounded-lg flex items-center shrink-0"
                  style={{ borderColor: '#F5F5F5', color: '#1E1E1E' }}
                  size="default"
                >
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span>{selectedCountry.flag}</span>
                      <span style={{ color: '#e53935' }}>{selectedCountry.code}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {countryCodes.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.code}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit mobile number"
                value={formData.phone}
                onChange={handlePhoneChange}
                maxLength={10}
                autoComplete="off"
                autoFocus={false}
                className="flex-1 h-12 px-4 placeholder-gray-400 focus:outline-none text-base rounded-lg min-w-0"
                style={{
                  color: '#1E1E1E',
                  border: `1.5px solid ${error ? '#e53935' : '#F5F5F5'}`,
                }}
              />
            </div>

            {/* Hint Text */}
            <p className="text-sm" style={{ color: '#1E1E1E', opacity: 0.5 }}>
              Enter a valid 10-digit mobile number
            </p>

            {error && (
              <p className="text-sm font-medium" style={{ color: '#e53935' }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px" style={{ backgroundColor: '#F5F5F5' }} />

      {/* Bottom Section - Continue Button and Terms */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Continue Button */}
          <button
            onClick={handleSendOTP}
            disabled={!isValid || isSending}
            className="w-full py-4 rounded-lg font-bold text-base transition-all duration-200"
            style={{
              backgroundColor: isValid && !isSending ? '#e53935' : '#F5F5F5',
              color: isValid && !isSending ? '#ffffff' : '#9E9E9E',
              cursor: isValid && !isSending ? 'pointer' : 'not-allowed',
            }}
          >
            {isSending ? "Sending OTP..." : "Continue"}
          </button>

          {/* Terms and Conditions */}
          <p className="text-xs text-center px-4" style={{ color: '#1E1E1E', opacity: 0.6 }}>
            By continuing, you agree to our{" "}
            <button
              type="button"
              onClick={() => setShowTermsCard(true)}
              className="hover:underline font-semibold"
              style={{ color: '#FFC400' }}
            >
              Terms and Conditions
            </button>
          </p>
        </div>
      </div>

      {showTermsCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
          onClick={() => setShowTermsCard(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Terms and Conditions"
            className="w-full max-w-2xl rounded-3xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.22)] overflow-hidden border border-[#EFEFEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-[#ECECEC] bg-gradient-to-b from-[#FAFAFA] to-[#FFFFFF] px-5 sm:px-6 py-4 sm:py-5">
              <h3 className="text-3xl sm:text-4xl font-extrabold text-center text-[#111827] leading-tight pr-16 sm:pr-20">
                Terms and Conditions
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsCard(false)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-[#FF6B6B] text-3xl leading-none text-[#5B6475] hover:bg-[#FFF5F5] transition-colors"
                aria-label="Close terms card"
              >
                ×
              </button>
            </div>

            <div className="px-5 sm:px-7 py-5 sm:py-6 text-[#374151] max-h-[70vh] overflow-y-auto">
              <p className="text-base sm:text-lg font-medium mb-3 text-[#4B5563]">This is a test Terms & Conditions</p>
              <p className="text-2xl sm:text-3xl font-bold mb-3 text-[#1F2937]">Terms of Use</p>
              <p className="text-lg sm:text-xl leading-relaxed text-[#374151]">
                This Terms of Use (&quot;Terms&quot;) applies to your access to and use of the website and the mobile application (collectively, the &quot;Platform&quot;). Please read these Terms carefully.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

