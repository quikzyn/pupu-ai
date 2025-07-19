export async function checkMicrophoneAvailability(): Promise<{
  hasPermission: boolean
  hasDevice: boolean
  error?: string
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop()) // Stop the stream immediately

    return {
      hasPermission: true,
      hasDevice: true,
    }
  } catch (error: any) {
    console.error("Microphone check error:", error)

    let hasPermission = false
    let hasDevice = false
    let errorMessage = error.message

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      hasPermission = false
      hasDevice = true // Assume device exists, just permission denied
      errorMessage = "Microphone permission denied."
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      hasPermission = false
      hasDevice = false
      errorMessage = "No microphone device found."
    } else {
      hasPermission = false
      hasDevice = false
      errorMessage = `Microphone error: ${error.message}`
    }

    return {
      hasPermission,
      hasDevice,
      error: errorMessage,
    }
  }
}
