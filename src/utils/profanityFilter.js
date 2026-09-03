                                                                                                                                                                                                                                                                                                                                                                                                                                 

                                                                   
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

                                                                  
                                                                     
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                                              
const wordBoundaryRegex = new RegExp(
  `\\b(${BAD_WORDS.map(escapeRegex).join("|")})\\b`,
  "gi",
);

                                                                                
const buildLooseRegex = (word) => {
                                                     
  const pattern = word.split("").map(escapeRegex).join("[^a-zA-Z0-9]{0,2}");
  return new RegExp(`\\b${pattern}\\b`, "gi");
};

const looseRegexes = BAD_WORDS.filter((w) => w.length >= 4).map(
  buildLooseRegex,
);

const censorWord = (match) =>
  "*".repeat(Math.max(3, match.replace(/[^a-zA-Z0-9]/g, "").length));

                                                                                                                                                                                               
const cleanText = (text, extraWords = []) => {
  if (!text || typeof text !== "string") return text;
  let cleaned = text.replace(wordBoundaryRegex, censorWord);
                                   
  for (const rx of looseRegexes) {
    cleaned = cleaned.replace(rx, censorWord);
  }
                                 
  if (extraWords && extraWords.length) {
    for (const w of extraWords) {
      if (!w) continue;
      const rx = new RegExp(`\\b${escapeRegex(w)}\\b`, "gi");
      cleaned = cleaned.replace(rx, censorWord);
    }
  }
  return cleaned;
};

                                                             
const containsProfanity = (text) => {
  if (!text || typeof text !== "string") return false;
  if (wordBoundaryRegex.test(text)) {
    wordBoundaryRegex.lastIndex = 0;                        
    return true;
  }
  return looseRegexes.some((rx) => {
    const hit = rx.test(text);
    rx.lastIndex = 0;
    return hit;
  });
};

                                                                                                                                                         
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
