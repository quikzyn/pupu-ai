export function cleanTextForSpeech(text: string): string {
  return (
    text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
      .replace(/\*(.*?)\*/g, "$1") // Italic
      .replace(/`(.*?)`/g, "$1") // Code
      .replace(/#{1,6}\s/g, "") // Headers
      .replace(/\[(.*?)\]$$.*?$$/g, "$1") // Links - keep text, remove URL

      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/www\.[^\s]+/g, "")

      // Clean up special characters
      .replace(/[_~`]/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")

      // Remove common web artifacts
      .replace(/\|/g, ",")
      .replace(/&[a-zA-Z]+;/g, "") // HTML entities

      .trim()
  )
}
