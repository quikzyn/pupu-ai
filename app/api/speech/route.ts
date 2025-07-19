import { type NextRequest, NextResponse } from "next/server"
import { cleanTextForSpeech } from "@/utils/textClean"

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "browser" } = await req.json()

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 })
    }

    const cleanedText = cleanTextForSpeech(text)
    console.log("TTS Request:", { originalText: text, cleanedText, voice })

    // If specifically requesting ElevenLabs and API key is available
    if (voice === "elevenlabs" && process.env.ELEVENLABS_API_KEY) {
      try {
        console.log("Attempting ElevenLabs TTS...")

        const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: cleanedText,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        })

        console.log("ElevenLabs response status:", response.status)

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()
          console.log("ElevenLabs audio generated successfully, size:", audioBuffer.byteLength)

          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": audioBuffer.byteLength.toString(),
            },
          })
        } else {
          const errorText = await response.text()
          console.error("ElevenLabs API error:", response.status, errorText)

          // Return error details for specific handling
          return NextResponse.json(
            {
              error: "elevenlabs_failed",
              status: response.status,
              details: errorText,
              text: cleanedText,
              fallback: true,
              message: "ElevenLabs failed, use browser TTS",
            },
            { status: 200 },
          ) // Return 200 so client can handle fallback
        }
      } catch (error: any) {
        console.error("ElevenLabs TTS failed:", error.message)
        return NextResponse.json(
          {
            error: "elevenlabs_error",
            details: error.message,
            text: cleanedText,
            fallback: true,
            message: "ElevenLabs error, use browser TTS",
          },
          { status: 200 },
        )
      }
    }

    // Default: return cleaned text for browser TTS
    console.log("Using browser TTS")
    return NextResponse.json({
      text: cleanedText,
      voice: "browser",
      fallback: false,
      message: "Using high-quality browser TTS",
    })
  } catch (error: any) {
    console.error("Speech API error:", error)
    return NextResponse.json({ error: "Failed to generate speech", details: error.message }, { status: 500 })
  }
}
