export async function searchWeb(query: string, apiKey?: string): Promise<string> {
  const finalApiKey = apiKey || process.env.SEARCHAPI_API_KEY
  if (!finalApiKey) {
    return "Web search is currently unavailable."
  }

  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
      query,
    )}&num=3&api_key=${finalApiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.organic_results || data.organic_results.length === 0) {
      return "No current information found for this query."
    }

    const results = data.organic_results
      .slice(0, 3)
      .map((r: any) => `${r.title}: ${r.snippet}`)
      .join(" | ")

    return results
  } catch (error) {
    console.error("Search error:", error)
    return "Web search temporarily unavailable."
  }
}
