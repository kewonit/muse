const BLOCKED_TERMS = [
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "damn",
  "dick",
  "fag",
  "fuck",
  "nigger",
  "nigga",
  "piss",
  "prick",
  "pussy",
  "shit",
  "slut",
  "twat",
  "whore",
];

export function sanitizeDisplayName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 _.-]+/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

export function validateDisplayName(value: string): string | null {
  const name = sanitizeDisplayName(value);
  if (name.length < 2) return "Name must be at least 2 characters.";
  if (containsProfanity(name)) return "Pick a clean display name.";
  return null;
}

export function isGeneratedDisplayName(value?: string): boolean {
  return /^Player [a-zA-Z0-9]{4}$/.test(value || "");
}

function containsProfanity(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[013457@$!]/g, (char) => ({
      "0": "o",
      "1": "i",
      "3": "e",
      "4": "a",
      "5": "s",
      "7": "t",
      "@": "a",
      "$": "s",
      "!": "i",
    })[char] || char)
    .replace(/[^a-z]/g, "");

  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}
