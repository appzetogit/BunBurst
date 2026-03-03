import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Responsive srcset for different screen sizes
 * - WebP/AVIF format support with fallback
 * - Blur placeholder (LQIP) for smooth loading
 * - Preloading for critical images
 * - Proper decoding and fetchpriority
 * - Error handling with fallback
 */
const OptimizedImage = React.memo(({
  src,
  alt,
  className = '',
  priority = false, // For above-the-fold images
  sizes = '100vw',
  objectFit = 'cover',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority) // Start visible if priority
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // Check if image URL is from Cloudinary
  const isCloudinary = useMemo(() => {
    return src && typeof src === 'string' && src.includes('res.cloudinary.com')
  }, [src])

  // Helper to transform Cloudinary URLs
  const getTransformedUrl = useCallback((width) => {
    if (!src || typeof src !== 'string') return src

    if (isCloudinary) {
      const uploadIndex = src.indexOf('/upload/')
      if (uploadIndex !== -1) {
        const baseUrl = src.substring(0, uploadIndex + 8)
        const remainingUrl = src.substring(uploadIndex + 8).split('?')[0]
        // Insert transformations: progressive, quality auto, format auto, and width
        return `${baseUrl}f_auto,q_auto,w_${width},c_fill,g_auto/${remainingUrl}`
      }
    }

    // Generic fallback for other external images
    const separator = src.includes('?') ? '&' : '?'
    return `${src}${separator}w=${width}&q=80`
  }, [src, isCloudinary])

  // Generate responsive srcset
  const srcSet = useMemo(() => {
    if (!src || src.startsWith('data:') || src.startsWith('/')) return undefined
    const sizesArr = [400, 800, 1200, 1600]
    return sizesArr
      .map(size => `${getTransformedUrl(size)} ${size}w`)
      .join(', ')
  }, [src, getTransformedUrl])

  // Cloudinary handles format automatically via f_auto, so we prioritize the main srcset
  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    if (!imgRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current)
            }
          }
        })
      },
      {
        rootMargin: '200px', // Load earlier for better UX
        threshold: 0.01
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current)
      }
    }
  }, [priority, isInView])

  // Preload critical images
  useEffect(() => {
    if (priority && src && !src.startsWith('data:')) {
      const preloadUrl = isCloudinary ? getTransformedUrl(1200) : src
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = preloadUrl
      link.fetchPriority = 'high'
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [priority, src, isCloudinary, getTransformedUrl])

  const handleLoad = (e) => {
    setIsLoaded(true)
    if (onLoad) onLoad(e)
  }

  const handleError = (e) => {
    setHasError(true)
    if (onError) onError(e)
  }

  // Generate a very low-res Cloudinary placeholder if possible
  const lowResPlaceholder = useMemo(() => {
    if (blurDataURL) return blurDataURL
    if (isCloudinary) {
      const uploadIndex = src.indexOf('/upload/')
      if (uploadIndex !== -1) {
        const baseUrl = src.substring(0, uploadIndex + 8)
        const remainingUrl = src.substring(uploadIndex + 8).split('?')[0]
        return `${baseUrl}w_50,c_fill,q_auto:low,f_auto,e_blur:1000/${remainingUrl}`
      }
    }
    // Default tiny gray square fallback
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg=='
  }, [src, isCloudinary, blurDataURL])

  // Don't render if src is empty or null
  if (!src || src === '') {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-600">Image unavailable</span>
        </div>
      </div>
    )
  }

  const imageSrc = hasError ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E' : (isCloudinary ? getTransformedUrl(800) : src)

  return (
    <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
      {/* Blur Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          style={{
            backgroundImage: `url(${lowResPlaceholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-pulse" />
      )}

      {/* Actual Image */}
      {isInView && (
        <picture className="absolute inset-0 w-full h-full">
          {/* Fallback to original format */}
          <motion.img
            src={imageSrc}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : objectFit === 'contain' ? 'object-contain' : ''} ${priority || isLoaded ? 'opacity-100' : 'opacity-0'} ${!priority && 'transition-opacity duration-300'}`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            crossOrigin="anonymous"
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        </picture>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-600">Image unavailable</span>
        </div>
      )}
    </div>
  )
})

export default OptimizedImage
