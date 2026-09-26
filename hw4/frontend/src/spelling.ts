// Typo-tolerant search: when a search word matches nothing in the catalogue, find the
// catalogue word the customer most likely meant ("hudy" -> hoodie, "swetshirt" -> sweatshirt).
//
// Two checks, either is enough:
// 1. Spelling distance: at most 1-3 letters added, removed, changed, or swapped
//    (more allowed for longer words), e.g. "tshrit" -> tshirt, "crewnek" -> crewneck.
// 2. Sounds-alike: same first letter and the same consonants in order, e.g. "hudy" and
//    "hoodie" both reduce to "hd", "sweter" and "sweater" to "swtr".

/** Damerau-Levenshtein distance (optimal string alignment): edits incl. swapping two letters. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** First letter plus the remaining consonants, with sound-alike letters merged and repeats collapsed. */
export function skeleton(word: string): string {
  const w = word.toLowerCase().replace(/ph/g, 'f').replace(/ck|c|q/g, 'k').replace(/z/g, 's')
  const rest = w.slice(1).replace(/[aeiouyhw]/g, '')
  return (w[0] + rest).replace(/(.)\1+/g, '$1')
}

const maxEdits = (length: number) => (length <= 5 ? 1 : length <= 8 ? 2 : 3)

/**
 * The vocabulary word closest to `word`, or null if nothing is close enough.
 * `vocabulary` maps each catalogue word to how many products use it (used to break ties).
 */
export function closestWord(word: string, vocabulary: Map<string, number>): string | null {
  if (word.length < 3 || /\d/.test(word)) return null
  const key = skeleton(word)
  let best: { word: string; distance: number; count: number } | null = null
  for (const [candidate, count] of vocabulary) {
    if (candidate.length < 3 || /\d/.test(candidate)) continue
    const distance = editDistance(word, candidate)
    // Sounds-alike only for words of 4+ letters: 3-letter skeletons are too loose ("dan" ~ "diana").
    const soundsAlike =
      word.length >= 4 &&
      key.length >= 2 &&
      candidate[0] === word[0] &&
      skeleton(candidate) === key &&
      Math.abs(candidate.length - word.length) <= 3
    // Short words (3 letters) must also start with the same letter: "nvy" -> navy.
    const closeSpelling = distance <= maxEdits(word.length) && (word.length > 3 || candidate[0] === word[0])
    if (!closeSpelling && !soundsAlike) continue
    if (!best || distance < best.distance || (distance === best.distance && count > best.count)) {
      best = { word: candidate, distance, count }
    }
  }
  return best?.word ?? null
}
