/**
 * Lightweight, self-contained profanity filter.
 * Censors offensive words by replacing them with asterisks.
 *
 * No external dependency — works offline. The list covers common English
 * profanity and slurs. Extend BAD_WORDS as needed.
 *
 * Usage:
 *   const { cleanText, containsProfanity } = require("./profanityFilter");
 *   const safe = cleanText("you are an idiot");  // "you are an *****"
 */

// Base list of offensive words (kept lowercase). Extend as needed.
const BAD_WORDS = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bastard",
  "asshole",
  "ass",
  "dick",
  "dickhead",
  "pussy",
  "cunt",
  "slut",
  "whore",
  "cock",
  "prick",
  "wanker",
  "douche",
  "douchebag",
  "jerk",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "spastic",
  "twat",
  "bollocks",
  "bugger",
  "crap",
  "damn",
  "goddamn",
  "piss",
  "pissed",
  "cum",
  "jizz",
  "boobs",
  "tits",
  "titties",
  "horny",
  "rape",
  "rapist",
  "molest",
  "pedo",
  "pedophile",
  "porn",
  "porno",
  "sex",
  "scam",
  "scammer",
  "fraud",
  "fraudster",
  // Hindi/romanized common abuses
  "chutiya",
  "chutiye",
  "bhenchod",
  "behenchod",
  "madarchod",
  "madarchid",
  "bhosdike",
  "bhosdi",
  "gaand",
  "gandu",
  "lund",
  "lauda",
  "randi",
  "harami",
  "kamina",
  "kutta",
  "kutti",
  "saala",
  "kanjar",
];

// Build a single regex that matches any bad word as a whole word,
// tolerant of simple separators (e.g. "f u c k", "f*ck", "f.u.c.k").
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Exact whole-word matcher (case-insensitive)
const wordBoundaryRegex = new RegExp(
  `\\b(${BAD_WORDS.map(escapeRegex).join("|")})\\b`,
  "gi",
);

// Leet/separator-tolerant matcher for obfuscated spellings (e.g. f*ck, s.h.i.t)
const buildLooseRegex = (word) => {
  // allow up to 2 non-word chars between each letter
  const pattern = word.split("").map(escapeRegex).join("[^a-zA-Z0-9]{0,2}");
  return new RegExp(`\\b${pattern}\\b`, "gi");
};

const looseRegexes = BAD_WORDS.filter((w) => w.length >= 4).map(
  buildLooseRegex,
);

const censorWord = (match) =>
  "*".repeat(Math.max(3, match.replace(/[^a-zA-Z0-9]/g, "").length));

/**
 * Replace profanity in a string with asterisks.
 * Returns the cleaned string (original is never mutated).
 * Optional `extraWords` adds admin-configured banned words at runtime.
 */
const cleanText = (text, extraWords = []) => {
  if (!text || typeof text !== "string") return text;
  let cleaned = text.replace(wordBoundaryRegex, censorWord);
  // Catch obfuscated spellings too
  for (const rx of looseRegexes) {
    cleaned = cleaned.replace(rx, censorWord);
  }
  // Admin-configured extra words
  if (extraWords && extraWords.length) {
    for (const w of extraWords) {
      if (!w) continue;
      const rx = new RegExp(`\\b${escapeRegex(w)}\\b`, "gi");
      cleaned = cleaned.replace(rx, censorWord);
    }
  }
  return cleaned;
};

/**
 * Returns true if the text contains any profanity.
 */
const containsProfanity = (text) => {
  if (!text || typeof text !== "string") return false;
  if (wordBoundaryRegex.test(text)) {
    wordBoundaryRegex.lastIndex = 0; // reset stateful regex
    return true;
  }
  return looseRegexes.some((rx) => {
    const hit = rx.test(text);
    rx.lastIndex = 0;
    return hit;
  });
};

/**
 * Returns an array of the bad words found in the text (deduplicated, lowercase).
 * Optional `extraWords` adds admin-configured banned words.
 */
const findProfanity = (text, extraWords = []) => {
  if (!text || typeof text !== "string") return [];
  const found = new Set();
  let m;
  wordBoundaryRegex.lastIndex = 0;
  while ((m = wordBoundaryRegex.exec(text)) !== null) {
    found.add(m[1].toLowerCase());
  }
  if (extraWords && extraWords.length) {
    for (const w of extraWords) {
      if (!w) continue;
      const rx = new RegExp(`\\b${escapeRegex(w)}\\b`, "gi");
      if (rx.test(text)) found.add(w.toLowerCase());
    }
  }
  return [...found];
};

module.exports = { cleanText, containsProfanity, findProfanity, BAD_WORDS };
