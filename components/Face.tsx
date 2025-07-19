"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface FaceProps {
  isActive: boolean
  isListening: boolean
  isSpeaking: boolean
  systemStatus: "offline" | "online" | "listening" | "speaking" | "error" | "text-only"
}

export default function Face({ isActive, isListening, isSpeaking, systemStatus }: FaceProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  useEffect(() => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }))
    setParticles(newParticles)
  }, [])

  const getStatusColor = () => {
    switch (systemStatus) {
      case "listening":
        return "#22d3ee" // cyan-400
      case "speaking":
        return "#06b6d4" // cyan-500
      case "error":
        return "#ef4444" // red-500
      case "text-only":
        return "#eab308" // yellow-500
      case "online":
        return "#22d3ee" // cyan-400
      default:
        return "#6b7280" // gray-500
    }
  }

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Outer Ring */}
      <motion.div
        className="absolute w-72 h-72 rounded-full border-2"
        style={{ borderColor: getStatusColor() }}
        animate={{
          rotate: isActive ? 360 : 0,
          scale: isListening ? 1.05 : 1,
          opacity: isActive ? 1 : 0.3,
        }}
        transition={{
          rotate: { duration: 30, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
          scale: { duration: 0.5 },
          opacity: { duration: 0.5 },
        }}
      >
        {/* Scanning line */}
        <motion.div
          className="absolute top-0 left-1/2 w-0.5 h-full origin-bottom"
          style={{ backgroundColor: getStatusColor() }}
          animate={{
            rotate: isActive ? 360 : 0,
            opacity: isActive ? [0.2, 0.8, 0.2] : 0,
          }}
          transition={{
            rotate: { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
            opacity: { duration: 2, repeat: Number.POSITIVE_INFINITY },
          }}
        />
      </motion.div>

      {/* Middle Ring */}
      <motion.div
        className="absolute w-56 h-56 rounded-full border-2"
        style={{ borderColor: getStatusColor() }}
        animate={{
          rotate: isActive ? -360 : 0,
          scale: isSpeaking ? 1.1 : 1,
          opacity: isActive ? 0.8 : 0.2,
        }}
        transition={{
          rotate: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
          scale: { duration: 0.3 },
          opacity: { duration: 0.5 },
        }}
      />

      {/* Inner Ring */}
      <motion.div
        className="absolute w-40 h-40 rounded-full border-2"
        style={{ borderColor: getStatusColor() }}
        animate={{
          rotate: isActive ? 360 : 0,
          scale: systemStatus === "error" ? [1, 1.2, 1] : 1,
          opacity: isActive ? 0.6 : 0.1,
        }}
        transition={{
          rotate: { duration: 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
          scale: { duration: 0.5, repeat: systemStatus === "error" ? Number.POSITIVE_INFINITY : 0 },
          opacity: { duration: 0.5 },
        }}
      />

      {/* Central Core */}
      <motion.div
        className="relative w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: `${getStatusColor()}10`,
          border: `1px solid ${getStatusColor()}40`,
        }}
        animate={{
          scale: isActive ? [1, 1.05, 1] : 0.9,
          boxShadow: isActive ? `0 0 40px ${getStatusColor()}40, 0 0 80px ${getStatusColor()}20` : "none",
        }}
        transition={{
          scale: { duration: 3, repeat: Number.POSITIVE_INFINITY },
          boxShadow: { duration: 0.5 },
        }}
      >
        {/* Eyes */}
        <div className="flex space-x-6 mb-4">
          {[0, 1].map((eye) => (
            <motion.div
              key={eye}
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getStatusColor() }}
              animate={{
                scale: isListening ? [1, 1.3, 1] : isActive ? [1, 1.1, 1] : 0.7,
                opacity: isActive ? 1 : 0.3,
                boxShadow: isActive ? `0 0 10px ${getStatusColor()}` : "none",
              }}
              transition={{
                scale: { duration: 2, repeat: Number.POSITIVE_INFINITY },
                opacity: { duration: 0.5 },
                boxShadow: { duration: 0.5 },
              }}
            />
          ))}
        </div>

        {/* Mouth */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <motion.div
            className="h-1 rounded-full"
            style={{ backgroundColor: getStatusColor() }}
            animate={{
              width: isSpeaking ? [20, 40, 20] : isActive ? 24 : 16,
              opacity: isActive ? 1 : 0.3,
            }}
            transition={{
              width: { duration: 0.5, repeat: isSpeaking ? Number.POSITIVE_INFINITY : 0 },
              opacity: { duration: 0.5 },
            }}
          />

          {/* Speaking particles */}
          <AnimatePresence>
            {isSpeaking &&
              particles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute w-1 h-1 rounded-full"
                  style={{ backgroundColor: getStatusColor() }}
                  initial={{
                    x: 0,
                    y: 0,
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    x: [0, (particle.x - 50) * 0.5],
                    y: [0, (particle.y - 50) * 0.3],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: particle.delay,
                    ease: "easeOut",
                  }}
                />
              ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Status Label */}
      <motion.div
        className="absolute -bottom-12 left-1/2 transform -translate-x-1/2"
        animate={{ opacity: isActive ? 1 : 0.5 }}
      >
        <div
          className="px-4 py-2 rounded text-sm font-medium border"
          style={{
            backgroundColor: `${getStatusColor()}20`,
            borderColor: getStatusColor(),
            color: getStatusColor(),
          }}
        >
          {systemStatus === "text-only" ? "TEXT MODE" : systemStatus.toUpperCase()}
        </div>
      </motion.div>

      {/* Ambient Glow */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          boxShadow: isActive ? `0 0 100px ${getStatusColor()}15, 0 0 200px ${getStatusColor()}08` : "none",
        }}
        transition={{ duration: 1 }}
      />
    </div>
  )
}
