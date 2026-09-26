import type { Product } from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

// POST JSON and surface the backend's error message (FastAPI puts it in `detail`).
export async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail
    throw new Error(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.')
  }
  return data as T
}

export const fetchProducts = () => getJson<Product[]>('/api/products')

export const fetchProduct = (productId: string) =>
  getJson<Product>(`/api/products/${encodeURIComponent(productId)}`)

export const formatPrice = (price: number) => `$${price.toFixed(2)}`

// The catalogue's garment_type has ~22 spellings; group them into shopper-friendly categories.
export const CATEGORIES = ['Hoodies', 'Crewnecks', 'T-Shirts', 'Quarter-Zips', 'Jackets & Fleece', 'Long Sleeve'] as const
export type Category = (typeof CATEGORIES)[number]

export function categoryOf(garmentType: string): Category {
  const t = garmentType.toLowerCase()
  if (t.includes('quarter-zip')) return 'Quarter-Zips'
  if (t.includes('hood')) return 'Hoodies' // before full-zip: "full-zip hooded sweatshirt" is a hoodie
  if (t.includes('jacket') || t.includes('full-zip')) return 'Jackets & Fleece'
  if (t.includes('t-shirt')) return 'T-Shirts'
  if (t.includes('long-sleeve')) return 'Long Sleeve'
  return 'Crewnecks'
}

// Home-page collections, matched on keywords in the product name.
const words = (...w: string[]) => (name: string) => w.some((x) => new RegExp(`\\b${x}\\b`, 'i').test(name))

export const COLLECTIONS = {
  colleges: {
    title: 'Residential Colleges',
    match: words('Benjamin Franklin', 'Berkeley', 'Branford', 'Davenport', 'Ezra Stiles', 'Grace Hopper',
      'Jonathan Edwards', 'Morse', 'Pauli Murray', 'Pierson', 'Saybrook', 'Silliman', 'Timothy Dwight', 'Trumbull'),
  },
  sports: {
    title: 'Varsity Sports',
    match: words('Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Tennis', 'Track', 'Golf', 'Volleyball',
      'Diving', 'Swimming', 'Sailing', 'Squash', 'Lacrosse', 'Fencing'),
  },
  family: {
    title: 'The Yale Family',
    match: words('Mom', 'Dad', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Brother', 'Sister', 'Cousin'),
  },
  schools: {
    title: 'Graduate Schools',
    match: words('School', 'Divinity'),
  },
} as const
export type CollectionKey = keyof typeof COLLECTIONS
