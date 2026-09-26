// Understands how customers actually type into the search bar:
//   "hody under $90", "navy hoodie in medium", "cheapest crewneck", "tees between 30 and 40",
//   "something for my mom under 70", "xl quarter zip over $60".
// It pulls out price limits, a size, garment colors, and a sort wish, and leaves the
// remaining keywords (spelling is fixed afterwards by interpretQuery in productFilters.ts).

import type { SortKey } from './productFilters'
import { editDistance } from './spelling'

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface ParsedQuery {
  text: string // what's left to match as keywords
  minPrice: number | null
  maxPrice: number | null
  size: Size | null
  colors: string[] // garment color words, e.g. ["navy"] or ["heather", "gray"]
  sort: SortKey | null
  understood: string[] // plain-English pieces for "Showing results for …", e.g. "under $90"
}

const N = String.raw`\$?\s*(\d{1,4}(?:\.\d{1,2})?)\s*(?:dollars|bucks|usd)?`

// Price phrases, most specific first. Each returns [min, max].
const PRICE_PATTERNS: [RegExp, (a: number, b?: number) => [number | null, number | null]][] = [
  [new RegExp(String.raw`\bbetween\s+${N}\s+(?:and|to|-)\s+${N}`, 'i'), (a, b) => [Math.min(a, b!), Math.max(a, b!)]],
  [new RegExp(String.raw`(?:^|\s)${N}\s*(?:-|to|–)\s*${N}`, 'i'), (a, b) => [Math.min(a, b!), Math.max(a, b!)]],
  [new RegExp(String.raw`\b(?:under|below|less\s+than|cheaper\s+than|up\s+to|at\s+most|no\s+more\s+than|max(?:imum)?|within)\s+${N}`, 'i'), (a) => [null, a]],
  [new RegExp(String.raw`<\s*=?\s*${N}`, 'i'), (a) => [null, a]],
  [new RegExp(String.raw`\b(?:over|above|more\s+than|at\s+least|min(?:imum)?|starting\s+at)\s+${N}`, 'i'), (a) => [a, null]],
  [new RegExp(String.raw`>\s*=?\s*${N}`, 'i'), (a) => [a, null]],
  [new RegExp(String.raw`\b(?:around|about|roughly|~)\s+${N}`, 'i'), (a) => [Math.max(0, a - 10), a + 10]],
]

const SIZE_WORDS: Record<string, Size> = {
  xs: 'XS', xsmall: 'XS', extrasmall: 'XS',
  s: 'S', small: 'S',
  m: 'M', med: 'M', medium: 'M',
  l: 'L', large: 'L',
  xl: 'XL', xlarge: 'XL', extralarge: 'XL',
  xxl: 'XXL', '2xl': 'XXL', xxlarge: 'XXL', '2xlarge': 'XXL',
}
// "size m", "in a large", "in medium": single letters only count after "size"/"in".
const SIZE_AFTER_CUE = /\b(?:size|sz|in(?:\s+an?)?)\s+(x{0,2}-?small|x{0,2}-?large|extra[\s-]?(?:small|large)|medium|med|2xl|xxl|xl|xs|s|m|l)\b/i
// Stand-alone size words that are clear on their own.
const SIZE_ALONE = /\b(2xl|xxl|xl|xs|x-?small|x-?large|xx-?large|extra[\s-]?small|extra[\s-]?large|medium)\b/i

const CHEAP = /\b(cheapest|cheap|inexpensive|affordable|budget|lowest\s+price|least\s+expensive)\b/i
const PRICEY = /\b(most\s+expensive|priciest|premium|highest\s+price|luxury|fanciest)\b/i

// Garment color words the search understands (garment colors are checked against primary_color).
export const COLOR_WORDS = new Set([
  'navy', 'blue', 'gray', 'grey', 'heather', 'charcoal', 'cream', 'ivory', 'white', 'black', 'red', 'green',
  'yellow', 'gold', 'pink', 'coral', 'purple', 'orange', 'brown', 'beige', 'maroon', 'light', 'dark',
])
// "light"/"dark" only count as colors next to another color word ("light gray", "dark heather").
const COLOR_MODIFIERS = new Set(['light', 'dark', 'heather'])

const normSize = (raw: string): Size | null => SIZE_WORDS[raw.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? null

/** A misspelled color ("nvy", "gry", "blak"), but only if the word isn't a real catalogue word
 * (so "golf" stays golf instead of becoming "gold"). */
function misspelledColor(word: string, isCatalogueWord: (w: string) => boolean): string | null {
  if (word.length < 3 || COLOR_WORDS.has(word) || isCatalogueWord(word)) return null
  for (const color of COLOR_WORDS) {
    if (COLOR_MODIFIERS.has(color) || color[0] !== word[0]) continue
    if (editDistance(word, color) <= 1) return color
  }
  return null
}

export function parseQuery(query: string, isCatalogueWord: (w: string) => boolean = () => true): ParsedQuery {
  let text = ` ${query} `
  let minPrice: number | null = null
  let maxPrice: number | null = null
  let size: Size | null = null
  let sort: SortKey | null = null
  const understood: string[] = []

  for (const [pattern, toRange] of PRICE_PATTERNS) {
    const m = text.match(pattern)
    if (!m) continue
    const [lo, hi] = toRange(Number(m[1]), m[2] !== undefined ? Number(m[2]) : undefined)
    minPrice = lo
    maxPrice = hi
    text = text.replace(m[0], ' ')
    understood.push(lo !== null && hi !== null ? `$${lo}–$${hi}` : hi !== null ? `under $${hi}` : `over $${lo}`)
    break
  }

  const sizeMatch = text.match(SIZE_AFTER_CUE) ?? text.match(SIZE_ALONE)
  if (sizeMatch && (size = normSize(sizeMatch[1]))) {
    text = text.replace(sizeMatch[0], ' ')
    understood.push(`size ${size} in stock`)
  }

  if (PRICEY.test(text)) {
    sort = 'price-desc'
    text = text.replace(PRICEY, ' ')
    understood.push('most expensive first')
  } else if (CHEAP.test(text)) {
    sort = 'price-asc'
    text = text.replace(CHEAP, ' ')
    understood.push('cheapest first')
  }

  // Garment colors: pull color words out of the keywords.
  const words = text.split(/\s+/).filter(Boolean)
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))
  const colors: string[] = []
  const keep: string[] = []
  lower.forEach((w, i) => {
    const fixedColor = misspelledColor(w, isCatalogueWord)
    if (fixedColor) {
      colors.push(fixedColor)
      return
    }
    const isColor = COLOR_WORDS.has(w)
    const neighborIsColor = [lower[i - 1], lower[i + 1]].some((n) => n && COLOR_WORDS.has(n) && !COLOR_MODIFIERS.has(n))
    if (isColor && (!COLOR_MODIFIERS.has(w) || neighborIsColor || w === 'heather')) colors.push(w === 'grey' ? 'gray' : w)
    else keep.push(words[i])
  })
  if (colors.length) understood.push(`${colors.join(' ')} garments`)

  return { text: keep.join(' ').trim(), minPrice, maxPrice, size, colors, sort, understood }
}
