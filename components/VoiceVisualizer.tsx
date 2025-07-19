"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface VoiceVisualizerProps {
  isListening: boolean
  isWakeWordListening: boolean
  audioLevel?: number
}

export default function VoiceVisualizer({ isListening, isWakeWordListening, audioLevel = 0 }: VoiceVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(8).fill(0))

  useEffect(() => {
    if (isListening || isWakeWordListening) {
      const interval = setInterval(() => {
        setBars(
          Array(8)
            .fill(0)
            .map(() => Math.random() * (audioLevel || 0.5) + 0.1),
        )
      }, 100)
      return () => clearInterval(interval)
    } else {
      setBars(Array(8).fill(0))
    }
  }, [isListening, isWakeWordListening, audioLevel])

  if (!isListening && !isWakeWordListening) return null

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 flex items-end space-x-1 bg-black/50 rounded-lg p-3">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className={`w-2 rounded-full ${isListening ? "bg-blue-400" : "bg-purple-400"}`}
          animate={{
            height: Math.max(4, height * 40),
            opacity: height > 0.1 ? 1 : 0.3,
          }}
          transition={{
            duration: 0.1,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="ml-3 text-xs text-cyan-400">{isListening ? "Listening..." : "Wake Word Active"}</div>
    </div>
  )
}
