const ADJECTIVES = [
  "Swift",
  "Brave",
  "Silent",
  "Clever",
  "Mighty",
  "Wise",
  "Bold",
  "Quick",
  "Sharp",
  "Steady",
  "Fierce",
  "Noble",
  "Calm",
  "Bright",
  "Dark",
  "Wild",
  "Gentle",
  "Strong",
  "Proud",
  "Sly",
  "Keen",
  "Alert",
  "Daring",
  "Loyal",
]

const NOUNS = [
  "Fox",
  "Wolf",
  "Bear",
  "Eagle",
  "Lion",
  "Tiger",
  "Hawk",
  "Raven",
  "Dragon",
  "Phoenix",
  "Panther",
  "Falcon",
  "Stag",
  "Lynx",
  "Cobra",
  "Viper",
  "Badger",
  "Otter",
  "Shark",
  "Owl",
  "Jaguar",
  "Leopard",
  "Puma",
  "Sphinx",
]

// Filter out potentially offensive combinations
const BLOCKED_COMBINATIONS = new Set([
  // Add any specific blocked combinations here if needed
])

export function generateAnonymousUsername(): string {
  let username: string
  let attempts = 0
  const maxAttempts = 100

  do {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    username = `${adjective}-${noun}`
    attempts++
  } while (BLOCKED_COMBINATIONS.has(username.toLowerCase()) && attempts < maxAttempts)

  return username
}

export const generateUsername = generateAnonymousUsername
