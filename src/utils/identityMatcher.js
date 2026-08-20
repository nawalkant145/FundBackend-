const digilockerConfig = require("../config/digilocker.config");

// Normalizes a name for comparison: uppercase, collapse whitespace, strip punctuation.
const normalizeName = (name = "") =>
  name
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[.,'’-]/g, "")
    .replace(/\s+/g, " ");

// Normalizes a date of birth to YYYY-MM-DD regardless of incoming format.
const normalizeDob = (dob) => {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return String(dob).trim();
  return d.toISOString().slice(0, 10);
};

// Jaro similarity — foundation for Jaro-Winkler.
const jaro = (a, b) => {
  if (a === b) return 1;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;

  const matchDistance = Math.floor(Math.max(aLen, bLen) / 2) - 1;
  const aMatches = new Array(aLen).fill(false);
  const bMatches = new Array(bLen).fill(false);

  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  return (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3;
};

// Jaro-Winkler adds a prefix bonus for strings that match at the start.
const jaroWinkler = (a, b, prefixScale = 0.1) => {
  const jaroScore = jaro(a, b);
  let prefixLen = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, a.length, b.length); i++) {
    if (a[i] === b[i]) prefixLen++;
    else break;
  }
  return jaroScore + prefixLen * prefixScale * (1 - jaroScore);
};

/**
 * Compares account-on-file identity data against DigiLocker-retrieved data.
 * Returns a score (0-100), a pass/fail verdict, and per-field detail for the
 * admin review UI when the match falls below threshold.
 */
const matchIdentity = ({ accountName, accountDob, digilockerName, digilockerDob }) => {
  const normAccountName = normalizeName(accountName);
  const normDigilockerName = normalizeName(digilockerName);

  const nameScore = Math.round(jaroWinkler(normAccountName, normDigilockerName) * 100);
  const dobMatch = normalizeDob(accountDob) === normalizeDob(digilockerDob) && Boolean(accountDob) && Boolean(digilockerDob);

  const passed = nameScore >= digilockerConfig.matchThreshold && dobMatch;

  return {
    nameScore,
    dobMatch,
    passed,
    detail: {
      accountName: normAccountName,
      digilockerName: normDigilockerName,
      accountDob: normalizeDob(accountDob),
      digilockerDob: normalizeDob(digilockerDob),
    },
  };
};

module.exports = { normalizeName, normalizeDob, jaroWinkler, matchIdentity };