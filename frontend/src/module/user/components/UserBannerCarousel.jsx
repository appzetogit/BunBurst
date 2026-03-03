import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import OptimizedImage from "@/components/OptimizedImage"

const UserBannerCarousel = ({
    banners = [],
    loading = false,
    autoSlideInterval = 10000,
    className = ""
}) => {
    const [currentIndex, setCurrentIndex] = useState(0)
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)
    const touchEndX = useRef(0)
    const touchEndY = useRef(0)
    const isSwiping = useRef(false)
    const autoSlideIntervalRef = useRef(null)

    const nextBanner = useCallback(() => {
        if (banners.length === 0) return
        setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, [banners.length])

    const prevBanner = useCallback(() => {
        if (banners.length === 0) return
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
    }, [banners.length])

    const resetAutoSlide = useCallback(() => {
        if (autoSlideIntervalRef.current) {
            clearInterval(autoSlideIntervalRef.current)
        }
        if (banners.length > 1 && autoSlideInterval > 0) {
            autoSlideIntervalRef.current = setInterval(() => {
                if (!isSwiping.current) {
                    nextBanner()
                }
            }, autoSlideInterval)
        }
    }, [banners.length, autoSlideInterval, nextBanner])

    useEffect(() => {
        resetAutoSlide()
        return () => {
            if (autoSlideIntervalRef.current) {
                clearInterval(autoSlideIntervalRef.current)
            }
        }
    }, [resetAutoSlide])

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        isSwiping.current = true
    }

    const handleTouchMove = (e) => {
        touchEndX.current = e.touches[0].clientX
        touchEndY.current = e.touches[0].clientY
    }

    const handleTouchEnd = () => {
        if (!isSwiping.current || banners.length <= 1) return

        const deltaX = touchEndX.current - touchStartX.current
        const deltaY = Math.abs(touchEndY.current - touchStartY.current)
        const minSwipeDistance = 50

        if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
            if (deltaX > 0) {
                prevBanner()
            } else {
                nextBanner()
            }
            resetAutoSlide()
        }

        setTimeout(() => {
            isSwiping.current = false
        }, 300)
    }

    if (loading) {
        return (
            <div className={`relative w-full overflow-hidden min-h-[20vh] lg:min-h-[35vh] px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 pt-4 ${className}`}>
                <div className="absolute top-4 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 lg:left-8 lg:right-8 xl:left-12 xl:right-12 bottom-0 z-0 bg-primary flex items-center justify-center rounded-3xl shadow-2xl border-2 border-primary/20">
                    <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-primary-foreground" />
                </div>
            </div>
        )
    }

    if (banners.length === 0) {
        return (
            <div className={`relative w-full overflow-hidden min-h-[20vh] lg:min-h-[35vh] px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 pt-4 ${className}`}>
                <div className="absolute top-4 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 lg:left-8 lg:right-8 xl:left-12 xl:right-12 bottom-0 z-0 bg-primary rounded-3xl shadow-2xl border-2 border-primary/20" />
            </div>
        )
    }

    return (
        <div
            className={`relative w-full overflow-hidden min-h-[20vh] lg:min-h-[35vh] pt-4 ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="absolute top-4 left-0 right-0 bottom-0 z-10 rounded-3xl overflow-hidden shadow-2xl ring-2 ring-background/30 hover:ring-background/50 transition-all duration-300">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full h-full"
                    >
                        <OptimizedImage
                            src={banners[currentIndex]?.imageUrl || banners[currentIndex]}
                            alt={banners[currentIndex]?.title || "Banner"}
                            className="w-full h-full object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
                            objectFit="cover"
                            priority={true}
                            placeholder="blur"
                        />
                    </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-background/10 via-transparent to-transparent pointer-events-none" />
            </div>

            {banners.length > 1 && (
                <>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                        {banners.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentIndex(index)
                                    resetAutoSlide()
                                }}
                                className={`transition-all duration-300 rounded-full ${index === currentIndex
                                    ? "w-8 h-2 bg-foreground shadow-lg"
                                    : "w-2 h-2 bg-foreground/60 hover:bg-foreground/80"
                                    }`}
                                aria-label={`Go to banner ${index + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => { prevBanner(); resetAutoSlide(); }}
                        className="absolute left-6 sm:left-8 lg:left-10 top-1/2 -translate-y-1/2 z-30 bg-background/90 hover:bg-background text-foreground p-2 sm:p-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 backdrop-blur-sm"
                        aria-label="Previous banner"
                    >
                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                        onClick={() => { nextBanner(); resetAutoSlide(); }}
                        className="absolute right-6 sm:right-8 lg:right-10 top-1/2 -translate-y-1/2 z-30 bg-background/90 hover:bg-background text-foreground p-2 sm:p-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 backdrop-blur-sm"
                        aria-label="Next banner"
                    >
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </>
            )}
        </div>
    )
}

export default React.memo(UserBannerCarousel)
