import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Mail, Phone, AlertCircle, Loader2 } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import api, { API_ENDPOINTS, authAPI } from "@/lib/api"
import { firebaseAuth, googleProvider, ensureFirebaseInitialized } from "@/lib/firebase"
import { setAuthData } from "@/lib/utils/auth"
import loginBanner from "@/assets/loginbanner.png"
import loginBannerDesktop from "@/assets/loginbanner-desktop.png"
import bunburstLogo from "@/assets/appzetologo.png"

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

const USER_SIGNIN_REMEMBER_KEY = "user_signin_remember_me"

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSignUp = searchParams.get("mode") === "signup"

  const [authMethod, setAuthMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
    name: "",
    rememberMe: false,
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
    name: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false)
  const [legalContentLoading, setLegalContentLoading] = useState({ terms: false, privacy: false })
  const [termsData, setTermsData] = useState({
    title: "Terms and Conditions",
    content: "<p>Loading...</p>",
  })
  const [privacyData, setPrivacyData] = useState({
    title: "Privacy Policy",
    content: "<p>Loading...</p>",
  })
  const redirectHandledRef = useRef(false)
  const hasLoadedTermsRef = useRef(false)
  const hasLoadedPrivacyRef = useRef(false)

  useEffect(() => {
    // Priority 1: Restore "remember me" data from localStorage
    try {
      const saved = localStorage.getItem(USER_SIGNIN_REMEMBER_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const savedAuthMethod = parsed?.authMethod === "email" ? "email" : "phone"

        setAuthMethod(savedAuthMethod)
        setFormData((prev) => ({
          ...prev,
          phone: typeof parsed?.phone === "string" ? parsed.phone : "",
          countryCode: typeof parsed?.countryCode === "string" ? parsed.countryCode : "+91",
          email: typeof parsed?.email === "string" ? parsed.email : "",
          name: typeof parsed?.name === "string" ? parsed.name : "",
          rememberMe: true,
        }))
        // If remember-me data found, skip sessionStorage pre-fill
        return
      }
    } catch (error) {
      console.warn("Failed to restore remembered sign-in data:", error)
    }

    // Priority 2: Pre-fill from sessionStorage when user navigates back from OTP page
    try {
      const storedAuthData = sessionStorage.getItem("userAuthData")
      if (storedAuthData) {
        const parsed = JSON.parse(storedAuthData)
        const method = parsed?.method === "email" ? "email" : "phone"
        setAuthMethod(method)

        if (method === "phone" && parsed?.phone) {
          // Full phone stored as "+91 9876543210" — split into country code + local number
          const fullPhone = String(parsed.phone).trim()
          const spaceIdx = fullPhone.indexOf(" ")
          if (spaceIdx !== -1) {
            const cc = fullPhone.slice(0, spaceIdx)           // e.g. "+91"
            const local = fullPhone.slice(spaceIdx + 1).replace(/\D/g, "") // e.g. "9876543210"
            setFormData((prev) => ({
              ...prev,
              countryCode: cc || "+91",
              phone: local,
            }))
          } else {
            // No space — strip any country code prefix and use rest as local
            const local = fullPhone.replace(/^\+\d{1,3}/, "").replace(/\D/g, "")
            setFormData((prev) => ({ ...prev, phone: local }))
          }
        } else if (method === "email" && parsed?.email) {
          setFormData((prev) => ({ ...prev, email: String(parsed.email) }))
        }

        // Pre-fill name if stored (sign-up flow)
        if (parsed?.name) {
          setFormData((prev) => ({ ...prev, name: String(parsed.name) }))
        }
      }
    } catch (error) {
      console.warn("Failed to restore auth data from sessionStorage:", error)
    }
  }, [])


  // Helper function to process signed-in user
  const processSignedInUser = async (user, source = "unknown") => {
    if (redirectHandledRef.current) {
      console.log(`ℹ️ User already being processed, skipping (source: ${source})`)
      return
    }

    console.log(`✅ Processing signed-in user from ${source}:`, {
      email: user.email,
      uid: user.uid,
      displayName: user.displayName
    })

    redirectHandledRef.current = true
    setIsLoading(true)
    setApiError("")

    try {
      const idToken = await user.getIdToken()
      console.log(`✅ Got ID token from ${source}, calling backend...`)

      const response = await authAPI.firebaseGoogleLogin(idToken, "user")
      const data = response?.data?.data || {}

      console.log(`✅ Backend response from ${source}:`, {
        hasAccessToken: !!data.accessToken,
        hasUser: !!data.user,
        userEmail: data.user?.email
      })

      const accessToken = data.accessToken
      const appUser = data.user

      if (accessToken && appUser) {
        setAuthData("user", accessToken, appUser)
        window.dispatchEvent(new Event("userAuthChanged"))

        // Clear any URL hash or params
        const hasHash = window.location.hash.length > 0
        const hasQueryParams = window.location.search.length > 0
        if (hasHash || hasQueryParams) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }

        console.log(`✅ Navigating to user dashboard from ${source}...`)
        navigate("/user", { replace: true })
      } else {
        console.error(`❌ Invalid backend response from ${source}`)
        redirectHandledRef.current = false
        setIsLoading(false)
        setApiError("Invalid response from server. Please try again.")
      }
    } catch (error) {
      console.error(`❌ Error processing user from ${source}:`, error)
      console.error("Error details:", {
        code: error?.code,
        message: error?.message,
        response: error?.response?.data
      })
      redirectHandledRef.current = false
      setIsLoading(false)

      let errorMessage = "Failed to complete sign-in. Please try again."
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.message) {
        errorMessage = error.message
      }
      setApiError(errorMessage)
    }
  }

  // Handle Firebase redirect result on component mount and URL changes
  useEffect(() => {
    // Prevent multiple calls
    if (redirectHandledRef.current) {
      return
    }

    const handleRedirectResult = async () => {
      try {
        // Check if we're coming back from a redirect (URL might have hash or params)
        const currentUrl = window.location.href
        const hasHash = window.location.hash.length > 0
        const hasQueryParams = window.location.search.length > 0

        console.log("🔍 Checking for redirect result...", {
          url: currentUrl,
          hasHash,
          hasQueryParams,
          pathname: window.location.pathname,
          hash: window.location.hash,
          search: window.location.search
        })

        const { getRedirectResult, onAuthStateChanged } = await import("firebase/auth")

        // Ensure Firebase is initialized
        ensureFirebaseInitialized()

        // Check current user immediately (before getRedirectResult)
        const immediateUser = firebaseAuth.currentUser
        console.log("🔍 Immediate current user check:", {
          hasUser: !!immediateUser,
          userEmail: immediateUser?.email
        })

        console.log("🔍 About to call getRedirectResult...", {
          firebaseAuthExists: !!firebaseAuth,
          firebaseAuthApp: firebaseAuth?.app?.name,
          currentUser: firebaseAuth?.currentUser?.email || "none"
        })

        // First, try to get redirect result (non-blocking with timeout)
        // Note: getRedirectResult returns null if there's no redirect result (normal on first load)
        // We use a short timeout to avoid hanging, and rely on auth state listener as primary method
        let result = null
        try {
          console.log("🔍 Calling getRedirectResult now...")

          // Use a short timeout (3 seconds) - if it hangs, auth state listener will handle it
          result = await Promise.race([
            getRedirectResult(firebaseAuth),
            new Promise((resolve) =>
              setTimeout(() => {
                console.log("ℹ️ getRedirectResult timeout (normal - no redirect result), relying on auth state listener")
                resolve(null)
              }, 3000)
            )
          ])

          if (result !== null) {
            console.log("✅ getRedirectResult completed, result found")
          } else {
            console.log("ℹ️ No redirect result (normal on first page load)")
          }
        } catch (redirectError) {
          console.log("ℹ️ getRedirectResult error (will rely on auth state listener):", redirectError?.code || redirectError?.message)

          // Don't throw - auth state listener will handle sign-in
          result = null
        }

        console.log("🔍 Redirect result details:", {
          hasResult: !!result,
          hasUser: !!result?.user,
          userEmail: result?.user?.email,
          providerId: result?.providerId,
          operationType: result?.operationType
        })

        if (result && result.user) {
          // Process redirect result
          await processSignedInUser(result.user, "redirect-result")
        } else {
          // No redirect result - check if user is already signed in
          const currentUser = firebaseAuth.currentUser
          console.log("🔍 Checking current user after redirect check:", {
            hasCurrentUser: !!currentUser,
            userEmail: currentUser?.email,
            redirectHandled: redirectHandledRef.current
          })

          if (currentUser && !redirectHandledRef.current) {
            // Process current user
            await processSignedInUser(currentUser, "current-user-check")
          } else {
            // No redirect result - this is normal on first load
            console.log("ℹ️ No redirect result found (normal on first page load)")
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error("❌ Google sign-in redirect error:", error)
        console.error("Error details:", {
          code: error?.code,
          message: error?.message,
          stack: error?.stack
        })

        redirectHandledRef.current = false

        // Show error to user
        const errorCode = error?.code || ""
        const errorMessage = error?.message || ""

        // Don't show error for "no redirect result" - this is normal when page first loads
        if (errorCode === "auth/no-auth-event" || errorCode === "auth/popup-closed-by-user") {
          // These are expected cases, don't show error
          console.log("ℹ️ Expected case - no auth event or popup closed")
          setIsLoading(false)
          return
        }

        // Handle backend errors (500, etc.)
        let message = "Google sign-in failed. Please try again."

        if (error?.response) {
          // Axios error with response
          const status = error.response.status
          const responseData = error.response.data || {}

          if (status === 500) {
            message = responseData.message || responseData.error || "Server error. Please try again later."
          } else if (status === 400 || status === 401) {
            message = responseData.message || responseData.error || "Authentication failed. Please try again."
          } else {
            message = responseData.message || responseData.error || errorMessage || message
          }
        } else if (errorMessage) {
          message = errorMessage
        } else if (errorCode) {
          // Firebase auth error codes
          if (errorCode === "auth/network-request-failed") {
            message = "Network error. Please check your connection and try again."
          } else if (errorCode === "auth/invalid-credential") {
            message = "Invalid credentials. Please try again."
          } else {
            message = errorMessage || message
          }
        }

        setApiError(message)
        setIsLoading(false)
      }
    }

    // Helper function to process signed-in user
    const processSignedInUser = async (user, source = "unknown") => {
      if (redirectHandledRef.current) {
        console.log(`ℹ️ User already being processed, skipping (source: ${source})`)
        return
      }

      console.log(`✅ Processing signed-in user from ${source}:`, {
        email: user.email,
        uid: user.uid,
        displayName: user.displayName
      })

      redirectHandledRef.current = true
      setIsLoading(true)
      setApiError("")

      try {
        const idToken = await user.getIdToken()
        console.log(`✅ Got ID token from ${source}, calling backend...`)

        const response = await authAPI.firebaseGoogleLogin(idToken, "user")
        const data = response?.data?.data || {}

        console.log(`✅ Backend response from ${source}:`, {
          hasAccessToken: !!data.accessToken,
          hasUser: !!data.user,
          userEmail: data.user?.email
        })

        const accessToken = data.accessToken
        const appUser = data.user

        if (accessToken && appUser) {
          setAuthData("user", accessToken, appUser)
          window.dispatchEvent(new Event("userAuthChanged"))

          // Clear any URL hash or params
          const hasHash = window.location.hash.length > 0
          const hasQueryParams = window.location.search.length > 0
          if (hasHash || hasQueryParams) {
            window.history.replaceState({}, document.title, window.location.pathname)
          }

          console.log(`✅ Navigating to user dashboard from ${source}...`)
          navigate("/user", { replace: true })
        } else {
          console.error(`❌ Invalid backend response from ${source}`)
          redirectHandledRef.current = false
          setIsLoading(false)
          setApiError("Invalid response from server. Please try again.")
        }
      } catch (error) {
        console.error(`❌ Error processing user from ${source}:`, error)
        console.error("Error details:", {
          code: error?.code,
          message: error?.message,
          response: error?.response?.data
        })
        redirectHandledRef.current = false
        setIsLoading(false)

        let errorMessage = "Failed to complete sign-in. Please try again."
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message
        } else if (error?.message) {
          errorMessage = error.message
        }
        setApiError(errorMessage)
      }
    }

    // Set up auth state listener FIRST (before getRedirectResult)
    // This ensures we catch auth state changes immediately
    let unsubscribe = null
    const setupAuthListener = async () => {
      try {
        const { onAuthStateChanged } = await import("firebase/auth")
        ensureFirebaseInitialized()

        console.log("🔔 Setting up auth state listener...")

        unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          console.log("🔔 Auth state changed:", {
            hasUser: !!user,
            userEmail: user?.email,
            redirectHandled: redirectHandledRef.current,
            currentPath: window.location.pathname
          })

          // If user signed in and we haven't handled it yet
          if (user && !redirectHandledRef.current) {
            await processSignedInUser(user, "auth-state-listener")
          } else if (!user) {
            // User signed out
            console.log("ℹ️ User signed out")
            redirectHandledRef.current = false
          } else if (user && redirectHandledRef.current) {
            console.log("ℹ️ User already signed in and handled, skipping...")
          }
        })

        console.log("✅ Auth state listener set up successfully")
      } catch (error) {
        console.error("❌ Error setting up auth state listener:", error)
      }
    }

    // Set up auth listener first, then check redirect result
    setupAuthListener()

    // Also check current user immediately (in case redirect already completed)
    const checkCurrentUser = async () => {
      try {
        ensureFirebaseInitialized()
        const currentUser = firebaseAuth.currentUser
        if (currentUser && !redirectHandledRef.current) {
          console.log("✅ Current user found immediately, processing...")
          await processSignedInUser(currentUser, "immediate-check")
        }
      } catch (error) {
        console.error("❌ Error checking current user:", error)
      }
    }

    // Check current user immediately
    checkCurrentUser()

    // Small delay to ensure Firebase is ready, then check redirect result
    const timer = setTimeout(() => {
      handleRedirectResult()
    }, 500)

    return () => {
      clearTimeout(timer)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [navigate, searchParams])

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validateEmail = (email) => {
    if (!email.trim()) {
      return "Email is required"
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address"
    }
    return ""
  }

  const validatePhone = (phone) => {
    if (!phone.trim()) {
      return "Phone number is required"
    }
    // Check for alphabets or special characters
    if (/[a-zA-Z!@#$%^&*()_+={}[\]|\\:;"'<>?,./`~]/.test(phone)) {
      return "Invalid phone number. Only numeric digits (0–9) are allowed"
    }
    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length > 10) {
      return `Phone number too long (${digitsOnly.length} digits). Please enter exactly 10 digits`
    }
    if (digitsOnly.length < 10) {
      return "Phone number must be exactly 10 digits"
    }
    return ""
  }

  const validateName = (name) => {
    if (!name.trim()) {
      return "Name is required"
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters"
    }
    if (name.trim().length > 50) {
      return "Name must be less than 50 characters"
    }
    const nameRegex = /^[a-zA-Z\s'-]+$/
    if (!nameRegex.test(name.trim())) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes"
    }
    return ""
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    // For phone: only allow numeric digits and enforce max 10 digits
    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10)
      setFormData({
        ...formData,
        phone: digitsOnly,
      })
      setErrors({ ...errors, phone: validatePhone(digitsOnly) })
      return
    }

    setFormData({
      ...formData,
      [name]: value,
    })

    // Real-time validation
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) })
    } else if (name === "name") {
      setErrors({ ...errors, name: validateName(value) })
    }
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setApiError("")

    // Validate based on auth method
    let hasErrors = false
    const newErrors = { phone: "", email: "", name: "" }

    if (authMethod === "phone") {
      const phoneError = validatePhone(formData.phone)
      newErrors.phone = phoneError
      if (phoneError) hasErrors = true
    } else {
      const emailError = validateEmail(formData.email)
      newErrors.email = emailError
      if (emailError) hasErrors = true
    }

    // Validate name for sign up
    if (isSignUp) {
      const nameError = validateName(formData.name)
      newErrors.name = nameError
      if (nameError) hasErrors = true
    }

    setErrors(newErrors)

    if (hasErrors) {
      setIsLoading(false)
      return
    }

    try {
      const purpose = isSignUp ? "register" : "login"
      const fullPhone = authMethod === "phone" ? `${formData.countryCode} ${formData.phone}`.trim() : null
      const email = authMethod === "email" ? formData.email.trim() : null

      if (formData.rememberMe) {
        localStorage.setItem(
          USER_SIGNIN_REMEMBER_KEY,
          JSON.stringify({
            authMethod,
            phone: authMethod === "phone" ? formData.phone.trim() : "",
            countryCode: formData.countryCode,
            email: authMethod === "email" ? formData.email.trim() : "",
            name: isSignUp ? formData.name.trim() : "",
          })
        )
      } else {
        localStorage.removeItem(USER_SIGNIN_REMEMBER_KEY)
      }

      // Call backend to send OTP
      await authAPI.sendOTP(fullPhone, purpose, email)

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: authMethod,
        phone: fullPhone,
        email: email,
        name: isSignUp ? formData.name.trim() : null,
        isSignUp,
        module: "user",
      }
      sessionStorage.setItem("userAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/user/auth/otp")
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setApiError("")
    setIsLoading(true)
    redirectHandledRef.current = false // Reset flag when starting new sign-in

    try {
      // Ensure Firebase is initialized before use
      ensureFirebaseInitialized()

      // Validate Firebase Auth instance
      if (!firebaseAuth) {
        throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.")
      }

      const { signInWithRedirect } = await import("firebase/auth")

      // Log current origin for debugging
      console.log("🚀 Starting Google sign-in redirect...", {
        origin: window.location.origin,
        hostname: window.location.hostname,
        pathname: window.location.pathname
      })

      // Use redirect directly to avoid COOP issues
      // The redirect result will be handled by the useEffect hook above
      await signInWithRedirect(firebaseAuth, googleProvider)

      // Note: signInWithRedirect will cause a full page redirect to Google
      // After user authenticates, they'll be redirected back to this page
      // The useEffect hook will handle the result when the page loads again
      console.log("✅ Redirect initiated, user will be redirected to Google...")
      // Don't set loading to false here - page will redirect
    } catch (error) {
      console.error("❌ Google sign-in redirect error:", error)
      console.error("Error code:", error?.code)
      console.error("Error message:", error?.message)
      setIsLoading(false)
      redirectHandledRef.current = false

      const errorCode = error?.code || ""
      const errorMessage = error?.message || ""

      let message = "Google sign-in failed. Please try again."

      if (errorCode === "auth/configuration-not-found") {
        message = "Firebase configuration error. Please ensure your domain is authorized in Firebase Console. Current domain: " + window.location.hostname
      } else if (errorCode === "auth/popup-blocked") {
        message = "Popup was blocked. Please allow popups and try again."
      } else if (errorCode === "auth/popup-closed-by-user") {
        message = "Sign-in was cancelled. Please try again."
      } else if (errorCode === "auth/network-request-failed") {
        message = "Network error. Please check your connection and try again."
      } else if (errorMessage) {
        message = errorMessage
      } else if (error?.response?.data?.message) {
        message = error.response.data.message
      } else if (error?.response?.data?.error) {
        message = error.response.data.error
      }

      setApiError(message)
    }
  }

  const toggleMode = () => {
    const newMode = isSignUp ? "signin" : "signup"
    navigate(`/user/auth/sign-in?mode=${newMode}`, { replace: true })
    // Reset form
    setFormData({ phone: "", countryCode: "+91", email: "", name: "", rememberMe: false })
    setErrors({ phone: "", email: "", name: "" })
  }

  const handleLoginMethodChange = () => {
    setAuthMethod(authMethod === "email" ? "phone" : "email")
  }

  const fetchTermsData = async () => {
    if (hasLoadedTermsRef.current) return

    try {
      setLegalContentLoading((prev) => ({ ...prev, terms: true }))
      const response = await api.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC)
      if (response?.data?.success && response?.data?.data) {
        setTermsData(response.data.data)
      } else {
        setTermsData({
          title: "Terms and Conditions",
          content: "<p>Unable to load terms and conditions at the moment. Please try again later.</p>",
        })
      }
      hasLoadedTermsRef.current = true
    } catch (error) {
      console.error("Error fetching terms data:", error)
      setTermsData({
        title: "Terms and Conditions",
        content: "<p>Unable to load terms and conditions at the moment. Please try again later.</p>",
      })
    } finally {
      setLegalContentLoading((prev) => ({ ...prev, terms: false }))
    }
  }

  const fetchPrivacyData = async () => {
    if (hasLoadedPrivacyRef.current) return

    try {
      setLegalContentLoading((prev) => ({ ...prev, privacy: true }))
      const response = await api.get(API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC)
      if (response?.data?.success && response?.data?.data) {
        setPrivacyData(response.data.data)
      } else {
        setPrivacyData({
          title: "Privacy Policy",
          content: "<p>Unable to load privacy policy at the moment. Please try again later.</p>",
        })
      }
      hasLoadedPrivacyRef.current = true
    } catch (error) {
      console.error("Error fetching privacy data:", error)
      setPrivacyData({
        title: "Privacy Policy",
        content: "<p>Unable to load privacy policy at the moment. Please try again later.</p>",
      })
    } finally {
      setLegalContentLoading((prev) => ({ ...prev, privacy: false }))
    }
  }

  const handleOpenTermsModal = () => {
    setIsTermsModalOpen(true)
    fetchTermsData()
  }

  const handleOpenPrivacyModal = () => {
    setIsPrivacyModalOpen(true)
    fetchPrivacyData()
  }

  return (
    <AnimatedPage className="min-h-screen flex flex-col items-center justify-center !p-0 !pb-0 overflow-hidden">

      {/* Mobile background — dark food photo + dark overlay (unchanged) */}
      <div
        className="fixed inset-0 w-full h-full md:hidden"
        style={{
          backgroundImage: `url(${loginBanner})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.40) 50%, rgba(0,0,0,0.60) 100%)",
          }}
        />
      </div>

      {/* Desktop background — light cream food-border image, no overlay */}
      <div
        className="fixed inset-0 w-full h-full hidden md:block"
        style={{
          backgroundImage: `url(${loginBannerDesktop})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />

      {/* Logo above the card */}
      <div className="relative z-10 flex justify-center mb-2 px-4">
        <img
          src={bunburstLogo}
          alt="Bun Burst – Quality First"
          className="w-64 sm:w-72 drop-shadow-2xl"
          style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }}
        />
      </div>

      {/* Heading text above card */}
      <div className="relative z-10 text-center px-4 mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white md:text-gray-900 leading-tight drop-shadow-lg md:drop-shadow-none">
          Login to Bun Burst Café
        </h1>
        <p className="text-sm sm:text-base text-amber-200 md:text-gray-500 mt-1 drop-shadow md:drop-shadow-none">
          Delicious pizzas, burgers &amp; shakes
        </p>
      </div>

      {/* Login Card */}
      <div
        className="relative z-10 w-full mx-auto"
        style={{ maxWidth: "420px" }}
      >
        <div
          className="mx-4 mb-6 rounded-2xl overflow-hidden"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          {/* Card inner content */}
          <div className="p-6 sm:p-7 space-y-4">

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Name field for sign up */}
              {isSignUp && (
                <div className="space-y-1">
                  <div
                    className="flex items-center rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.5)" }}
                  >
                    <Input
                      id="name"
                      name="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`flex-1 h-12 border-0 bg-transparent text-gray-900 placeholder:text-gray-400 text-base focus-visible:ring-0 focus-visible:ring-offset-0 ${errors.name ? "placeholder:text-red-400" : ""}`}
                      aria-invalid={errors.name ? "true" : "false"}
                    />
                  </div>
                  {errors.name && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Phone Number Input — dynamic country code selector */}
              {authMethod === "phone" && (
                <div className="space-y-1">
                  <div
                    className="flex items-center rounded-xl overflow-hidden h-12"
                    style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
                  >
                    {/* Dynamic country code dropdown */}
                    <Select
                      value={formData.countryCode}
                      onValueChange={handleCountryCodeChange}
                    >
                      <SelectTrigger
                        className="h-full border-0 border-r border-gray-200 rounded-none bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none px-2 shrink-0 gap-1"
                        style={{ width: "auto", minWidth: "80px" }}
                        aria-label="Select country code"
                      >
                        <SelectValue>
                          <span className="flex items-center gap-1">
                            <span className="text-base leading-none">{selectedCountry.flag}</span>
                            <span className="text-sm font-semibold text-gray-700">{selectedCountry.code}</span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto">
                        {countryCodes.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="flex items-center gap-2">
                              <span className="text-base">{country.flag}</span>
                              <span className="font-medium">{country.code}</span>
                              <span className="text-gray-500 text-xs">{country.country}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Phone number text input */}
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="Enter your mobile number"
                      value={formData.phone}
                      onChange={handleChange}
                      maxLength={10}
                      className="flex-1 h-full px-3 bg-transparent text-gray-900 placeholder:text-gray-400 text-base outline-none"
                      aria-invalid={errors.phone ? "true" : "false"}
                    />
                  </div>
                  {errors.phone && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.phone}</span>
                    </div>
                  )}
                  {apiError && authMethod === "phone" && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span>{apiError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Email Input */}
              {authMethod === "email" && (
                <div className="space-y-1">
                  <div
                    className="flex items-center rounded-xl overflow-hidden h-12"
                    style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.5)" }}
                  >
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={formData.email}
                      onChange={handleChange}
                      className="flex-1 h-full px-4 bg-transparent text-gray-900 placeholder:text-gray-400 text-base outline-none"
                      aria-invalid={errors.email ? "true" : "false"}
                    />
                  </div>
                  {errors.email && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.email}</span>
                    </div>
                  )}
                  {apiError && authMethod === "email" && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span>{apiError}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod("phone")
                      setApiError("")
                    }}
                    className="text-xs text-amber-300 hover:underline text-left"
                  >
                    Use phone instead
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 font-bold text-base rounded-xl transition-all duration-100 active:scale-95 active:brightness-90 hover:brightness-105 select-none"
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  boxShadow: "none",
                  border: "none",
                  letterSpacing: "0.02em",
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isSignUp ? "Creating Account..." : "Signing in..."}
                  </>
                ) : (
                  isSignUp ? "Create Account" : "Send OTP"
                )}
              </Button>
            </form>

            {/* Or Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-sm text-gray-400">
                  or
                </span>
              </div>
            </div>

            {/* Social Login Icons */}
            <div className="flex justify-center gap-5">
              {/* Google Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
                aria-label="Sign in with Google"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>

              {/* Facebook Login (visual — triggers email as fallback) */}
              <button
                type="button"
                onClick={handleLoginMethodChange}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: "#1877F2", boxShadow: "0 4px 14px rgba(24,119,242,0.45)" }}
                aria-label="Sign in with Facebook"
              >
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </button>
            </div>

            {/* Sign up with email — text link */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLoginMethodChange}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-2"
              >
                Sign up with email
                <Mail className="h-4 w-4" />
              </button>
            </div>

            {/* Legal Disclaimer */}
            <div className="text-center text-xs text-gray-400 pt-1">
              <p className="mb-1">By continuing, you agree to our</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenTermsModal}
                  className="underline hover:text-gray-700 transition-colors"
                >
                  Terms of Service
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={handleOpenPrivacyModal}
                  className="underline hover:text-gray-700 transition-colors"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>{/* end card inner p-6 */}
        </div>{/* end frosted card */}
      </div>{/* end card-wrapper */}

      <Dialog open={isTermsModalOpen} onOpenChange={setIsTermsModalOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-2xl p-0 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <DialogHeader className="px-5 sm:px-6 py-4 border-b border-gray-200 pr-14">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
              Terms and Conditions
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 sm:px-6 py-5 max-h-[70vh] overflow-y-auto">
            {legalContentLoading.terms ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Loading...
              </div>
            ) : (
              <div
                className="prose prose-slate max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: termsData.content }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-2xl p-0 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <DialogHeader className="px-5 sm:px-6 py-4 border-b border-gray-200 pr-14">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 sm:px-6 py-5 max-h-[70vh] overflow-y-auto">
            {legalContentLoading.privacy ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Loading...
              </div>
            ) : (
              <div
                className="prose prose-slate max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: privacyData.content }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}
