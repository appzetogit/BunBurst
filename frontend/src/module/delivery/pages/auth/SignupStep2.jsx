import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image, ChevronRight, FileText, SwitchCamera, ZapOff } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import apiClient from "@/lib/api/axios"
import { toast } from "sonner"

// ─────────────────────────────────────────
//  In-Browser Camera Modal
// ─────────────────────────────────────────
function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState("environment") // back camera default
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState(null) // base64 preview after snap

  const startStream = useCallback(async (mode) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setReady(true)
        }
      }
    } catch (err) {
      console.error("Camera access denied:", err)
      toast.error("Camera access denied. Please allow camera permission.")
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    startStream(facingMode)
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, []) // eslint-disable-line

  const flipCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment"
    setFacingMode(next)
    startStream(next)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    // Mirror if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL("image/jpeg", 0.92)
    setCaptured(base64)

    // Stop live stream (save battery)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  const retake = () => {
    setCaptured(null)
    startStream(facingMode)
  }

  const usePhoto = () => {
    // Convert base64 → Blob → File
    const byteString = atob(captured.split(",")[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: "image/jpeg" })
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" })
    onCapture(file)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#000' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 z-10" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <button onClick={onClose} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-sm font-semibold">Take Photo</span>
        <button onClick={flipCamera} className="p-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <SwitchCamera className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Video / Preview area */}
      <div className="flex-1 relative overflow-hidden">
        {captured ? (
          <img src={captured} alt="Captured" className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* Corner guides */}
        {!captured && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-44 relative opacity-60">
              {/* Top-left */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
              {/* Top-right */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
          </div>
        )}

        {!ready && !captured && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#e53935' }} />
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom Controls */}
      <div className="px-8 py-8 flex items-center justify-center gap-10" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        {captured ? (
          <>
            {/* Retake */}
            <button
              onClick={retake}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">Retake</span>
            </button>

            {/* Use Photo */}
            <button
              onClick={usePhoto}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e53935' }}>
                <Check className="w-7 h-7 text-white" />
              </div>
              <span className="text-white text-xs font-semibold">Use Photo</span>
            </button>
          </>
        ) : (
          /* Capture button */
          <button
            onClick={capturePhoto}
            disabled={!ready}
            className="relative flex items-center justify-center"
            style={{ width: 72, height: 72 }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-white opacity-60" />
            <div
              className="w-14 h-14 rounded-full transition-all"
              style={{ backgroundColor: ready ? '#e53935' : '#555' }}
            />
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
//  Main SignupStep2
// ─────────────────────────────────────────
export default function SignupStep2() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const [documents, setDocuments] = useState({
    profilePhoto: null, aadharPhoto: null, panPhoto: null, drivingLicensePhoto: null
  })
  const [uploadedDocs, setUploadedDocs] = useState({
    profilePhoto: null, aadharPhoto: null, panPhoto: null, drivingLicensePhoto: null
  })
  const [uploading, setUploading] = useState({
    profilePhoto: false, aadharPhoto: false, panPhoto: false, drivingLicensePhoto: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSheet, setActiveSheet] = useState(null)   // which docType has sheet open
  const [cameraFor, setCameraFor] = useState(null)        // which docType has camera open
  const galleryRef = useRef({})

  const handleFileSelect = async (docType, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error("Please select an image file"); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image size should be less than 5MB"); return }

    setUploading(prev => ({ ...prev, [docType]: true }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'appzeto/delivery/documents')

      const response = await apiClient.post('/upload/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response?.data?.success && response?.data?.data) {
        const { url, publicId } = response.data.data
        setDocuments(prev => ({ ...prev, [docType]: file }))
        setUploadedDocs(prev => ({ ...prev, [docType]: { url, publicId } }))
        toast.success("Uploaded successfully")
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error)
      toast.error("Upload failed. Please try again.")
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }))
    }
  }

  const handleRemove = (docType) => {
    setDocuments(prev => ({ ...prev, [docType]: null }))
    setUploadedDocs(prev => ({ ...prev, [docType]: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto) {
      toast.error("Please upload all required documents"); return
    }
    setIsSubmitting(true)
    try {
      const response = await deliveryAPI.submitSignupDocuments({
        profilePhoto: uploadedDocs.profilePhoto,
        aadharPhoto: uploadedDocs.aadharPhoto,
        panPhoto: uploadedDocs.panPhoto,
        drivingLicensePhoto: uploadedDocs.drivingLicensePhoto
      })
      if (response?.data?.success) {
        toast.success("Signup completed successfully!")
        setTimeout(() => navigate("/delivery", { replace: true }), 1000)
      }
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to submit documents."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const allUploaded = uploadedDocs.profilePhoto && uploadedDocs.aadharPhoto && uploadedDocs.panPhoto && uploadedDocs.drivingLicensePhoto
  const uploadedCount = Object.values(uploadedDocs).filter(Boolean).length

  // ── DocumentCard ──
  const DocumentCard = ({ docType, label, icon: Icon }) => {
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType]

    return (
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F5F5F5' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: uploaded ? '#E8F5E9' : '#FFF0F0' }}>
              <Icon className="w-3.5 h-3.5" style={{ color: uploaded ? '#4CAF50' : '#e53935' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>
              {label} <span style={{ color: '#e53935' }}>*</span>
            </span>
          </div>
          {uploaded && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: '#E8F5E9' }}>
              <Check className="w-3 h-3" style={{ color: '#4CAF50' }} />
              <span className="text-xs font-semibold" style={{ color: '#4CAF50' }}>Done</span>
            </div>
          )}
        </div>

        <div className="p-4">
          {uploaded ? (
            <div className="relative rounded-xl overflow-hidden" style={{ height: 160 }}>
              <img src={uploaded.url} alt={label} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-end justify-between p-3"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }}>
                <button type="button" onClick={() => setActiveSheet(docType)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                  <Camera className="w-3.5 h-3.5" /> Retake
                </button>
                <button type="button" onClick={() => handleRemove(docType)}
                  className="p-1.5 rounded-xl" style={{ backgroundColor: 'rgba(229,57,53,0.85)' }}>
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : isUploading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: '#F5F5F5', borderTopColor: '#e53935' }} />
              <p className="text-sm font-medium" style={{ color: '#1E1E1E', opacity: 0.6 }}>Uploading...</p>
            </div>
          ) : (
            <button type="button" onClick={() => setActiveSheet(docType)}
              className="w-full flex flex-col items-center justify-center py-8 gap-3 rounded-xl"
              style={{ border: '2px dashed #EEEEEE', backgroundColor: '#FAFAFA' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFF0F0' }}>
                <Upload className="w-5 h-5" style={{ color: '#e53935' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: '#1E1E1E' }}>Upload {label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#1E1E1E', opacity: 0.45 }}>Camera or Gallery · Max 5MB</p>
              </div>
            </button>
          )}
        </div>

        {/* Hidden gallery input */}
        <input
          ref={el => galleryRef.current[docType] = el}
          type="file" className="hidden" accept="image/*"
          onChange={(e) => { if (e.target.files[0]) handleFileSelect(docType, e.target.files[0]); e.target.value = '' }}
        />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>

        {/* Sticky Header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
          style={{ borderBottom: '1.5px solid #F5F5F5', boxShadow: '0 1px 10px rgba(0,0,0,0.07)' }}>
          <button onClick={() => navigate(-1)} className="p-2 rounded-full"
            style={{ backgroundColor: '#F5F5F5', color: '#1E1E1E' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold" style={{ color: '#1E1E1E' }}>Upload Documents</h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#1E1E1E', opacity: 0.45 }}>Step 2 of 2 · Verification</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-1.5 rounded-full" style={{ backgroundColor: '#e53935' }} />
            <div className="w-7 h-1.5 rounded-full" style={{ backgroundColor: '#e53935' }} />
          </div>
        </div>

        {/* Upload progress bar */}
        <div className="bg-white px-4 py-3" style={{ borderBottom: '1px solid #F5F5F5' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#1E1E1E' }}>{uploadedCount} of 4 uploaded</span>
            <span className="text-xs font-bold" style={{ color: '#e53935' }}>{Math.round((uploadedCount / 4) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: '#F5F5F5' }}>
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(uploadedCount / 4) * 100}%`, backgroundColor: '#e53935' }} />
          </div>
        </div>

        <div className="px-4 pt-4 pb-10 space-y-4">
          <p className="text-xs px-1" style={{ color: '#1E1E1E', opacity: 0.5 }}>
            Tap a card to take a photo with your camera or pick from gallery.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <DocumentCard docType="profilePhoto" label="Profile Photo" icon={Camera} />
            <DocumentCard docType="aadharPhoto" label="Aadhar Card" icon={FileText} />
            <DocumentCard docType="panPhoto" label="PAN Card" icon={FileText} />
            <DocumentCard docType="drivingLicensePhoto" label="Driving License" icon={FileText} />

            <button type="submit" disabled={isSubmitting || !allUploaded}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 mt-2"
              style={{
                backgroundColor: allUploaded && !isSubmitting ? '#e53935' : '#F0F0F0',
                color: allUploaded && !isSubmitting ? '#fff' : '#999',
                cursor: allUploaded && !isSubmitting ? 'pointer' : 'not-allowed',
                boxShadow: allUploaded && !isSubmitting ? '0 6px 20px rgba(229,57,53,0.3)' : 'none',
              }}>
              {isSubmitting ? "Submitting..." : <> Complete Signup <ChevronRight className="w-5 h-5" /> </>}
            </button>
          </form>
        </div>
      </div>

      {/* ── Source Picker Bottom Sheet ── */}
      {activeSheet && (
        <>
          <div className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={() => setActiveSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-8"
            style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#E0E0E0' }} />
            <h3 className="text-base font-bold mb-1" style={{ color: '#1E1E1E' }}>Choose Upload Source</h3>
            <p className="text-xs mb-5" style={{ color: '#1E1E1E', opacity: 0.5 }}>Take a live photo or pick from your gallery</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Camera — opens in-browser camera */}
              <button type="button"
                onClick={() => {
                  const docType = activeSheet
                  setActiveSheet(null)
                  setTimeout(() => setCameraFor(docType), 150)
                }}
                className="flex flex-col items-center gap-3 py-5 rounded-2xl"
                style={{ backgroundColor: '#FFF0F0', border: '1.5px solid #FFCDD2' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#e53935' }}>
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Camera</p>
                  <p className="text-xs" style={{ color: '#1E1E1E', opacity: 0.5 }}>Live capture</p>
                </div>
              </button>

              {/* Gallery */}
              <button type="button"
                onClick={() => {
                  const docType = activeSheet
                  setActiveSheet(null)
                  setTimeout(() => galleryRef.current[docType]?.click(), 150)
                }}
                className="flex flex-col items-center gap-3 py-5 rounded-2xl"
                style={{ backgroundColor: '#FFFBEA', border: '1.5px solid #FFE082' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFC400' }}>
                  <Image className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#1E1E1E' }}>Gallery</p>
                  <p className="text-xs" style={{ color: '#1E1E1E', opacity: 0.5 }}>Choose file</p>
                </div>
              </button>
            </div>

            <button type="button" onClick={() => setActiveSheet(null)}
              className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
              style={{ backgroundColor: '#F5F5F5', color: '#555' }}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── In-Browser Camera Modal ── */}
      {cameraFor && (
        <CameraModal
          onCapture={(file) => handleFileSelect(cameraFor, file)}
          onClose={() => setCameraFor(null)}
        />
      )}
    </>
  )
}
