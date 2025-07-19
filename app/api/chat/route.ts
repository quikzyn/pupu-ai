import { type NextRequest, NextResponse } from "next/server"
import { generateAIResponse } from "@/utils/gemini"
import { searchWeb } from "@/utils/search"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  console.log("CHAT API: Request received.") // New log
  try {
    console.log("CHAT API: Entering try block.") // New log
    const { messages, query, aiProvider, geminiModel } = await req.json()
    console.log("CHAT API: Request body parsed.") // New log

    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("CHAT API: Authentication error:", userError?.message)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    console.log("CHAT API: Authenticated user:", user.email)

    // Fetch user's API keys from Supabase
    const { data: userApiKeysData, error: fetchKeysError } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single()

    // If fetching fails because the table doesn’t exist yet (error code 42P01),
    // log a warning and continue with env vars only.
    if (fetchKeysError) {
      if (fetchKeysError.code === "42P01") {
        console.warn("CHAT API: Supabase table public.user_api_keys not found – using env-var API keys only.")
      } else if (fetchKeysError.code !== "PGRST116") {
        // PGRST116 = no rows
        console.error("CHAT API: Error fetching user API keys:", fetchKeysError.message)
        return NextResponse.json({ error: "Failed to retrieve user API keys" }, { status: 500 })
      }
    }

    const apiKeysToUse = {
      openai: userApiKeysData?.openai_key || process.env.OPENAI_API_KEY,
      gemini: userApiKeysData?.gemini_key || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      xai: userApiKeysData?.xai_key || process.env.XAI_API_KEY,
      search: userApiKeysData?.search_key || process.env.SEARCHAPI_API_KEY,
    }

    console.log("CHAT API: API Keys being used (from DB/Env):", {
      gemini: !!apiKeysToUse.gemini,
      openai: !!apiKeysToUse.openai,
      xai: !!apiKeysToUse.xai,
      search: !!apiKeysToUse.search,
    })

    // Determine if we need web search
    const needsSearch =
      query.toLowerCase().includes("current") ||
      query.toLowerCase().includes("latest") ||
      query.toLowerCase().includes("news") ||
      query.toLowerCase().includes("weather") ||
      query.toLowerCase().includes("today") ||
      query.toLowerCase().includes("what is") ||
      query.toLowerCase().includes("who is") ||
      query.toLowerCase().includes("crash") ||
      query.toLowerCase().includes("recent")

    let searchResults = ""

    if (needsSearch) {
      try {
        console.log("CHAT API: Initiating web search...") // New log
        searchResults = await searchWeb(query, apiKeysToUse.search)
        console.log("CHAT API: Search results:", searchResults)
      } catch (error) {
        console.error("CHAT API: Search failed:", error)
        searchResults = "Search temporarily unavailable."
      }
    }

    // Generate AI response using the central dispatcher
    let aiResponseText: string
    try {
      console.log("CHAT API: Calling generateAIResponse with:", {
        messages: messages.length,
        query,
        searchResults: searchResults.length > 0 ? "present" : "absent",
        aiProvider,
        apiKeys: {
          gemini: !!apiKeysToUse.gemini,
          openai: !!apiKeysToUse.openai,
          xai: !!apiKeysToUse.xai,
        },
        geminiModel,
      })
      aiResponseText = await generateAIResponse(
        messages,
        query,
        searchResults,
        aiProvider,
        {
          openai: apiKeysToUse.openai,
          gemini: apiKeysToUse.gemini,
          xai: apiKeysToUse.xai,
        },
        geminiModel,
      )
      console.log("CHAT API: AI response generated successfully.")
    } catch (aiError: any) {
      console.error("CHAT API: Error from generateAIResponse:", aiError)
      // Re-throw to be caught by the main handler's catch block
      throw new Error(`AI generation failed: ${aiError.message || String(aiError)}`)
    }
    console.log("CHAT API: AI response:", aiResponseText)

    console.log("CHAT API: Preparing final JSON response.") // New log
    return NextResponse.json({
      response: aiResponseText,
      searchUsed: needsSearch,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("CHAT API: Raw error object caught in main handler:", error) // New log
    let errorMessage: string
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "object" && error !== null && "message" in error) {
      errorMessage = String(error.message) // Try to get message property if it's an object
    } else {
      errorMessage = String(error) // Fallback to string conversion
    }
    console.error("CHAT API: Formatted error message for response:", errorMessage) // New log

    console.error("CHAT API: Returning error JSON response.") // New log
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: errorMessage,
        response: "I'm having trouble processing your request. Please check the API configuration and try again.",
      },
      { status: 500 },
    )
  }
}
