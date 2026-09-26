import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'

// Favorites (starred products) and the shopping cart, saved to the customer's account in the
// database (backend/shop.py). Loaded when a customer logs in, cleared when they log out.

export interface CartItem {
  product_id: string
  name: string
  size: string
  quantity: number
  price: number
  line_total: number
  image_url: string
  primary_color: string | null
  in_stock: number
}

export interface Cart {
  items: CartItem[]
  item_count: number
  subtotal: number
}

const EMPTY_CART: Cart = { items: [], item_count: 0, subtotal: 0 }

interface ShopState {
  favorites: Set<string>
  isFavorite: (productId: string) => boolean
  toggleFavorite: (productId: string) => Promise<void>
  cart: Cart
  refreshCart: () => Promise<void>
  addToCart: (productId: string, size: string, quantity?: number) => Promise<Cart>
  setQuantity: (productId: string, size: string, quantity: number) => Promise<void>
}

const ShopContext = createContext<ShopState | null>(null)

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Please try again.')
  return data as T
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [cart, setCart] = useState<Cart>(EMPTY_CART)

  const refreshCart = useCallback(async () => {
    if (!user) return setCart(EMPTY_CART)
    setCart(await request<Cart>('/api/cart').catch(() => EMPTY_CART))
  }, [user])

  // Pull the customer's saved favorites and cart when they log in; clear them on logout.
  useEffect(() => {
    if (!user) {
      setFavorites(new Set())
      setCart(EMPTY_CART)
      return
    }
    request<{ product_ids: string[] }>('/api/favorites')
      .then((d) => setFavorites(new Set(d.product_ids)))
      .catch(() => setFavorites(new Set()))
    refreshCart()
  }, [user, refreshCart])

  const toggleFavorite = async (productId: string) => {
    if (!user) {
      // Favorites are saved to an account: log in first, then this item is starred automatically.
      navigate('/login', { state: { from: location.pathname + location.search, favorite: productId } })
      return
    }
    const starred = favorites.has(productId)
    setFavorites((f) => {
      const next = new Set(f)
      if (starred) next.delete(productId)
      else next.add(productId)
      return next
    })
    try {
      const d = await request<{ product_ids: string[] }>(`/api/favorites/${encodeURIComponent(productId)}`, starred ? 'DELETE' : 'POST')
      setFavorites(new Set(d.product_ids))
    } catch {
      setFavorites((f) => new Set(starred ? [...f, productId] : [...f].filter((id) => id !== productId)))
    }
  }

  const addToCart = async (productId: string, size: string, quantity = 1) => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } })
      throw new Error('Please log in to add items to your cart.')
    }
    const next = await request<Cart>('/api/cart', 'POST', { product_id: productId, size, quantity })
    setCart(next)
    return next
  }

  const setQuantity = async (productId: string, size: string, quantity: number) => {
    const url = `/api/cart/${encodeURIComponent(productId)}/${encodeURIComponent(size)}`
    setCart(quantity > 0 ? await request<Cart>(url, 'PATCH', { quantity }) : await request<Cart>(url, 'DELETE'))
  }

  return (
    <ShopContext.Provider
      value={{ favorites, isFavorite: (id) => favorites.has(id), toggleFavorite, cart, refreshCart, addToCart, setQuantity }}
    >
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>')
  return ctx
}
