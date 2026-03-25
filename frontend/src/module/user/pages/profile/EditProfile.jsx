import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, X, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useProfile } from "../../context/ProfileContext"
import { useCustomerTheme } from "../../context/CustomerThemeContext"
import { userAPI } from "@/lib/api"
import { toast } from "sonner"

// Gender options
const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
]

// Load profile data from localStorage
const loadProfileFromStorage = () => {
  try {
    const stored = localStorage.getItem('appzeto_user_profile')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading profile from localStorage:', error)
  }
  return null
}

// Save profile data to localStorage
const saveProfileToStorage = (data) => {
  try {
    localStorage.setItem('appzeto_user_profile', JSON.stringify(data))
  } catch (error) {
    console.error('Error saving profile to localStorage:', error)
  }
}

export default function EditProfile() {
  const navigate = useNavigate()
  const { userProfile, updateUserProfile } = useProfile()
  const { theme } = useCustomerTheme()
  const isDarkMode = theme === "dark"

  // Load from localStorage or use context
  const storedProfile = loadProfileFromStorage()
  const initialProfile = storedProfile || userProfile || {}

  const initialFormData = {
    name: initialProfile.name ?? "",
    mobile: initialProfile.mobile ?? initialProfile.phone ?? "",
    email: initialProfile.email ?? "",
    gender: initialProfile.gender ?? "",
  }

  const [formData, setFormData] = useState(initialFormData)
  const [initialData] = useState(initialFormData)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "")
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "")
  const fileInputRef = useRef(null)

  // Update form data when profile changes
  useEffect(() => {
    const storedProfile = loadProfileFromStorage()
    const profile = storedProfile || userProfile || {}
    const newFormData = {
      name: profile.name ?? "",
      mobile: profile.mobile ?? profile.phone ?? "",
      email: profile.email ?? "",
      gender: profile.gender ?? "",
    }
    setFormData(newFormData)

    // Update profile image
    if (profile.profileImage) {
      setProfileImage(profile.profileImage)
      setImagePreview(profile.profileImage)
    }
  }, [userProfile])

  // Get avatar initial
  const avatarInitial = formData.name?.charAt(0).toUpperCase() || 'A'

  // Check if form has changes
  useEffect(() => {
    const currentData = JSON.stringify(formData)
    const savedData = JSON.stringify(initialData)
    setHasChanges(currentData !== savedData)
  }, [formData, initialData])

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClear = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: ""
    }))
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload to server
    try {
      setIsUploadingImage(true)
      const response = await userAPI.uploadProfileImage(file)
      const imageUrl = response?.data?.data?.profileImage || response?.data?.profileImage

      if (imageUrl) {
        setProfileImage(imageUrl)
        setImagePreview(imageUrl)
        toast.success('Profile image uploaded successfully')

        // Update context
        updateUserProfile({ profileImage: imageUrl })

        // Dispatch event to refresh profile
        window.dispatchEvent(new Event("userAuthChanged"))
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error(error?.response?.data?.message || 'Failed to upload image')
      // Revert preview
      setImagePreview(profileImage)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleUpdate = async () => {
    if (isSaving) return

    try {
      setIsSaving(true)

      // Prepare data for API
      const updateData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.mobile || undefined,
        gender: formData.gender || undefined,
        profileImage: profileImage || undefined, // Include profileImage in update
      }

      // Call API to update profile
      const response = await userAPI.updateProfile(updateData)
      const updatedUser = response?.data?.data?.user || response?.data?.user

      if (updatedUser) {
        // Update context with all fields including profileImage
        updateUserProfile({
          ...updatedUser,
          phone: updatedUser.phone || formData.mobile,
          profileImage: updatedUser.profileImage || profileImage,
        })

        // Save to localStorage with complete data
        saveProfileToStorage({
          name: updatedUser.name || formData.name,
          phone: updatedUser.phone || formData.mobile,
          email: updatedUser.email || formData.email,
          profileImage: updatedUser.profileImage || profileImage,
          gender: updatedUser.gender || formData.gender,
        })

        // Dispatch event to refresh profile from API
        window.dispatchEvent(new Event("userAuthChanged"))

        toast.success('Profile updated successfully')

        // Navigate back
        navigate("/user/profile")
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error?.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMobileChange = () => {
    // Navigate to mobile change page or show modal
  }

  const handleEmailChange = () => {
    // Navigate to email change page or show modal
  }

  const handleProfileImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }


  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-10 border-b border-[#F5F5F5] dark:border-gray-800">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3 px-4 sm:px-0 py-4 md:py-5 lg:py-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F5] dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-[#1E1E1E] dark:text-white" />
          </button>
          <h1 className="text-lg font-semibold text-[#1E1E1E] dark:text-white">Your Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-0 py-6 sm:py-8 md:py-10 lg:py-12 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="h-24 w-24 bg-[#FFC400] border-0">
              {imagePreview && (
                <AvatarImage
                  src={imagePreview}
                  alt={formData.name || 'User'}
                />
              )}
              <AvatarFallback className="bg-[#FFC400] text-[#1E1E1E] text-3xl font-semibold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            {/* Edit Icon */}
            <button
              onClick={handleProfileImageClick}
              disabled={isUploadingImage}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#e53935] rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-[#c62828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              onClick={(e) => {
                e.target.value = ""
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-[#F5F5F5] dark:border-gray-800">
          <CardContent className="p-4 sm:p-5 md:p-6 lg:p-8 space-y-4 md:space-y-5 lg:space-y-6">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-[#1E1E1E] dark:text-white">
                Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="pr-10 h-12 text-base border border-[#F5F5F5] dark:border-gray-700 focus:border-[#e53935] focus:ring-1 focus:ring-[#e53935] rounded-lg bg-white dark:bg-[#1a1a1a] text-[#1E1E1E] dark:text-white"
                  placeholder="Name"
                />
                {formData.name && (
                  <button
                    type="button"
                    onClick={() => handleClear('name')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1E1E1E]/40 dark:text-gray-500 hover:text-[#1E1E1E]/70 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Field */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="text-sm font-medium text-[#1E1E1E] dark:text-white">
                Mobile
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="flex-1 h-12 text-base border border-[#F5F5F5] dark:border-gray-700 focus:border-[#e53935] focus:ring-1 focus:ring-[#e53935] rounded-lg bg-white dark:bg-[#1a1a1a] text-[#1E1E1E] dark:text-white"
                  placeholder="Mobile"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-[#1E1E1E] dark:text-white">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="flex-1 h-12 text-base border border-[#F5F5F5] dark:border-gray-700 focus:border-[#e53935] focus:ring-1 focus:ring-[#e53935] rounded-lg bg-white dark:bg-[#1a1a1a] text-[#1E1E1E] dark:text-white"
                  placeholder="Email"
                />
              </div>
            </div>

            {/* Gender Field */}
            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-sm font-medium text-[#1E1E1E] dark:text-white">
                Gender
              </Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => handleChange('gender', value)}
              >
                <SelectTrigger className="h-12 text-base border border-[#F5F5F5] dark:border-gray-700 focus:border-[#e53935] focus:ring-1 focus:ring-[#e53935] rounded-lg bg-white dark:bg-[#1a1a1a] text-[#1E1E1E] dark:text-white">
                  <SelectValue placeholder="Gender" className="text-[#1E1E1E] dark:text-white" />
                </SelectTrigger>
                <SelectContent className="bg-white text-[#1E1E1E] dark:bg-[#1a1a1a] dark:text-white dark:border-gray-700">
                  {genderOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-[#1E1E1E] dark:text-white focus:bg-[#F5F5F5] dark:focus:bg-gray-800 focus:text-[#1E1E1E] dark:focus:text-white"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile Button */}
        <Button
          onClick={handleUpdate}
          disabled={!hasChanges || isSaving || isUploadingImage}
          className={`w-full h-14 rounded-xl font-semibold text-base transition-all ${hasChanges && !isSaving && !isUploadingImage
            ? 'bg-[#e53935] hover:bg-[#c62828] text-white'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Update profile'
          )}
        </Button>
      </div>
    </div>
  )
}
