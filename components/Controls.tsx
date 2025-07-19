"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Power, VolumeX, Trash2 } from "lucide-react"

interface ControlsProps {
  isActive: boolean
  isListening: boolean
  isSpeaking: boolean
  isWakeWordListening: boolean
  systemStatus: string
  onTogglePower: () => void
  onToggleVoice: () => void
  onStopSpeech: () => void
  onClearChat: () => void
}

export default function Controls({
  isActive,
  isListening,
  isSpeaking,
  isWakeWordListening,
  systemStatus,
  onTogglePower,
  onToggleVoice,
  onStopSpeech,
  onClearChat,
}: ControlsProps) {
  return (
    <Card className="p-6 bg-black/20 border-purple-500/20 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">System Controls</h3>
          <Badge
            variant="outline"
            className={`${
              systemStatus === "listening"
                ? "border-green-500 text-green-400"
                : systemStatus === "speaking"
                  ? "border-blue-500 text-blue-400"
                  : systemStatus === "error"
                    ? "border-red-500 text-red-400"
                    : systemStatus === "online"
                      ? "border-purple-500 text-purple-400"
                      : "border-gray-500 text-gray-400"
            }`}
          >
            {systemStatus.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onTogglePower}
            variant={isActive ? "destructive" : "default"}
            className="flex items-center gap-2 h-12"
          >
            <Power className="w-4 h-4" />
            {isActive ? "Shutdown" : "Power On"}
          </Button>

          <Button
            onClick={onToggleVoice}
            disabled={!isActive}
            variant={isListening ? "secondary" : "outline"}
            className="flex items-center gap-2 h-12"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isListening ? "Stop Listen" : "Listen"}
          </Button>

          <Button
            onClick={onStopSpeech}
            disabled={!isSpeaking}
            variant="outline"
            className="flex items-center gap-2 h-12 bg-transparent"
          >
            <VolumeX className="w-4 h-4" />
            Stop Speech
          </Button>

          <Button onClick={onClearChat} variant="outline" className="flex items-center gap-2 h-12 bg-transparent">
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </Button>
        </div>

        <div className="pt-4 border-t border-purple-500/20">
          <h4 className="font-medium mb-3 text-sm">System Status</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span>Wake Word Detection:</span>
              <Badge variant={isWakeWordListening ? "default" : "secondary"} className="text-xs">
                {isWakeWordListening ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Voice Input:</span>
              <Badge variant={isListening ? "default" : "secondary"} className="text-xs">
                {isListening ? "Listening" : "Idle"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Speech Output:</span>
              <Badge variant={isSpeaking ? "default" : "secondary"} className="text-xs">
                {isSpeaking ? "Speaking" : "Silent"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
