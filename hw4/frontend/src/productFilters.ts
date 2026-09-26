import { CATEGORIES, categoryOf, COLLECTIONS, type Category, type CollectionKey } from './api'
import { parseQuery } from './queryParser'
import { closestWord } from './spelling'
import type { Product } from './types'

// Products page filters. They live in the URL (?type=Hoodies,T-Shirts&color=navy blue&min=40&max=70&sort=price-asc)
// so a filtered view can be bookmarked, shared, or reached with the browser's back button.

export type SortKey = 'featured' | 'price-asc' | 'price-desc'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
]

export interface Filters {
  query: string
  types: Category[]
  colors: string[] // primary colors, lowercase as in the database
  minPrice: number | null
  maxPrice: number | null
  collection: CollectionKey | null
  sort: SortKey
}

const list = (value: string | null) => (value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [])
const num = (value: string | null) => (value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null)

export function readFilters(params: URLSearchParams): Filters {
  // "category" is the older single-category link format (still used by some links).
  const types = [...list(params.get('type')), ...list(params.get('category'))].filter((t): t is Category =>
    (CATEGORIES as readonly string[]).includes(t),
  )
  const collection = params.get('collection')
  const sort = params.get('sort')
  return {
    query: params.get('q') ?? '',
    types: [...new Set(types)],
    colors: list(params.get('color')).map((c) => c.toLowerCase()),
    minPrice: num(params.get('min')),
    maxPrice: num(params.get('max')),
    collection: collection && collection in COLLECTIONS ? (collection as CollectionKey) : null,
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'featured',
  }
}

export function writeFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params)
  const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key))
  next.delete('category')
  set('q', f.query)
  set('type', f.types.join(','))
  set('color', f.colors.join(','))
  set('min', f.minPrice === null ? null : String(f.minPrice))
  set('max', f.maxPrice === null ? null : String(f.maxPrice))
  set('collection', f.collection)
  set('sort', f.sort === 'featured' ? null : f.sort)
  return next
}

export type Facet = 'types' | 'colors' | 'price'

// Apply every filter except `skip`, so each filter group can show how many products each
// option would give with the other filters left as they are.
// Search-bar requirements that can be loosened when nothing matches all of them.
export interface Relax {
  colorAnywhere?: boolean // match color words anywhere in the design, not just the garment color
  anySize?: boolean
  anyQueryPrice?: boolean
  anyColor?: boolean // drop the search-bar color entirely
}

/** parseQuery, with misspelled colors fixed only when the word isn't a catalogue word. */
function parse(products: Product[], query: string) {
  const vocab = vocabulary(products)
  return parseQuery(query, (w) => vocab.has(w) || vocab.has(w.replace(/s$/, '')))
}

export function applyFilters(products: Product[], f: Filters, skip?: Facet, relax: Relax = {}): Product[] {
  const parsed = parse(products, f.query)
  const { words } = interpretQuery(products, parsed.text)
  const collection = f.collection ? COLLECTIONS[f.collection] : null
  // Price limits typed in the search bar ("under $90") combine with the price slider.
  const qMin = relax.anyQueryPrice ? null : parsed.minPrice
  const qMax = relax.anyQueryPrice ? null : parsed.maxPrice
  const minPrice = [f.minPrice, qMin].reduce<number | null>((a, b) => (b === null ? a : a === null ? b : Math.max(a, b)), null)
  const maxPrice = [f.maxPrice, qMax].reduce<number | null>((a, b) => (b === null ? a : a === null ? b : Math.min(a, b)), null)
  return products.filter((p) => {
    if (skip !== 'types' && f.types.length && !f.types.includes(categoryOf(p.garment_type))) return false
    if (skip !== 'colors' && f.colors.length && !(p.primary_color && f.colors.includes(p.primary_color))) return false
    if (skip !== 'price' && minPrice !== null && p.price < minPrice) return false
    if (skip !== 'price' && maxPrice !== null && p.price > maxPrice) return false
    if (collection && !collection.match(p.name)) return false
    if (parsed.size && !relax.anySize && !(p.in_stock_sizes ?? []).includes(parsed.size)) return false
    if (parsed.colors.length && !relax.anyColor) {
      // Colors typed in the search bar mean the garment color (e.g. "navy hoodie"), unless loosened.
      const colorText = (relax.colorAnywhere ? p.colors.join(' ') + ' ' + p.description : p.primary_color ?? '').toLowerCase()
      if (!parsed.colors.every((c) => colorText.includes(c))) return false
    }
    if (!words.length) return true
    const { all, type } = productTokens(p)
    // Every search word must match a word in the product; a prefix counts, so results
    // appear while typing ("hood" finds hoodies). Garment-type words ("crewnecks", "long
    // sleeve") only match the product's type and name, not a description that mentions
    // a "crew-neck collar" or "long sleeves".
    return words.every((w) => {
      const tokens = TYPE_WORDS.has(w) ? type : all
      return tokens.has(w) || [...tokens].some((t) => t.startsWith(w))
    })
  })
}

