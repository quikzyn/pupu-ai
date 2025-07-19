"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase" // Import the client-side Supabase client
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Face from "@/components/Face"
import { Mic, VolumeX, Send, AlertCircle, LogOut } from "lucide-react"
import VoiceVisualizer from "@/components/VoiceVisualizer"
import { checkMicrophoneAvailability } from "@/utils/microphone" // Declare the variable before using it

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

type SpeechRecognition = any

export default function PupuAssistant() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [userApiKeys, setUserApiKeys] = useState<{
    openai?: string
    gemini?: string
    xai?: string
    search?: string
  }>({})

  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isWakeWordListening, setIsWakeWordListening] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentResponse, setCurrentResponse] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [systemStatus, setSystemStatus] = useState<
    "offline" | "online" | "listening" | "speaking" | "error" | "text-only"
  >("offline")
  const [textInput, setTextInput] = useState("")
  const [isTextMode, setIsTextMode] = useState(true) // Default to text mode
  const [micStatus, setMicStatus] = useState<{ hasPermission: boolean; hasDevice: boolean; error?: string }>({
    hasPermission: false,
    hasDevice: false,
  })
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState({
    provider: "browser", // "browser" or "elevenlabs"
    rate: 0.8, // Slightly slower for a "low" voice
    pitch: 0.9, // Lower pitch for a "low" voice
    volume: 0.8,
    selectedVoiceName: "", // To store the selected browser voice
  })
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voicesLoaded, setVoicesLoaded] = useState(false) // New state to track voice loading

  // AI Provider State
  const [selectedAIProvider, setSelectedAIProvider] = useState<"gemini" | "openai" | "grok">("gemini")
  const availableAIProviders = ["gemini", "openai", "grok"]

  // Add state for selected Gemini model
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>("gemini-pro") // Changed default model to gemini-pro
  const availableGeminiModels = [
    "gemini-pro", // generally free-tier friendly
    "gemini-pro-vision", // generally free-tier friendly
    "gemini-1.5-pro", // more advanced, might have different tier access
    "gemini-1.5-flash", // more advanced, might have different tier access
  ]

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const wakeWordRecognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Add state tracking for recognition instances
  const [recognitionState, setRecognitionState] = useState({
    commandRunning: false,
    wakeWordRunning: false,
  })

  const addDebugInfo = (info: string) => {
    console.log("DEBUG:", info)
    setDebugInfo((prev) => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`])
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // --- Supabase Auth and API Key Management ---
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        addDebugInfo(`User logged in: ${session.user.email}`)
        await fetchUserApiKeys(session.user.id)
      } else {
        addDebugInfo("No user session found, redirecting to login.")
        router.push("/login")
      }
      setLoadingUser(false)
    }

    checkUser()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user)
        addDebugInfo(`Auth state changed: User ${session.user.email} is now logged in.`)
        fetchUserApiKeys(session.user.id)
      } else {
        setUser(null)
        setUserApiKeys({})
        addDebugInfo("Auth state changed: User logged out.")
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const fetchUserApiKeys = async (userId: string) => {
    addDebugInfo(`Fetching API keys for user: ${userId}`)
    const { data, error } = await supabase.from("user_api_keys").select("*").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      // PGRST116 means "no rows found", 42P01 means "relation does not exist"
      addDebugInfo(`Error fetching API keys: ${error.message}`)
      console.error("Error fetching API keys:", error)
    } else if (data) {
      setUserApiKeys({
        openai: data.openai_key || "",
        gemini: data.gemini_key || "",
        xai: data.xai_key || "",
        search: data.search_key || "",
      })
      addDebugInfo("User API keys loaded from Supabase.")
    } else {
      setUserApiKeys({}) // No keys found or table doesn't exist
      addDebugInfo("No API keys found for user in Supabase or table not yet created.")
    }
  }

  const handleSaveApiKeys = async () => {
    if (!user) {
      alert("Please log in to save API keys.")
      return
    }
    addDebugInfo("Saving API keys to Supabase...")

    const { error } = await supabase.from("user_api_keys").upsert(
      {
        user_id: user.id,
        openai_key: userApiKeys.openai || null,
        gemini_key: userApiKeys.gemini || null,
        xai_key: userApiKeys.xai || null,
        search_key: userApiKeys.search || null,
      },
      { onConflict: "user_id" },
    )

    if (error) {
      console.error("Supabase save API keys error:", error)
      const code = (error as any)?.code
      const msg = (error as any)?.message
      addDebugInfo(`Error saving API keys [${code}]: ${msg}`)
      let errorMessage = msg || "Unknown Supabase error."
      if (code === "42501") {
        errorMessage = "Permission denied. Check your RLS policies for INSERT/UPDATE on the user_api_keys table."
      } else if (code === "42P01") {
        errorMessage = "Table user_api_keys not found. Did you run the migration / SQL to create it?"
      }
      alert(`Failed to save API keys: ${errorMessage}`)
    } else {
      addDebugInfo("API keys saved to Supabase successfully.")
      alert("API keys saved to your account!")
    }
  }

  const handleLogout = async () => {
    addDebugInfo("Logging out...")
    const { error } = await supabase.auth.signOut()
    if (error) {
      addDebugInfo(`Error logging out: ${error.message}`)
      console.error("Error logging out:", error)
      alert(`Logout failed: ${error.message}`)
    } else {
      addDebugInfo("Logged out successfully.")
      router.push("/login")
    }
  }

  // --- Existing Pupu Logic ---
  useEffect(() => {
    addDebugInfo("Checking microphone availability...")
    checkMicrophoneAvailability().then((status) => {
      setMicStatus(status)
      addDebugInfo(
        `Mic status: Device=${status.hasDevice}, Permission=${status.hasPermission}, Error=${status.error || "none"}`,
      )
    })
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      addDebugInfo("Initializing speech recognition...")

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition

      if (!SpeechRecognition) {
        addDebugInfo("Speech recognition not supported in this browser")
        return
      }

      if (micStatus.hasDevice && micStatus.hasPermission) {
        try {
          recognitionRef.current = new SpeechRecognition()
          recognitionRef.current.continuous = false
          recognitionRef.current.interimResults = false
          recognitionRef.current.lang = "en-US"

          wakeWordRecognitionRef.current = new SpeechRecognition()
          wakeWordRecognitionRef.current.continuous = true
          wakeWordRecognitionRef.current.interimResults = true
          wakeWordRecognitionRef.current.lang = "en-US"

          synthRef.current = window.speechSynthesis

          addDebugInfo("Speech recognition initialized successfully")
        } catch (error: any) {
          addDebugInfo(`Speech recognition initialization failed: ${error.message}`)
        }
      }
    }
  }, [micStatus])

  useEffect(() => {
    if (typeof window !== "undefined" && synthRef.current) {
      const handleVoicesChanged = () => {
        const voices = synthRef.current?.getVoices() || []
        setAvailableVoices(voices)
        if (voices.length > 0) {
          setVoicesLoaded(true)
          addDebugInfo(`Loaded ${voices.length} browser voices.`)

          const dannyVoice = voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.toLowerCase().includes("danny") ||
                v.name.toLowerCase().includes("daniel") ||
                v.name.toLowerCase().includes("male")),
          )
          if (dannyVoice) {
            setVoiceSettings((prev) => ({ ...prev, selectedVoiceName: dannyVoice.name }))
            addDebugInfo(`Auto-selected voice: ${dannyVoice.name}`)
          } else {
            const firstEnglishVoice = voices.find((v) => v.lang.startsWith("en"))
            if (firstEnglishVoice) {
              setVoiceSettings((prev) => ({ ...prev, selectedVoiceName: firstEnglishVoice.name }))
              addDebugInfo(`Fallback to first English voice: ${firstEnglishVoice.name}`)
            }
          }
        }
      }

      if (synthRef.current.getVoices().length > 0) {
        handleVoicesChanged()
      } else {
        synthRef.current.onvoiceschanged = handleVoicesChanged
      }

      return () => {
        if (synthRef.current) {
          synthRef.current.onvoiceschanged = null
        }
      }
    }
  }, [synthRef.current])

  useEffect(() => {
    if (!recognitionState.commandRunning && !recognitionState.wakeWordRunning) {
      if (isListening) {
        addDebugInfo("⚠️ UI sync: Stopping listening state (no recognition running)")
        setIsListening(false)
      }
      if (isWakeWordListening) {
        addDebugInfo("⚠️ UI sync: Stopping wake word state (no recognition running)")
        setIsWakeWordListening(false)
      }
      if (systemStatus === "listening" && isActive) {
        addDebugInfo("⚠️ UI sync: Resetting system status")
        setSystemStatus(isTextMode ? "text-only" : "online")
      }
    }
  }, [recognitionState, isListening, isWakeWordListening, systemStatus, isActive, isTextMode])

  const isWakeWordDetected = (transcript: string): boolean => {
    const lowerTranscript = transcript.toLowerCase().trim()
    const wakeWords = ["hey pupu", "pupu", "hey pup", "papa", "hey papa", "hello pupu", "hi pupu"]
    const greetings = ["hello", "hi", "hey", "hello there", "hi there", "hey there"]

    for (const wakeWord of wakeWords) {
      if (lowerTranscript.includes(wakeWord)) {
        return true
      }
    }
    for (const greeting of greetings) {
      if (lowerTranscript === greeting || lowerTranscript.startsWith(greeting + " ")) {
        return true
      }
    }
    return false
  }

  const safeStopRecognition = (recognition: SpeechRecognition | null, type: "command" | "wakeword") => {
    if (recognition) {
      try {
        recognition.stop()
        addDebugInfo(`${type} recognition stopped safely`)
      } catch (error: any) {
        addDebugInfo(`Error stopping ${type} recognition: ${error.message}`)
      }
    }
  }

  const safeStartRecognition = (recognition: SpeechRecognition | null, type: "command" | "wakeword"): boolean => {
    if (!recognition) {
      addDebugInfo(`Cannot start ${type} recognition - not initialized`)
      return false
    }
    try {
      recognition.start()
      addDebugInfo(`${type} recognition started safely`)
      return true
    } catch (error: any) {
      if (error.message.includes("already started")) {
        addDebugInfo(`${type} recognition already running - stopping first`)
        safeStopRecognition(recognition, type)
        setTimeout(() => {
          try {
            recognition.start()
            addDebugInfo(`${type} recognition restarted successfully`)
          } catch (retryError: any) {
            addDebugInfo(`Failed to restart ${type} recognition: ${retryError.message}`)
          }
        }, 100)
        return false
      } else {
        addDebugInfo(`Failed to start ${type} recognition: ${error.message}`)
        return false
      }
    }
  }

  const startWakeWordListening = useCallback(async () => {
    if (!wakeWordRecognitionRef.current || !micStatus.hasPermission) {
      addDebugInfo("Cannot start wake word listening - no recognition or permission")
      return
    }
    if (recognitionState.commandRunning) {
      safeStopRecognition(recognitionRef.current, "command")
      setRecognitionState((prev) => ({ ...prev, commandRunning: false }))
      setIsListening(false)
    }
    if (recognitionState.wakeWordRunning) {
      addDebugInfo("Wake word recognition already running")
      return
    }
    addDebugInfo("Starting wake word listening...")
    setIsWakeWordListening(true)
    setSystemStatus("online")

    wakeWordRecognitionRef.current.onstart = () => {
      setRecognitionState((prev) => ({ ...prev, wakeWordRunning: true }))
      addDebugInfo("Wake word recognition started")
    }
    wakeWordRecognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript
      const confidence = event.results[event.results.length - 1][0].confidence
      addDebugInfo(`Wake word heard: "${transcript}" (confidence: ${confidence?.toFixed(2) || "unknown"})`)

      if (isWakeWordDetected(transcript)) {
        addDebugInfo("✅ Wake word detected! Starting command listening...")
        setIsWakeWordListening(false)
        safeStopRecognition(wakeWordRecognitionRef.current, "wakeword")
        setRecognitionState((prev) => ({ ...prev, wakeWordRunning: false }))
        setTimeout(() => {
          startListening()
        }, 300)
      } else {
        addDebugInfo(`❌ Not a wake word: "${transcript}"`)
      }
    }
    wakeWordRecognitionRef.current.onerror = (event: any) => {
      addDebugInfo(`Wake word error: ${event.error}`)
      setRecognitionState((prev) => ({ ...prev, wakeWordRunning: false }))
      setIsWakeWordListening(false)
      if (event.error === "no-speech") {
        if (isActive && !isTextMode) {
          addDebugInfo("🔄 Restarting wake word listening after no-speech")
          setTimeout(startWakeWordListening, 500)
        }
      } else if (event.error === "not-allowed") {
        setSystemStatus("error")
        addDebugInfo("Microphone permission denied")
      } else {
        setSystemStatus("error")
        addDebugInfo(`Wake word error: ${event.error} - will retry in 3 seconds`)
        if (isActive && !isTextMode) {
          setTimeout(startWakeWordListening, 3000)
        }
      }
    }
    wakeWordRecognitionRef.current.onend = () => {
      addDebugInfo("Wake word recognition ended")
      setRecognitionState((prev) => ({ ...prev, wakeWordRunning: false }))
      if (isActive && !isTextMode && isWakeWordListening) {
        setTimeout(startWakeWordListening, 500)
      }
    }
    safeStartRecognition(wakeWordRecognitionRef.current, "wakeword")
  }, [isActive, micStatus.hasPermission, isTextMode, isWakeWordListening, recognitionState])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      addDebugInfo("Cannot start listening - no recognition available")
      return
    }
    if (recognitionState.wakeWordRunning) {
      safeStopRecognition(wakeWordRecognitionRef.current, "wakeword")
      setRecognitionState((prev) => ({ ...prev, wakeWordRunning: false }))
      setIsWakeWordListening(false)
    }
    if (recognitionState.commandRunning) {
      addDebugInfo("Command recognition already running")
      return
    }
    addDebugInfo("🎯 Starting command listening...")
    setIsListening(true)
    setSystemStatus("listening")

    recognitionRef.current.onstart = () => {
      setRecognitionState((prev) => ({ ...prev, commandRunning: true }))
      addDebugInfo("Command recognition started")
    }
    recognitionRef.current.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      const confidence = event.results[0][0].confidence
      addDebugInfo(`🎤 Command heard: "${transcript}" (confidence: ${confidence?.toFixed(2) || "unknown"})`)

      setIsListening(false)
      setRecognitionState((prev) => ({ ...prev, commandRunning: false }))

      if (!confidence || confidence > 0.3 || transcript.length < 20) {
        await processCommand(transcript)
      } else {
        addDebugInfo(`❌ Command ignored due to low confidence: ${confidence}`)
      }
      if (isActive && !isTextMode) {
        setTimeout(startListening, 1000)
      }
    }
    recognitionRef.current.onerror = (event: any) => {
      addDebugInfo(`Command recognition error: ${event.error}`)
      setIsListening(false)
      setRecognitionState((prev) => ({ ...prev, commandRunning: false }))
      if (event.error === "no-speech") {
        addDebugInfo("🔄 No speech detected, restarting command listening")
        if (isActive && !isTextMode) {
          setTimeout(startListening, 1000)
        }
      } else {
        setSystemStatus("error")
        addDebugInfo(`Command error: ${event.error} - will retry in 2 seconds`)
        if (isActive && !isTextMode) {
          setTimeout(startListening, 2000)
        }
      }
    }
    recognitionRef.current.onend = () => {
      addDebugInfo("Command recognition ended")
      setIsListening(false)
      setRecognitionState((prev) => ({ ...prev, commandRunning: false }))
      if (isActive && !isTextMode) {
        setTimeout(startListening, 500)
      }
    }
    safeStartRecognition(recognitionRef.current, "command")
  }, [isActive, isTextMode, recognitionState])

  const processCommand = useCallback(
    async (command: string) => {
      addDebugInfo(`🤖 Processing command: "${command}"`)

      const userMessage: Message = {
        role: "user",
        content: command,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsTyping(true)
      setCurrentResponse("Thinking...")

      try {
        addDebugInfo(`Sending request to AI (Provider: ${selectedAIProvider})...`)
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            query: command,
            aiProvider: selectedAIProvider,
            geminiModel: selectedGeminiModel, // Pass the selected Gemini model
          }),
        })

        // Read the response body as text FIRST. This consumes the stream once.
        const responseText = await response.text()
        addDebugInfo(`Raw AI response text (first 100 chars): ${responseText.substring(0, 100)}...`)

        let data: any
        try {
          // Attempt to parse the text as JSON
          data = JSON.parse(responseText)
        } catch (jsonParseError) {
          // If JSON parsing fails, it means the server sent non-JSON or an empty body.
          // The raw text is already available in responseText.
          addDebugInfo(`Failed to parse response as JSON. Raw text: ${responseText}`)
          throw new Error(`Server responded with non-JSON or empty body: ${responseText.substring(0, 100)}...`)
        }

        addDebugInfo(`AI response status: ${response.status}`)

        if (!response.ok) {
          // If response is not OK, and we successfully parsed JSON, use its error details
          const errorMessage = data.details || data.response || `HTTP ${response.status}: Unknown server error.`
          throw new Error(errorMessage)
        }

        // If response is OK, proceed with the data
        addDebugInfo(`AI response received: ${data.response?.substring(0, 50)}...`)

        if (!data.response) {
          throw new Error("No response from AI service")
        }

        setIsTyping(false)

        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        setCurrentResponse(data.response)

        if (!isTextMode) {
          await speakResponse(data.response)
        } else {
          setSystemStatus("text-only")
        }
      } catch (error: any) {
        addDebugInfo(`Error processing command: ${error.message}`)
        setIsTyping(false)
        setSystemStatus("error")
        const errorMessage = `Sorry, I encountered an error: ${error.message.startsWith("HTTP") ? error.message : `Internal error: ${error.message}`}`
        setCurrentResponse(errorMessage)

        const errorMsg: Message = {
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])

        if (!isTextMode) {
          await speakResponse(errorMessage)
        }
      }
    },
    [selectedAIProvider, messages, isTextMode, selectedGeminiModel],
  )

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return

    await processCommand(textInput)
    setTextInput("")
  }

  const speakWithBrowserTTS = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!synthRef.current) {
          addDebugInfo("Error: Speech synthesis not available for speakWithBrowserTTS.")
          reject(new Error("Speech synthesis not available"))
          return
        }

        synthRef.current.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = voiceSettings.rate
        utterance.pitch = voiceSettings.pitch
        utterance.volume = voiceSettings.volume

        if (voicesLoaded && voiceSettings.selectedVoiceName) {
          const selectedVoice = availableVoices.find((v) => v.name === voiceSettings.selectedVoiceName)
          if (selectedVoice) {
            utterance.voice = selectedVoice
            addDebugInfo(`Using selected voice: ${selectedVoice.name}`)
          } else {
            addDebugInfo(
              `Selected voice "${voiceSettings.selectedVoiceName}" not found in available voices. Using default.`,
            )
          }
        } else if (voicesLoaded && availableVoices.length > 0) {
          const firstEnglishVoice = availableVoices.find((v) => v.lang.startsWith("en"))
          if (firstEnglishVoice) {
            utterance.voice = firstEnglishVoice
            addDebugInfo(`Using first English voice as fallback: ${firstEnglishVoice.name}`)
          }
        } else {
          addDebugInfo("No available voices to select from yet. Using browser default.")
        }

        utterance.onend = () => {
          addDebugInfo("Browser TTS completed")
          resolve()
        }
        utterance.onerror = (e) => {
          addDebugInfo(`Browser TTS error: ${e.error}`)
          reject(new Error(`TTS error: ${e.error}`))
        }
        synthRef.current.speak(utterance)
        addDebugInfo("Initiated browser TTS speak.")
      })
    },
    [voiceSettings, availableVoices, voicesLoaded],
  )

  const speakResponse = async (text: string) => {
    if (!text || isTextMode) return

    addDebugInfo("Starting speech synthesis...")
    setIsSpeaking(true)
    setSystemStatus("speaking")

    try {
      await speakWithBrowserTTS(text)
      setIsSpeaking(false)
      setSystemStatus(isTextMode ? "text-only" : "online")
    } catch (error: any) {
      addDebugInfo(`TTS error: ${error.message}`)
      setIsSpeaking(false)
      setSystemStatus("error")
    }
  }

  const togglePower = async () => {
    if (isActive) {
      addDebugInfo("Shutting down system...")
      setIsActive(false)
      setIsWakeWordListening(false)
      setIsListening(false)
      setIsSpeaking(false)
      // setIsTextMode(true); // Keep current mode on shutdown
      setSystemStatus("offline")

      safeStopRecognition(recognitionRef.current, "command")
      safeStopRecognition(wakeWordRecognitionRef.current, "wakeword")
      setRecognitionState({ commandRunning: false, wakeWordRunning: false })
      synthRef.current?.cancel()
    } else {
      addDebugInfo("Starting up system...")
      const micCheck = await checkMicrophoneAvailability()
      setMicStatus(micCheck)

      if (micCheck.hasDevice && micCheck.hasPermission) {
        addDebugInfo("Starting in voice mode with direct listening...")
        setIsActive(true)
        setIsTextMode(false) // Force voice mode on activation if mic is available
        setSystemStatus("online")
        setTimeout(startListening, 1000)
      } else {
        addDebugInfo("Starting in text mode...")
        setIsActive(true)
        setIsTextMode(true)
        setSystemStatus("text-only")
      }
    }
  }

  const toggleVoiceListening = () => {
    if (!micStatus.hasDevice || !micStatus.hasPermission) return

    if (isListening) {
      addDebugInfo("Stopping manual listening...")
      safeStopRecognition(recognitionRef.current, "command")
      setRecognitionState((prev) => ({ ...prev, commandRunning: false }))
      setIsListening(false)
      if (isActive && !isTextMode) startWakeWordListening()
    } else {
      addDebugInfo("Starting manual listening...")
      safeStopRecognition(wakeWordRecognitionRef.current, "wakeword")
      setRecognitionState((prev) => ({ ...prev, wakeWordRunning: false }))
      setIsWakeWordListening(false)
      startListening()
    }
  }

  const switchToTextMode = () => {
    addDebugInfo("Switching to text mode...")
    setIsTextMode(true)
    setSystemStatus("text-only")
    safeStopRecognition(recognitionRef.current, "command")
    safeStopRecognition(wakeWordRecognitionRef.current, "wakeword")
    setRecognitionState({ commandRunning: false, wakeWordRunning: false })
    setIsListening(false)
    setIsWakeWordListening(false)
  }

  const switchToVoiceMode = async () => {
    addDebugInfo("Switching to voice mode...")
    const micCheck = await checkMicrophoneAvailability()
    setMicStatus(micCheck)

    if (micCheck.hasDevice && micCheck.hasPermission) {
      setIsTextMode(false)
      setSystemStatus("online")
      setTimeout(startListening, 1000)
    } else {
      addDebugInfo("Cannot switch to voice mode - no microphone access")
      alert("Cannot switch to voice mode. Please check microphone permissions.")
    }
  }

  const checkAndRecoverRecognition = useCallback(() => {
    if (isActive && !isTextMode && !recognitionState.commandRunning && !recognitionState.wakeWordRunning) {
      addDebugInfo("🚨 Recovery: No recognition running when it should be - restarting command listening")
      setTimeout(startListening, 1000)
    }
  }, [isActive, isTextMode, recognitionState])

  useEffect(() => {
    if (isActive && !isTextMode) {
      const recoveryInterval = setInterval(checkAndRecoverRecognition, 5000)
      return () => clearInterval(recoveryInterval)
    }
  }, [isActive, isTextMode, checkAndRecoverRecognition])

  const testAPIConnections = async () => {
    addDebugInfo("Testing API connections...")
    try {
      const response = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "all", geminiModel: selectedGeminiModel }), // Pass the selected Gemini model
      })
      const data = await response.json()
      console.log("API Test Results:", data)
      if (data) {
        alert(
          `API Status:\n• Gemini: ${data.api_keys.gemini ? "✅" : "❌"}\n• OpenAI: ${data.api_keys.openai ? "✅" : "❌"}\n• ElevenLabs: ${data.api_keys.elevenlabs ? "✅ (Issues detected)" : "❌"}\n• Grok: ${data.api_keys.xai ? "✅" : "❌"}\n• Search: ${data.api_keys.search ? "✅" : "❌"}\n\nNote: Using enhanced browser TTS due to ElevenLabs restrictions.`,
        )
      }
      return data
    } catch (error) {
      console.error("API test failed:", error)
      alert(`API Test Failed: ${error.message}`)
      return null
    }
  }

  const testSupabaseConnection = async () => {
    addDebugInfo("Testing Supabase connection...")
    try {
      const response = await fetch("/api/supabase-test")
      const data = await response.json()
      if (response.ok) {
        alert(`Supabase Test: ${data.message}`)
        addDebugInfo(`Supabase Test Success: ${data.message}`)
      } else {
        alert(`Supabase Test Failed: ${data.message || data.error}`)
        addDebugInfo(`Supabase Test Failed: ${data.message || data.error}`)
      }
    } catch (error: any) {
      alert(`Supabase Test Error: ${error.message}`)
      addDebugInfo(`Supabase Test Error: ${error.message}`)
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-cyan-400 flex items-center justify-center">
        <div className="text-xl animate-pulse">Loading P.U.P.U. System...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-cyan-400 relative overflow-hidden">
      {/* Grid Background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
        linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
      `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Debug Toggle Button */}
      <Button
        onClick={() => setShowDebug(!showDebug)}
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 border-gray-500 text-gray-400 hover:bg-gray-500/20"
      >
        🐛 Debug
      </Button>

      {/* Debug Panel */}
      {showDebug && (
        <div className="fixed top-16 left-4 w-80 bg-black/90 border border-cyan-500/30 rounded-lg p-3 z-40 text-xs max-h-96 overflow-y-auto">
          <div className="text-cyan-400 font-semibold mb-2 flex justify-between items-center">
            Debug Info
            <Button
              onClick={() => setDebugInfo([])}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            >
              ✕
            </Button>
          </div>
          {debugInfo.map((info, index) => (
            <div key={index} className="text-gray-300 mb-1 font-mono">
              {info}
            </div>
          ))}

          {/* Recognition State Info */}
          <div className="mt-4 p-2 bg-blue-500/10 rounded border border-blue-500/30">
            <div className="text-blue-400 font-semibold mb-1">Recognition State:</div>
            <div className="text-xs text-blue-300">
              • Command: {recognitionState.commandRunning ? "🟢 Running" : "🔴 Stopped"}
              <br />• Wake Word: {recognitionState.wakeWordRunning ? "🟢 Running" : "🔴 Stopped"}
            </div>
          </div>

          {/* AI Provider Settings - Add Gemini Model Selection */}
          <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
            <div className="text-green-400 font-semibold mb-1">AI Provider:</div>
            <select
              value={selectedAIProvider}
              onChange={(e) => setSelectedAIProvider(e.target.value as "gemini" | "openai" | "grok")}
              className="bg-gray-700 text-green-100 border border-green-500/30 rounded text-xs p-1 w-full"
            >
              {availableAIProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-green-300 mt-1">Current: {selectedAIProvider.toUpperCase()}</p>

            {selectedAIProvider === "gemini" && (
              <div className="mt-2">
                <div className="text-green-400 font-semibold mb-1">Gemini Model:</div>
                <select
                  value={selectedGeminiModel}
                  onChange={(e) => setSelectedGeminiModel(e.target.value)}
                  className="bg-gray-700 text-green-100 border border-green-500/30 rounded text-xs p-1 w-full"
                >
                  {availableGeminiModels.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName
                        .replace(/-/g, " ")
                        .replace("exp", "Experimental")
                        .replace("pro", "Pro")
                        .replace("flash", "Flash")
                        .replace("1.5", "1.5")
                        .replace("1.0", "1.0")
                        .trim()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-green-300 mt-1">Selected Gemini Model: {selectedGeminiModel}</p>
              </div>
            )}
          </div>

          {/* API Key Input Section */}
          <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/30">
            <div className="text-red-400 font-semibold mb-1">API Keys (User Specific):</div>
            <p className="text-red-300 text-[10px] mb-2">
              ⚠️ **WARNING:** Keys are stored in your Supabase database. Ensure RLS is configured.
            </p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="OpenAI API Key"
                value={userApiKeys.openai || ""}
                onChange={(e) => setUserApiKeys((prev) => ({ ...prev, openai: e.target.value }))}
                className="bg-gray-700 text-white border-gray-600 text-xs h-8"
              />
              <Input
                type="password"
                placeholder="Gemini API Key"
                value={userApiKeys.gemini || ""}
                onChange={(e) => setUserApiKeys((prev) => ({ ...prev, gemini: e.target.value }))}
                className="bg-gray-700 text-white border-gray-600 text-xs h-8"
              />
              <Input
                type="password"
                placeholder="xAI (Grok) API Key"
                value={userApiKeys.xai || ""}
                onChange={(e) => setUserApiKeys((prev) => ({ ...prev, xai: e.target.value }))}
                className="bg-gray-700 text-white border-gray-600 text-xs h-8"
              />
              <Input
                type="password"
                placeholder="SearchAPI Key"
                value={userApiKeys.search || ""}
                onChange={(e) => setUserApiKeys((prev) => ({ ...prev, search: e.target.value }))}
                className="bg-gray-700 text-white border-gray-600 text-xs h-8"
              />
              <Button onClick={handleSaveApiKeys} size="sm" className="w-full text-xs h-8 bg-red-600 hover:bg-red-700">
                Save Keys to Supabase
              </Button>
            </div>
          </div>

          {/* Supabase Test */}
          <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/30">
            <div className="text-blue-400 font-semibold mb-1">Supabase Integration:</div>
            <Button
              onClick={testSupabaseConnection}
              size="sm"
              className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700"
            >
              Test Supabase Connection
            </Button>
            <p className="text-blue-300 text-[10px] mt-1">
              Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set as env vars.
            </p>
          </div>

          {/* Voice Settings */}
          <div className="mt-2 p-2 bg-purple-500/10 rounded border border-purple-500/30">
            <div className="text-purple-400 font-semibold mb-1">Voice Settings:</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">Rate:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => setVoiceSettings((prev) => ({ ...prev, rate: Number.parseFloat(e.target.value) }))}
                  className="w-16 h-1"
                />
                <span className="text-xs w-8">{voiceSettings.rate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Pitch:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => setVoiceSettings((prev) => ({ ...prev, pitch: Number.parseFloat(e.target.value) }))}
                  className="w-16 h-1"
                />
                <span className="text-xs w-8">{voiceSettings.pitch}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Voice:</span>
                <select
                  value={voiceSettings.selectedVoiceName}
                  onChange={(e) => setVoiceSettings((prev) => ({ ...prev, selectedVoiceName: e.target.value }))}
                  className="bg-gray-700 text-cyan-100 border border-cyan-500/30 rounded text-xs p-1 w-32"
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => speakResponse("This is a test of the enhanced browser text to speech system.")}
                variant="outline"
                size="sm"
                className="border-purple-400 text-purple-400 hover:bg-purple-500/20 text-xs h-6 w-full mt-1"
              >
                🔊 Test Enhanced Voice
              </Button>
            </div>
          </div>

          {/* Wake Word Help */}
          <div className="mt-2 p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
            <div className="text-cyan-400 font-semibold mb-1">Wake Words:</div>
            <div className="text-xs text-cyan-300">
              • "Hello" / "Hi" / "Hey"
              <br />• "Hey PUPU" / "Hello PUPU"
              <br />• "PUPU" / "Papa"
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between">
          {/* Left Side - Branding */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-400 flex items-center justify-center">
              <div className="w-6 h-6 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyan-400">P.U.P.U.</h1>
              <p className="text-sm text-cyan-300">Powerful Universal Personal Utility</p>
              <span className="text-xs text-green-400 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse inline-block"></span>
                {isActive ? "Conversation Mode Active" : "System Offline"}
              </span>
            </div>
          </div>

          {/* Right Side - Controls */}
          <div className="flex items-center space-x-3">
            {user && <span className="text-sm text-cyan-300 mr-2">Logged in as: {user.email}</span>}
            <Button
              onClick={testAPIConnections}
              variant="outline"
              size="sm"
              className="border-green-500 text-green-400 hover:bg-green-500/20 bg-transparent"
            >
              🧠 Test AI
            </Button>

            <Button
              onClick={async () => {
                try {
                  await processCommand("test search functionality")
                } catch (error) {
                  alert("Search system error ❌")
                }
              }}
              variant="outline"
              size="sm"
              className="border-orange-500 text-orange-400 hover:bg-orange-500/20"
            >
              🔍 Test Search
            </Button>

            <Button
              onClick={async () => {
                if (micStatus.hasDevice && micStatus.hasPermission) {
                  addDebugInfo("Quick voice test started")
                  await processCommand("Hello, this is a voice test")
                } else {
                  alert("Microphone not available")
                }
              }}
              variant="outline"
              size="sm"
              className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
            >
              🎤 Quick Test
            </Button>

            <Button
              onClick={togglePower}
              variant="outline"
              size="sm"
              className={`border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 ${isActive ? "bg-cyan-500/20" : ""}`}
            >
              ⚡ {isActive ? "Deactivate" : "Activate"} PUPU
            </Button>

            {micStatus.hasDevice && micStatus.hasPermission && (
              <Button
                onClick={isTextMode ? switchToVoiceMode : switchToTextMode}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-400 hover:bg-purple-500/20 bg-transparent"
              >
                🎤 {isTextMode ? "Voice Mode" : "Text Mode"}
              </Button>
            )}

            <div
              className={`px-3 py-1 rounded border text-sm ${
                systemStatus === "online"
                  ? "border-green-500 text-green-400"
                  : systemStatus === "listening"
                    ? "border-blue-500 text-blue-400"
                    : systemStatus === "speaking"
                      ? "border-purple-500 text-purple-400"
                      : systemStatus === "text-only"
                        ? "border-yellow-500 text-yellow-400"
                        : systemStatus === "error"
                          ? "border-red-500 text-red-400"
                          : "border-gray-500 text-gray-400"
              }`}
            >
              🔘{" "}
              {systemStatus === "text-only"
                ? "Text Mode"
                : systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
            </div>
            {user && (
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-red-500 text-red-400 hover:bg-red-500/20 bg-transparent"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Microphone Status Alert */}
      {!micStatus.hasDevice && (
        <div className="relative z-10 mx-6 mb-4">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-red-400 font-semibold">Microphone Not Available</div>
              <div className="text-red-300 text-sm">{micStatus.error || "No microphone detected"}</div>
            </div>
            <Button
              onClick={async () => {
                const newStatus = await checkMicrophoneAvailability()
                setMicStatus(newStatus)
              }}
              variant="outline"
              size="sm"
              className="border-red-400 text-red-400 hover:bg-red-500/20"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex h-[calc(100vh-200px)]">
        {/* Left Side - Face Interface */}
        <div className="flex-1 flex items-center justify-center">
          <Face isActive={isActive} isListening={isListening} isSpeaking={isSpeaking} systemStatus={systemStatus} />
        </div>

        {/* Right Side - Chat Interface */}
        {isActive && (
          <div className="w-1/2 flex flex-col p-6">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 && (
                <div className="text-center text-cyan-400/60 py-8">
                  <div className="text-lg mb-2">Welcome to PUPU!</div>
                  <div className="text-sm">
                    {isTextMode
                      ? "Type a message below to start chatting"
                      : "Start speaking - I'm listening for your commands!"}
                  </div>
                  <div className="text-xs mt-2 text-cyan-500">
                    🔊 Now using enhanced browser TTS for better voice quality
                    {voicesLoaded ? " (Voices loaded)" : " (Loading voices...)"}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="flex items-start space-x-3 max-w-[80%]">
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 bg-cyan-400 rounded-full" />
                      </div>
                    )}
                    <div
                      className={`p-4 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
                          : "bg-cyan-600/20 border border-cyan-500/30 text-cyan-100"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="text-xs text-cyan-400 mb-1 font-semibold">PUPU</div>
                      )}
                      {message.role === "user" && (
                        <div className="text-xs text-blue-400 mb-1 font-semibold text-right">You</div>
                      )}
                      <div className="text-sm">{message.content}</div>
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                        <div className="text-xs">👤</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                      <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse" />
                    </div>
                    <div className="bg-cyan-600/20 border border-cyan-500/30 text-cyan-100 p-4 rounded-lg">
                      <div className="text-xs text-cyan-400 mb-1 font-semibold">PUPU</div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Status Text */}
            <div className="text-center mb-4">
              <p className="text-cyan-300 text-sm">
                {!isTextMode && micStatus.hasDevice
                  ? "Direct Command Mode: Just start speaking!"
                  : "Text Mode: Type your messages below"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="relative z-10 fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-cyan-500/30 p-6">
        <div className="max-w-4xl mx-auto">
          {isActive ? (
            <form onSubmit={handleTextSubmit} className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Try: 'Hello PUPU' or 'What's the weather today?'"
                  className="bg-gray-800/50 border-cyan-500/30 text-cyan-100 placeholder-cyan-400/50 pr-12 h-12"
                  disabled={isTyping}
                />
                <Button
                  type="submit"
                  disabled={!textInput.trim() || isTyping}
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 text-gray-900"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {!isTextMode && (
                <Button
                  onClick={toggleVoiceListening}
                  disabled={!micStatus.hasDevice || !micStatus.hasPermission}
                  variant="outline"
                  className={`border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 h-12 bg-transparent ${isListening ? "bg-cyan-500/20" : ""}`}
                >
                  <Mic className="w-5 h-5" />
                </Button>
              )}

              <Button
                onClick={() => synthRef.current?.cancel()}
                disabled={!isSpeaking}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/20 h-12"
              >
                <VolumeX className="w-5 h-5" />
              </Button>

              <Button
                onClick={() => {
                  setMessages([])
                  addDebugInfo("Chat cleared")
                }}
                variant="outline"
                className="border-gray-500 text-gray-400 hover:bg-gray-500/20 h-12"
              >
                Clear
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center space-x-4 text-cyan-400/60">
              <Mic className="w-6 h-6" />
              <span className="text-lg">System offline - Click 'Activate PUPU' to start listening</span>
              <Mic className="w-6 h-6" />
            </div>
          )}
        </div>
      </div>

      {/* Voice Visualizer */}
      <VoiceVisualizer isListening={isListening} isWakeWordListening={isWakeWordListening} />

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-800">
        <div className="flex h-full">
          <div className={`flex-1 ${systemStatus === "online" ? "bg-green-500" : "bg-gray-600"}`} />
          <div className={`flex-1 ${isWakeWordListening ? "bg-purple-500" : "bg-gray-600"}`} />
          <div className={`flex-1 ${isListening ? "bg-blue-500" : "bg-gray-600"}`} />
          <div className={`flex-1 ${isSpeaking ? "bg-cyan-500" : "bg-gray-600"}`} />
        </div>
      </div>
    </div>
  )
}
