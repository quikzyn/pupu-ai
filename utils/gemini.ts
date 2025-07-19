import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { xai, openai } from "@ai-sdk/xai"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ApiKeys {
  openai?: string
  gemini?: string // This will now hold the GOOGLE_GENERATIVE_AI_API_KEY
  xai?: string
}

// --- Specific AI Provider Functions ---

async function generateGeminiResponse(
  messages: Message[],
  currentQuery: string,
  searchResults?: string,
  apiKey?: string,
  modelName?: string,
): Promise<string> {
  // Use the passed apiKey (from Supabase or env) or fall back to the specific Google env var
  const finalApiKey = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!finalApiKey) {
    throw new Error("Google Generative AI API key not found.")
  }

  try {
    const conversationContext = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Human" : "PUPU"}: ${m.content}`)
      .join("\n")

    const systemPrompt = `You are PUPU, a helpful AI assistant with a friendly, conversational personality. 
Key traits:
- Respond in 1-3 sentences maximum for most queries
- Be conversational and warm like JARVIS
- Use current information when provided
- Stay focused and helpful
- Address the user directly

Current conversation context:
${conversationContext}

${searchResults ? `Current web information: ${searchResults}` : ""}

Respond to: ${currentQuery}`

    // Prioritize user's selected model, then free-tier friendly models, then others
    const modelsToTry = [
      modelName, // user-selected (if any)
      "gemini-pro", // ✅ Free-tier friendly
      "gemini-pro-vision", // ✅ Free-tier, supports images
      "gemini-1.5-flash", // ✅ If billing enabled
      "gemini-1.5-pro", // ✅ If billing enabled
    ].filter(Boolean) // Filter out any null/undefined models

    for (const model of modelsToTry) {
      try {
        console.log(`GEMINI UTIL: Attempting generateText call with model: ${model}`) // New log
        const { text } = await generateText({
          model: google(model as string, { apiKey: finalApiKey }), // Cast model to string
          prompt: systemPrompt,
          maxTokens: 150,
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        })
        console.log("GEMINI UTIL: generateText call successful.") // New log
        return text.trim()
      } catch (modelError: any) {
        console.error("GEMINI UTIL: Error during generateText call:", modelError) // More specific log
        console.warn(`GEMINI UTIL: Gemini model ${model} failed. Error: ${modelError.message || String(modelError)}`)
        // Continue to the next model in the loop
      }
    }
    // If all models fail
    throw new Error("All configured Gemini models failed to generate a response.")
  } catch (error: any) {
    console.error("GEMINI UTIL: Gemini API error (outer catch):", error) // More specific log
    throw new Error(
      `Gemini API error: ${error.message || String(error)}. Please ensure your API key is valid and you have access to the selected Gemini model.`,
    )
  }
}

async function generateOpenAIResponse(
  messages: Message[],
  currentQuery: string,
  searchResults?: string,
  apiKey?: string,
): Promise<string> {
  const finalApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!finalApiKey) {
    throw new Error("OpenAI API key not found.")
  }

  try {
    const systemMessage = `You are Pupu, a helpful AI assistant. Respond in 1-3 sentences maximum. Be friendly and concise. ${searchResults ? `Use this current information: ${searchResults}` : ""}`

    const { text } = await generateText({
      model: openai("gpt-4o", { apiKey: finalApiKey }),
      prompt: currentQuery,
      system: systemMessage,
      messages: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 150,
      temperature: 0.7,
    })

    return text.trim()
  } catch (error: any) {
    console.error("OpenAI API error:", error)
    throw new Error(`OpenAI API error: ${error.message}`)
  }
}

async function generateGrokResponse(
  messages: Message[],
  currentQuery: string,
  searchResults?: string,
  apiKey?: string,
): Promise<string> {
  const finalApiKey = apiKey || process.env.XAI_API_KEY
  if (!finalApiKey) {
    throw new Error("xAI (Grok) API key not found.")
  }

  try {
    const systemMessage = `You are Pupu, a helpful AI assistant with a witty and slightly sarcastic personality, like JARVIS. Respond concisely, in 1-3 sentences. ${searchResults ? `Use this current information: ${searchResults}` : ""}`

    const { text } = await generateText({
      model: xai("grok-1", { apiKey: finalApiKey }),
      prompt: currentQuery,
      system: systemMessage,
      messages: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 150,
      temperature: 0.7,
    })

    return text.trim()
  } catch (error: any) {
    console.error("Grok API error:", error)
    throw new Error(`Grok API error: ${error.message}`)
  }
}

// --- Central AI Response Dispatcher ---

export async function generateAIResponse(
  messages: Message[],
  currentQuery: string,
  searchResults: string,
  aiProvider: "gemini" | "openai" | "grok",
  apiKeys: ApiKeys,
  geminiModel?: string,
): Promise<string> {
  try {
    console.log("AI Response Dispatcher: Attempting to generate response for provider:", aiProvider) // New log
    switch (aiProvider) {
      case "gemini":
        return await generateGeminiResponse(messages, currentQuery, searchResults, apiKeys.gemini, geminiModel)
      case "openai":
        return await generateOpenAIResponse(messages, currentQuery, searchResults, apiKeys.openai)
      case "grok":
        return await generateGrokResponse(messages, currentQuery, searchResults, apiKeys.xai)
      default:
        throw new Error(`Unsupported AI provider: ${aiProvider}`)
    }
  } catch (error: any) {
    console.error(`AI Response Dispatcher: Error with AI provider ${aiProvider}:`, error) // More specific log
    // Throw the error so it's caught by the main API route's try/catch
    throw new Error(`AI service error for ${aiProvider}: ${error.message || String(error)}`)
  }
}
