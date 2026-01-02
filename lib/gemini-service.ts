import { generateText } from "ai"

export async function getGameCommentary(
  context: string,
  activePlayerName: string,
  targetPlayerName?: string,
  result?: string,
): Promise<string | null> {
  try {
    const prompt = `You are a mystical, ominous narrator for a dark card game called "Hide and Seek Cards". 
Your tone is cryptic, dramatic, and foreboding - like a tarot reader or oracle.

Context: ${context}
Active Player: ${activePlayerName}
Target Player: ${targetPlayerName || "Unknown"}
Result: ${result || "Unknown"}

Generate a single SHORT sentence (max 15 words) of cryptic commentary about what just happened. 
Be dramatic but concise. Use metaphors of darkness, fate, shadows, and destiny.

Examples:
- "The cards whisper truths that mortals fear to know."
- "Fate's hand reveals the hunter... or the hunted."
- "In darkness, even the seeker becomes the sought."

Your response:`

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      maxTokens: 50,
      temperature: 0.9,
    })

    return text.trim()
  } catch (error) {
    console.error("[v0] Gemini commentary error:", error)
    return null
  }
}