// --- Search box matching (same idea as the chatbot's search in backend/tools.py) ---
// Different phrasings are rewritten to one word, and plurals are reduced, so
// "hoodies", "hooded sweatshirt", "tees", "1/4 zip", and "grey" all find what customers mean.
const PHRASES: [RegExp, string][] = [
  [/handsome\s+dan/g, 'bulldog'], // Yale's bulldog mascot
  [/\b(quarter|1[\s/-]?4)[\s-]*zips?\b/g, 'quarterzip'],
  [/\bt[\s-]?shirts?\b|\btees?\b/g, 'tshirt'],
  [/\bhoodies\b|\bhoodie\b|\bhooded\b|\bhoods?\b/g, 'hoodie'],
  [/\bcrew[\s-]?necks?\b|\bcrews\b/g, 'crewneck'],
  [/\bsweat[\s-]?shirts?\b/g, 'sweatshirt'],
  [/\blong[\s-]?sleeves?\b/g, 'longsleeve'],
  [/\bgrey\b/g, 'gray'],
]
// Words used by the rewrites above, so spelling fixes can land on them ("handsom dan", "quartr zip").
const PHRASE_WORDS = ['handsome', 'dan', 'quarter', 'zip', 'tee', 'shirt', 'hood', 'hooded', 'crew', 'neck', 'sweat', 'long', 'sleeve', 'grey']
const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'with', 'for', 'of', 'in', 'on', 'at', 'to', 'or', 'any', 'some', 'me', 'my', 'show',
  'i', 'im', 'want', 'need', 'looking', 'look', 'find', 'get', 'buy', 'something', 'anything', 'stuff', 'things',
  'item', 'items', 'please', 'do', 'does', 'you', 'have', 'got', 'sell', 'what', 'which', 'is', 'are', 'that',
  'this', 'can', 'like', 'would', 'love', 'nice', 'good', 'one', 'ones', 'price', 'priced', 'cost',
])

