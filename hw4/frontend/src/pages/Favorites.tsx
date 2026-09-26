import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../auth'
import { useShop } from '../shop'
import type { Product } from '../types'

// The customer's starred products, saved to their account.
export default function Favorites() {
  const { user, loading } = useAuth()
  const { favorites } = useShop()
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/favorites')
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products: Product[] }) => setProducts(d.products))
      .catch(() => setProducts([]))
  }, [user])

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: '/favorites' }} />

  // Hide items the customer un-stars on this page right away.
  const shown = (products ?? []).filter((p) => favorites.has(p.product_id))

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Your account</p>
          <h1>Favorites</h1>
          <p className="section-sub light">Products you've starred. They're saved for your next visit.</p>
        </div>
      </section>
      <section className="container section">
        {products === null ? (
          <p className="status">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p>You haven't starred anything yet. Tap the ☆ on any product to save it here.</p>
            <Link to="/products" className="btn btn-primary">
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <p className="result-count">
              {shown.length} {shown.length === 1 ? 'favorite' : 'favorites'}
            </p>
            <div className="product-grid">
              {shown.map((p) => (
                <ProductCard key={p.product_id} product={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
