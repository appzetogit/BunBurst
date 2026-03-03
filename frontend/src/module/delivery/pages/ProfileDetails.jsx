import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Edit2, ChevronRight, FileText, CheckCircle, XCircle, Eye, X } from "lucide-react"
import BottomPopup from "../components/BottomPopup"
import { toast } from "sonner"
import { deliveryAPI } from "@/lib/api"

export default function ProfileDetails() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [vehicleInput, setVehicleInput] = useState("")
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false)
  const [showPersonalDetailsPopup, setShowPersonalDetailsPopup] = useState(false)
  const [personalDetails, setPersonalDetails] = useState({ phone: "", email: "" })
  const [personalErrors, setPersonalErrors] = useState({})
  const [isUpdatingPersonalDetails, setIsUpdatingPersonalDetails] = useState(false)
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  })
  const [bankDetailsErrors, setBankDetailsErrors] = useState({})
  const [isUpdatingBankDetails, setIsUpdatingBankDetails] = useState(false)

  // Note: All alternate phone related code has been removed
  const isEmailLocked = String(profile?.signupMethod || "").toLowerCase() === "email"

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        setProfile(null)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          setVehicleNumber(profileData?.vehicle?.number || "")
          setVehicleInput(profileData?.vehicle?.number || "")
          // Set bank details
          setBankDetails({
            accountHolderName: profileData?.documents?.bankDetails?.accountHolderName || "",
            accountNumber: profileData?.documents?.bankDetails?.accountNumber || "",
            ifscCode: profileData?.documents?.bankDetails?.ifscCode || "",
            bankName: profileData?.documents?.bankDetails?.bankName || ""
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)

        // More detailed error handling
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          toast.error("Cannot connect to server. Please check if backend is running.")
        } else if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.")
          // Optionally redirect to login
          setTimeout(() => {
            navigate("/delivery/sign-in", { replace: true })
          }, 2000)
        } else {
          toast.error(error?.response?.data?.message || "Failed to load profile data")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()

    const handleAuthChange = () => {
      fetchProfile()
    }

    window.addEventListener("deliveryAuthChanged", handleAuthChange)

    return () => {
      window.removeEventListener("deliveryAuthChanged", handleAuthChange)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-[#F5F5F5]">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-[#fff8f7] rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#1E1E1E]" />
        </button>
        <h1 className="text-lg font-medium text-[#1E1E1E]">Profile</h1>
      </div>

      {/* Profile Picture Area */}
      <div className="relative w-full bg-[#F5F5F5] overflow-hidden flex items-center justify-center min-h-[300px]">
        {loading ? (
          <div className="w-full h-80 bg-gray-200 animate-pulse flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gray-300" />
          </div>
        ) : (
          <img
            src={profile?.profileImage?.url || profile?.documents?.photo || "https://i.pravatar.cc/400?img=12"}
            alt="Profile"
            className="w-full h-auto max-h-96 object-contain"
          />
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Rider Details Section */}
        <div>
          <h2 className="text-base font-bold text-[#1E1E1E] mb-3">Rider details</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-[#F5F5F5] border border-[#F5F5F5]">
            <div className="p-2 px-3 flex items-center justify-between">
              <p className="text-base text-gray-900">
                {loading ? "Loading..." : `${profile?.name || "N/A"} (${profile?.deliveryId || "N/A"})`}
              </p>
            </div>
            <div className="divide-y divide-[#F5F5F5]">
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Zone</p>
                <p className="text-base text-gray-900">
                  {profile?.availability?.zones?.length > 0 ? "Assigned" : "Not assigned"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">City</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.city || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle type</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.vehicle?.type || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle number</p>
                {vehicleNumber ? (
                  <div className="flex items-center gap-2">
                    <p className="text-base text-gray-900">{vehicleNumber}</p>
                    <button
                      onClick={() => {
                        setVehicleInput(vehicleNumber)
                        setShowVehiclePopup(true)
                      }}
                      className="p-1 hover:bg-[#fff8f7] rounded-full transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#e53935]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setVehicleInput("")
                      setShowVehiclePopup(true)
                    }}
                    className="flex items-center gap-2 text-[#e53935] font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Monthly Salary Display - Read Only */}
              {profile?.salary?.type === 'fixed' && (
                <div className="p-2 px-3 flex items-center justify-between bg-[#FFF9E0]">
                  <div className="flex flex-col">
                    <p className="text-sm text-gray-900 font-medium">Monthly Salary</p>
                    <p className="text-xs text-[#FFC400]">Fixed Amount</p>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    ₹{profile?.salary?.amount?.toLocaleString() || "0"}
                  </p>
                </div>
              )}

              {/* Joining Date */}
              {profile?.joiningDate && (
                <div className="p-2 px-3 flex items-center justify-between">
                  <p className="text-sm text-gray-900">Joining Date</p>
                  <p className="text-base text-gray-900">
                    {new Date(profile.joiningDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <h2 className="text-base font-medium text-[#1E1E1E] mb-3">Documents</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-[#F5F5F5] border border-[#F5F5F5]">
            {/* Aadhar Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Aadhar Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(profile?.documents?.aadhar?.verified || profile?.status === 'approved' || profile?.status === 'active') ? "Verified" : profile?.documents?.aadhar?.document ? "Not verified" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.aadhar?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Aadhar Card",
                      url: profile.documents.aadhar.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-[#fff8f7] rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-[#1E1E1E]/70" />
                </button>
              )}
            </div>

            {/* PAN Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">PAN Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(profile?.documents?.pan?.verified || profile?.status === 'approved' || profile?.status === 'active') ? "Verified" : profile?.documents?.pan?.document ? "Not verified" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.pan?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "PAN Card",
                      url: profile.documents.pan.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-[#fff8f7] rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-[#1E1E1E]/70" />
                </button>
              )}
            </div>

            {/* Driving License */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Driving License</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(profile?.documents?.drivingLicense?.verified || profile?.status === 'approved' || profile?.status === 'active') ? "Verified" : profile?.documents?.drivingLicense?.document ? "Not verified" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.drivingLicense?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Driving License",
                      url: profile.documents.drivingLicense.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-[#fff8f7] rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-[#1E1E1E]/70" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Details Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-[#1E1E1E]">Personal details</h2>
            <button
              onClick={() => {
                setPersonalDetails({
                  phone: profile?.phone || "",
                  email: profile?.email || ""
                })
                setPersonalErrors({})
                setShowPersonalDetailsPopup(true)
              }}
              className="text-[#e53935] font-medium text-sm flex items-center gap-1 hover:text-[#c62828]"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-[#F5F5F5] border border-[#F5F5F5]">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Phone</p>
                <p className="text-base text-gray-900">
                  {profile?.phone || "N/A"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Email</p>
                <p className="text-base text-gray-900">{profile?.email || "-"}</p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Aadhar Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.aadhar?.number || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Rating</p>
                <p className="text-base text-gray-900">
                  {profile?.metrics?.rating ? `${profile.metrics.rating.toFixed(1)} (${profile.metrics.ratingCount || 0})` : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Wallet Balance</p>
                <p className="text-base text-gray-900">
                  ₹{profile?.wallet?.balance?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Status</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#1E1E1E]">Bank details</h2>
            <button
              onClick={() => {
                setShowBankDetailsPopup(true)
                // Pre-fill form with existing data
                setBankDetails({
                  accountHolderName: profile?.documents?.bankDetails?.accountHolderName || "",
                  accountNumber: profile?.documents?.bankDetails?.accountNumber || "",
                  ifscCode: profile?.documents?.bankDetails?.ifscCode || "",
                  bankName: profile?.documents?.bankDetails?.bankName || ""
                })
                setBankDetailsErrors({})
              }}
              className="text-[#e53935] font-medium text-sm flex items-center gap-1 hover:text-[#c62828]"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-[#F5F5F5] border border-[#F5F5F5]">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Holder Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountHolderName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountNumber
                    ? `****${profile.documents.bankDetails.accountNumber.slice(-4)}`
                    : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">IFSC Code</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.ifscCode || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Bank Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.bankName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Pan Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.pan?.number || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Number Popup */}
      <BottomPopup
        isOpen={showVehiclePopup}
        onClose={() => setShowVehiclePopup(false)}
        title={vehicleNumber ? "Edit Vehicle Number" : "Add Vehicle Number"}
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="50vh"
      >
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={vehicleInput}
              onChange={(e) => setVehicleInput(e.target.value)}
              placeholder="Enter vehicle number"
              className="w-full px-4 py-3 border border-[#F5F5F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] focus:border-transparent"
              autoFocus
            />
          </div>
          <button
            onClick={async () => {
              if (vehicleInput.trim()) {
                try {
                  await deliveryAPI.updateProfile({
                    vehicle: {
                      ...profile?.vehicle,
                      number: vehicleInput.trim()
                    }
                  })
                  setVehicleNumber(vehicleInput.trim())
                  setShowVehiclePopup(false)
                  toast.success("Vehicle number updated successfully")
                  // Refetch profile
                  const response = await deliveryAPI.getProfile()
                  if (response?.data?.success && response?.data?.data?.profile) {
                    setProfile(response.data.data.profile)
                  }
                } catch (error) {
                  console.error("Error updating vehicle number:", error)
                  toast.error("Failed to update vehicle number")
                }
              } else {
                toast.error("Please enter a valid vehicle number")
              }
            }}
            className="w-full bg-[#e53935] text-white py-3 rounded-lg font-medium hover:bg-[#c62828] transition-colors"
          >
            {vehicleNumber ? "Update" : "Add"}
          </button>
        </div>
      </BottomPopup>

      {/* Document Image Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDocumentModal(false)
                setSelectedDocument(null)
              }}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg border border-[#F5F5F5] hover:bg-[#fff8f7] transition-colors"
            >
              <X className="w-5 h-5 text-[#1E1E1E]/70" />
            </button>

            {/* Document Title */}
            <div className="p-4 border-b border-[#F5F5F5]">
              <h3 className="text-lg font-semibold text-[#1E1E1E]">{selectedDocument.name}</h3>
            </div>

            {/* Document Image */}
            <div className="p-4">
              <img
                src={selectedDocument.url}
                alt={selectedDocument.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Personal Details Edit Popup */}
      <BottomPopup
        isOpen={showPersonalDetailsPopup}
        onClose={() => {
          setShowPersonalDetailsPopup(false)
          setPersonalErrors({})
        }}
        title="Edit Personal Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="70vh"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              Mobile Number <span className="text-[#e53935]">*</span>
            </label>
            <input
              type="tel"
              value={personalDetails.phone}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, phone: e.target.value }))
                setPersonalErrors(prev => ({ ...prev, phone: "" }))
              }}
              placeholder="Enter mobile number"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${personalErrors.phone ? "border-[#e53935]" : "border-[#F5F5F5]"
                }`}
            />
            {personalErrors.phone && (
              <p className="text-[#e53935] text-xs mt-1">{personalErrors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={personalDetails.email}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, email: e.target.value }))
                setPersonalErrors(prev => ({ ...prev, email: "" }))
              }}
              placeholder="Enter email address"
              disabled={isEmailLocked}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${personalErrors.email ? "border-[#e53935]" : "border-[#F5F5F5]"} ${isEmailLocked ? "bg-[#F5F5F5] text-[#1E1E1E]/60 cursor-not-allowed" : ""}`}
            />
            {isEmailLocked && (
              <p className="text-xs mt-1 text-[#1E1E1E]/65">Email cannot be changed for email login users.</p>
            )}
            {personalErrors.email && (
              <p className="text-[#e53935] text-xs mt-1">{personalErrors.email}</p>
            )}
          </div>

          <button
            onClick={async () => {
              const errors = {}
              const trimmedPhone = String(personalDetails.phone || "").trim()
              const phoneDigits = trimmedPhone.replace(/\D/g, "")
              const trimmedEmail = String(personalDetails.email || "").trim()

              if (!trimmedPhone) {
                errors.phone = "Mobile number is required"
              } else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
                errors.phone = "Mobile number must be 7 to 15 digits"
              }

              if (!isEmailLocked && trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                errors.email = "Invalid email format"
              }

              if (Object.keys(errors).length > 0) {
                setPersonalErrors(errors)
                toast.error("Please fill personal details correctly")
                return
              }

              setIsUpdatingPersonalDetails(true)
              try {
                const updatePayload = {
                  phone: trimmedPhone.replace(/\s+/g, " ")
                }
                if (!isEmailLocked) {
                  updatePayload.email = trimmedEmail
                }

                await deliveryAPI.updateProfile(updatePayload)
                toast.success("Personal details updated successfully")
                setShowPersonalDetailsPopup(false)

                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating personal details:", error)
                toast.error(error?.response?.data?.message || "Failed to update personal details")
              } finally {
                setIsUpdatingPersonalDetails(false)
              }
            }}
            disabled={isUpdatingPersonalDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingPersonalDetails
              ? "bg-[#1E1E1E]/35 cursor-not-allowed"
              : "bg-[#e53935] hover:bg-[#c62828]"
              }`}
          >
            {isUpdatingPersonalDetails ? "Updating..." : "Save Personal Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Bank Details Edit Popup */}
      <BottomPopup
        isOpen={showBankDetailsPopup}
        onClose={() => {
          setShowBankDetailsPopup(false)
          setBankDetailsErrors({})
        }}
        title="Edit Bank Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="80vh"
      >
        <div className="space-y-4">
          {/* Account Holder Name */}
          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              Account Holder Name <span className="text-[#e53935]">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountHolderName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, accountHolderName: "" }))
              }}
              placeholder="Enter account holder name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${bankDetailsErrors.accountHolderName ? "border-[#e53935]" : "border-[#F5F5F5]"
                }`}
            />
            {bankDetailsErrors.accountHolderName && (
              <p className="text-[#e53935] text-xs mt-1">{bankDetailsErrors.accountHolderName}</p>
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              Account Number <span className="text-[#e53935]">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only numbers
                setBankDetails(prev => ({ ...prev, accountNumber: value }))
                setBankDetailsErrors(prev => ({ ...prev, accountNumber: "" }))
              }}
              placeholder="Enter account number"
              maxLength={18}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${bankDetailsErrors.accountNumber ? "border-[#e53935]" : "border-[#F5F5F5]"
                }`}
            />
            {bankDetailsErrors.accountNumber && (
              <p className="text-[#e53935] text-xs mt-1">{bankDetailsErrors.accountNumber}</p>
            )}
          </div>

          {/* IFSC Code */}
          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              IFSC Code <span className="text-[#e53935]">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.ifscCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') // Only uppercase letters and numbers
                setBankDetails(prev => ({ ...prev, ifscCode: value }))
                setBankDetailsErrors(prev => ({ ...prev, ifscCode: "" }))
              }}
              placeholder="Enter IFSC code"
              maxLength={11}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${bankDetailsErrors.ifscCode ? "border-[#e53935]" : "border-[#F5F5F5]"
                }`}
            />
            {bankDetailsErrors.ifscCode && (
              <p className="text-[#e53935] text-xs mt-1">{bankDetailsErrors.ifscCode}</p>
            )}
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-[#1E1E1E] mb-1">
              Bank Name <span className="text-[#e53935]">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.bankName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, bankName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, bankName: "" }))
              }}
              placeholder="Enter bank name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e53935] ${bankDetailsErrors.bankName ? "border-[#e53935]" : "border-[#F5F5F5]"
                }`}
            />
            {bankDetailsErrors.bankName && (
              <p className="text-[#e53935] text-xs mt-1">{bankDetailsErrors.bankName}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={async () => {
              // Validate
              const errors = {}
              if (!bankDetails.accountHolderName.trim()) {
                errors.accountHolderName = "Account holder name is required"
              }
              if (!bankDetails.accountNumber.trim()) {
                errors.accountNumber = "Account number is required"
              } else if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
                errors.accountNumber = "Account number must be between 9 and 18 digits"
              }
              if (!bankDetails.ifscCode.trim()) {
                errors.ifscCode = "IFSC code is required"
              } else if (bankDetails.ifscCode.length !== 11) {
                errors.ifscCode = "IFSC code must be 11 characters"
              }
              if (!bankDetails.bankName.trim()) {
                errors.bankName = "Bank name is required"
              }

              if (Object.keys(errors).length > 0) {
                setBankDetailsErrors(errors)
                toast.error("Please fill all required fields correctly")
                return
              }

              setIsUpdatingBankDetails(true)
              try {
                await deliveryAPI.updateProfile({
                  documents: {
                    ...profile?.documents,
                    bankDetails: {
                      accountHolderName: bankDetails.accountHolderName.trim(),
                      accountNumber: bankDetails.accountNumber.trim(),
                      ifscCode: bankDetails.ifscCode.trim(),
                      bankName: bankDetails.bankName.trim()
                    }
                  }
                })
                toast.success("Bank details updated successfully")
                setShowBankDetailsPopup(false)
                // Refetch profile
                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating bank details:", error)
                toast.error(error?.response?.data?.message || "Failed to update bank details")
              } finally {
                setIsUpdatingBankDetails(false)
              }
            }}
            disabled={isUpdatingBankDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingBankDetails
              ? "bg-[#1E1E1E]/35 cursor-not-allowed"
              : "bg-[#e53935] hover:bg-[#c62828]"
              }`}
          >
            {isUpdatingBankDetails ? "Updating..." : "Save Bank Details"}
          </button>
        </div>
      </BottomPopup>

    </div>
  )
}