function tokenize(text: string): string[] {
  let t = text.toLowerCase()
  for (const [pattern, word] of PHRASES) t = t.replace(pattern, word)
  // Light stemming: "bulldogs" -> "bulldog", "fleeces" -> "fleece", "jackets" -> "jacket".
  return (t.match(/[a-z0-9]+/g) ?? []).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

export function searchTokens(query: string): Set<string> {
  return new Set(tokenize(query).filter((w) => !STOPWORDS.has(w)))
}

// Words that name a kind of garment (after the rewrites above).
const TYPE_WORDS = new Set(['hoodie', 'tshirt', 'crewneck', 'quarterzip', 'longsleeve', 'sweatshirt', 'jacket', 'mockneck'])

const tokenCache = new WeakMap<Product, { all: Set<string>; type: Set<string> }>()

function productTokens(p: Product) {
  let tokens = tokenCache.get(p)
  if (!tokens) {
    const typeText = [p.name, p.garment_type, categoryOf(p.garment_type)]
    const allText = [...typeText, p.description, ...p.colors, ...p.search_tags]
    tokens = { all: new Set(tokenize(allText.join(' '))), type: new Set(tokenize(typeText.join(' '))) }
    tokenCache.set(p, tokens)
  }
  return tokens
}

// --- Spelling mistakes ("hudy" -> hoodie) ---

const vocabularyCache = new WeakMap<Product[], Map<string, number>>()

const rawWords = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? []

/** Every word used in the catalogue, with the number of products that use it: both the
 * words as written ("quarter", "zip") and after the rewrites above ("quarterzip"). */
function vocabulary(products: Product[]): Map<string, number> {
  let vocab = vocabularyCache.get(products)
  if (!vocab) {
    vocab = new Map()
    for (const p of products) {
      const text = [p.name, p.description, p.garment_type, categoryOf(p.garment_type), ...p.colors, ...p.search_tags]
      const words = new Set([...productTokens(p).all, ...tokenize(text.join(' ')), ...rawWords(text.join(' '))])
      for (const w of words) vocab.set(w, (vocab.get(w) ?? 0) + 1)
    }
    // Words the search understands even though no product text uses them.
    for (const w of PHRASE_WORDS) if (!vocab.has(w)) vocab.set(w, 1)
    vocabularyCache.set(products, vocab)
  }
  return vocab
}

export interface Correction {
  typed: string
  meant: string // a catalogue word, shown to the customer as "Showing results for …"
}

// How corrected words are shown to the customer (internal words like "tshirt" read oddly).
const DISPLAY: Record<string, string> = {
  tshirt: 't-shirt',
  quarterzip: 'quarter-zip',
  longsleeve: 'long sleeve',
}
export const displayWord = (w: string) => DISPLAY[w] ?? w

/**
 * The search words to match, after fixing spelling mistakes. Each typed word is kept if a
 * catalogue word equals or starts with it (or it's a known phrase like "tees"); otherwise
 * it's replaced by the closest catalogue word, if one is close enough. Spelling is fixed
 * before the phrase rewrites, so "quartr zip" becomes "quarter zip" and then quarter-zips.
 */
export function interpretQuery(products: Product[], query: string): { words: string[]; corrections: Correction[] } {
  const vocab = vocabulary(products)
  const corrections: Correction[] = []
  const isKnown = (w: string) => {
    if (STOPWORDS.has(w) || vocab.has(w)) return true
    const normalized = tokenize(w)
    if (normalized.length === 1 && vocab.has(normalized[0])) return true // "tees", "hoodies", "grey"
    // A partly typed word ("hood", "sayb") counts only if it starts a word products actually use.
    return [...vocab.keys()].some((t) => t.startsWith(w) && !PHRASE_WORDS.includes(t))
  }
  // Numbers only count as keywords if a product uses them (e.g. "2025"); a stray "90" left
  // over from "under $90" is dropped instead of making every product fail to match.
  const withoutStrayNumbers = query.replace(/\b\d+\b/g, (n) => (vocab.has(n) ? n : ' '))
  const fixed = withoutStrayNumbers.replace(/[a-z]+/gi, (typed) => {
    const w = typed.toLowerCase()
    if (isKnown(w)) return typed
    const meant = closestWord(w, vocab)
    if (!meant) return typed
    corrections.push({ typed: w, meant })
    return meant
  })
  return { words: [...searchTokens(fixed)], corrections }
}

export interface SearchResult {
  products: Product[]
  words: string[] // keywords after spelling fixes
  corrections: Correction[]
  understood: string[] // e.g. ["under $90", "size M in stock"]
  sort: SortKey
  note: string | null // explains any requirement that had to be loosened
}

/**
 * The Products page's results: all filters plus everything understood from the search bar.
 * If nothing matches all of it, loosen one search-bar requirement at a time (garment color ->
 * color anywhere in the design, then size, then price) and say what changed.
 */
export function searchProducts(products: Product[], f: Filters): SearchResult {
  const parsed = parse(products, f.query)
  const { words, corrections } = interpretQuery(products, parsed.text)
  const sort = f.sort !== 'featured' ? f.sort : (parsed.sort ?? 'featured')
  const base = { words, corrections, understood: parsed.understood }
  let relax: Relax = {}
  let found = applyFilters(products, f, undefined, relax)
  let note: string | null = null
  const colorText = parsed.colors.join(' ')

  if (!found.length && parsed.colors.length) {
    relax = { ...relax, colorAnywhere: true }
    found = applyFilters(products, f, undefined, relax)
    if (found.length) note = `No ${colorText} garments match. Showing items with ${colorText} in the design instead.`
  }
  if (!found.length && parsed.colors.length) {
    relax = { ...relax, anyColor: true }
    found = applyFilters(products, f, undefined, relax)
    if (found.length) note = `Nothing comes in ${colorText} right now. Showing other colors instead.`
  }
  if (!found.length && parsed.size) {
    relax = { ...relax, anySize: true }
    found = applyFilters(products, f, undefined, relax)
    if (found.length) note = `Nothing matches in size ${parsed.size}. Showing other sizes.`
  }
  if (!found.length && (parsed.minPrice !== null || parsed.maxPrice !== null)) {
    relax = { ...relax, anyQueryPrice: true }
    found = applyFilters(products, f, undefined, relax)
    if (found.length) {
      note =
        parsed.maxPrice !== null
          ? `Nothing matches under $${parsed.maxPrice}. Showing the lowest prices first.`
          : `Nothing matches over $${parsed.minPrice}. Showing the highest prices first.`
      return { ...base, products: sortProducts(found, parsed.maxPrice !== null ? 'price-asc' : 'price-desc'), sort, note }
    }
  }
  return { ...base, products: sortProducts(found, sort), sort, note }
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  if (sort === 'featured') return products // catalogue order (A to Z)
  const dir = sort === 'price-asc' ? 1 : -1
  return [...products].sort((a, b) => (a.price - b.price) * dir || a.name.localeCompare(b.name))
}

export function countBy<T extends string>(products: Product[], key: (p: Product) => T | null): Map<T, number> {
  const counts = new Map<T, number>()
  for (const p of products) {
    const k = key(p)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

// Swatch colors for the color filter (keys are the database's primary_color values).
export const SWATCHES: Record<string, string> = {
  'navy blue': '#1f2d4d',
  'heather gray': '#a3a7ad',
  cream: '#f2e8cf',
  'charcoal gray': '#4b4f55',
  'dark heather gray': '#65696f',
  'dark heather charcoal': '#46494e',
  'heather charcoal gray': '#585c62',
  gray: '#8d9096',
  'light gray': '#d3d6da',
  'dusty coral': '#d88c7a',
  white: '#ffffff',
  ivory: '#fffbeb',
}

export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
