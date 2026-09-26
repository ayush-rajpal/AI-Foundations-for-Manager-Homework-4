import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { formatPrice } from '../api'
import { useAuth } from '../auth'
import { useShop } from '../shop'

// The customer's shopping cart, saved to their account (items can also be added by the chatbot).
export default function Cart() {
  const { user, loading } = useAuth()
  const { cart, refreshCart, setQuantity } = useShop()
  const [error, setError] = useState('')

  useEffect(() => {
    refreshCart()
  }, [refreshCart])

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: '/cart' }} />

  const change = async (productId: string, size: string, quantity: number) => {
    setError('')
    try {
      await setQuantity(productId, size, quantity)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Your account</p>
          <h1>Your cart</h1>
          <p className="section-sub light">Saved to your account, so it's here next time you log in.</p>
        </div>
      </section>

      <section className="container section">
        {cart.items.length === 0 ? (
          <div className="empty-state">
            <p>Your cart is empty. Add items from a product page, or ask our assistant to add them for you.</p>
            <Link to="/products" className="btn btn-primary">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <ul className="cart-lines">
              {cart.items.map((item) => (
                <li key={`${item.product_id}-${item.size}`} className="cart-line">
                  <Link to={`/products/${item.product_id}`} className="cart-line-image">
                    <img src={item.image_url} alt="" />
                  </Link>
                  <div className="cart-line-info">
                    <Link to={`/products/${item.product_id}`} className="cart-line-name">
                      {item.name}
                    </Link>
                    <p className="cart-line-meta">
                      Size {item.size}
                      {item.primary_color ? ` · ${item.primary_color}` : ''} · {formatPrice(item.price)} each
                    </p>
                    {item.in_stock < item.quantity && (
                      <p className="form-error">Only {item.in_stock} left in this size. Please lower the quantity.</p>
                    )}
                  </div>
                  <div className="cart-qty" aria-label={`Quantity for ${item.name}, size ${item.size}`}>
                    <button onClick={() => change(item.product_id, item.size, item.quantity - 1)} aria-label="Decrease quantity">
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => change(item.product_id, item.size, item.quantity + 1)}
                      disabled={item.quantity >= item.in_stock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <p className="cart-line-total">{formatPrice(item.line_total)}</p>
                  <button className="text-link cart-remove" onClick={() => change(item.product_id, item.size, 0)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <aside className="cart-summary">
              <h3>Order summary</h3>
              <p className="cart-summary-row">
                <span>
                  {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'}
                </span>
                <strong>{formatPrice(cart.subtotal)}</strong>
              </p>
              <p className="cart-note">Taxes and shipping are calculated at checkout.</p>
              <button className="btn btn-primary btn-block" disabled title="Online checkout isn't available yet">
                Checkout (coming soon)
              </button>
              <p className="cart-note">Online checkout isn't available yet. Visit us at 57 Broadway, New Haven.</p>
              {error && <p className="form-error">{error}</p>}
            </aside>
          </div>
        )}
      </section>
    </>
  )
}
