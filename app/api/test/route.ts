import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { xai } from "@ai-sdk/xai"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"
import { google } from "@ai-sdk/google"

export async function GET(req: NextRequest) {
  const tests = {
    environment: {
      node_version: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
    api_keys: {
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      search: !!process.env.SEARCHAPI_API_KEY,
      xai: !!process.env.XAI_API_KEY,
    },
    services: {
      speech_recognition: "Web Speech API (browser)",
      text_to_speech: process.env.ELEVENLABS_API_KEY ? "ElevenLabs + Browser fallback" : "Browser only",
      ai_model: process.env.GEMINI_API_KEY
        ? "Gemini Pro (primary)"
        : process.env.OPENAI_API_KEY
          ? "OpenAI (fallback)"
          : process.env.XAI_API_KEY
            ? "Grok (fallback)"
            : "None configured",
      search: process.env.SEARCHAPI_API_KEY ? "SearchAPI" : "Disabled",
    },
  }

  return NextResponse.json(tests)
}

export async function POST(req: NextRequest) {
  try {
    const { service, geminiModel } = await req.json()

    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("Authentication error in test API:", userError?.message)
      return NextResponse.json({ error: "Authentication required for API tests" }, { status: 401 })
    }

    // Fetch user's API keys from Supabase
    const { data: userApiKeysData, error: fetchKeysError } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (fetchKeysError) {
      if (fetchKeysError.code === "42P01") {
        console.warn("Supabase table public.user_api_keys not found – tests will use env-var API keys only.")
      } else if (fetchKeysError.code !== "PGRST116") {
        console.error("Error fetching user API keys for test:", fetchKeysError.message)
        return NextResponse.json({ error: "Failed to retrieve user API keys for testing" }, { status: 500 })
      }
    }

    // Prioritize user-provided keys, then environment variables
    const getApiKey = (keyName: string) => {
      if (keyName === "gemini") {
        return userApiKeysData?.gemini_key || process.env.GOOGLE_GENERATIVE_AI_API_KEY // Specific for Gemini
      }
      return userApiKeysData?.[keyName + "_key"] || process.env[keyName.toUpperCase() + "_API_KEY"]
    }

    switch (service) {
      case "gemini":
        const geminiApiKey = getApiKey("gemini")
        if (!geminiApiKey) {
          return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 })
        }
        try {
          const modelToTest = geminiModel || "gemini-pro" // Changed default model for test
          const { text } = await generateText({
            model: google(modelToTest, { apiKey: geminiApiKey }),
            prompt: `Say "Pupu Gemini test successful with ${modelToTest}" in a friendly way.`,
          })
          return NextResponse.json({
            service: "gemini",
            status: "success",
            response: text,
          })
        } catch (error: any) {
          return NextResponse.json({ error: "Gemini test failed", details: error.message }, { status: 500 })
        }

      case "openai":
        const openaiApiKey = getApiKey("openai")
        if (!openaiApiKey) {
          return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 400 })
        }
        try {
          const { text } = await generateText({
            model: openai("gpt-3.5-turbo", { apiKey: openaiApiKey }),
            prompt: 'Say "Pupu OpenAI test successful" in a friendly way.',
          })
          return NextResponse.json({
            service: "openai",
            status: "success",
            response: text,
          })
        } catch (error: any) {
          return NextResponse.json({ error: "OpenAI test failed", details: error.message }, { status: 500 })
        }

      case "grok":
        const xaiApiKey = getApiKey("xai")
        if (!xaiApiKey) {
          return NextResponse.json({ error: "xAI (Grok) API key not configured" }, { status: 400 })
        }
        try {
          const { text } = await generateText({
            model: xai("grok-1", { apiKey: xaiApiKey }),
            prompt: 'Say "Pupu Grok test successful" in a friendly way.',
          })
          return NextResponse.json({
            service: "grok",
            status: "success",
            response: text,
          })
        } catch (error: any) {
          return NextResponse.json({ error: "Grok test failed", details: error.message }, { status: 500 })
        }

      case "search":
        const searchApiKey = getApiKey("search")
        if (!searchApiKey) {
          return NextResponse.json({ error: "Search API key not configured" }, { status: 400 })
        }

        const testUrl = `https://www.searchapi.io/api/v1/search?engine=google&q=test&api_key=${searchApiKey}`
        const searchResponse = await fetch(testUrl)

        if (!searchResponse.ok) {
          throw new Error(`Search API error: ${searchResponse.status}`)
        }

        return NextResponse.json({
          service: "search",
          status: "success",
          message: "Search API connection successful",
        })

      case "all": // Handle the "Test AI" button from the main page
        const results: { [key: string]: boolean } = {
          openai: false,
          gemini: false,
          xai: false,
          search: false,
          elevenlabs: !!process.env.ELEVENLABS_API_KEY, // ElevenLabs is not tested via POST
        }

        // Test OpenAI
        try {
          const key = getApiKey("openai")
          if (key) {
            await generateText({ model: openai("gpt-3.5-turbo", { apiKey: key }), prompt: "test" })
            results.openai = true
          }
        } catch (e) {
          console.error("OpenAI test failed:", e)
        }

        // Test Gemini
        try {
          const key = getApiKey("gemini")
          if (key) {
            const modelToTest = geminiModel || "gemini-pro" // Changed default model for test
            await generateText({ model: google(modelToTest, { apiKey: key }), prompt: "test" })
            results.gemini = true
          }
        } catch (e) {
          console.error("Gemini test failed:", e)
        }

        // Test Grok
        try {
          const key = getApiKey("xai")
          if (key) {
            await generateText({ model: xai("grok-1", { apiKey: key }), prompt: "test" })
            results.xai = true
          }
        } catch (e) {
          console.error("Grok test failed:", e)
        }

        // Test Search
        try {
          const key = getApiKey("search")
          if (key) {
            const searchTestUrl = `https://www.searchapi.io/api/v1/search?engine=google&q=test&api_key=${key}`
            const resp = await fetch(searchTestUrl)
            results.search = resp.ok
          }
        } catch (e) {
          console.error("Search test failed:", e)
        }

        return NextResponse.json({ api_keys: results })

      default:
        return NextResponse.json({ error: "Unknown service" }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Test failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
