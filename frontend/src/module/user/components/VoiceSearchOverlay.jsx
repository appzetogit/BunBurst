import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function VoiceSearchOverlay({ isOpen, onClose, transcript, isListening }) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white dark:bg-[#1a1a1a] rounded-[2.5rem] p-8 sm:p-12 w-full max-w-lg shadow-2xl flex flex-col items-center relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Animated Background Ripples */}
                    {isListening && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <motion.div
                                animate={{
                                    scale: [1, 1.5, 2],
                                    opacity: [0.5, 0.2, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                }}
                                className="absolute w-32 h-32 bg-primary-orange/20 rounded-full"
                            />
                            <motion.div
                                animate={{
                                    scale: [1, 1.4, 1.8],
                                    opacity: [0.4, 0.1, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                    delay: 0.6,
                                }}
                                className="absolute w-32 h-32 bg-primary-orange/15 rounded-full"
                            />
                        </div>
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>

                    {/* Large Mic Icon */}
                    <motion.div
                        animate={isListening ? {
                            scale: [1, 1.1, 1],
                        } : {}}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                        }}
                        className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-inner transition-colors ${isListening ? "bg-primary-orange text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                            }`}
                    >
                        <Mic className={`w-12 h-12 ${isListening ? "animate-pulse" : ""}`} />
                    </motion.div>

                    {/* Status / Transcript Text */}
                    <div className="text-center space-y-4 w-full">
                        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-orange to-orange-600 bg-clip-text text-transparent">
                            {isListening ? "Listening..." : "Processing..."}
                        </h2>

                        <div className="min-h-[3rem] flex items-center justify-center">
                            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-medium line-clamp-2 italic">
                                {transcript || "Speak Now..."}
                            </p>
                        </div>
                    </div>

                    <div className="mt-12 w-full flex justify-center">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="rounded-full px-8 py-6 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 font-semibold"
                        >
                            Cancel
                        </Button>
                    </div>

                    {/* Footer visual hint */}
                    <div className="mt-8 flex gap-1 items-center justify-center">
                        {isListening && [0, 1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    height: [8, 24, 8],
                                }}
                                transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                }}
                                className="w-1.5 bg-primary-orange rounded-full"
                            />
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
