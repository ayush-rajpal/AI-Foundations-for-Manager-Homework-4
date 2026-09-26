import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { categoryOf, fetchProduct, formatPrice } from '../api'
import FavoriteButton from '../components/FavoriteButton'
import SizeGuideModal from '../components/SizeGuideModal'
import { useShop } from '../shop'
import type { Product } from '../types'

const LOW_STOCK = 5

function stockLabel(quantity: number) {
  if (quantity === 0) return { text: 'Sold out', cls: 'out' }
  if (quantity <= LOW_STOCK) return { text: `Only ${quantity} left`, cls: 'low' }
  return { text: `${quantity} in stock`, cls: 'in' }
}

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQty] = useState(1)
  const [cartMessage, setCartMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const { addToCart } = useShop()

  useEffect(() => {
    setProduct(null)
    setError('')
    setSelectedSize('')
    setQty(1)
    setCartMessage(null)
    fetchProduct(productId)
      .then(setProduct)
      .catch(() => setError('We could not find that product.'))
  }, [productId])

  if (error) {
    return (
      <section className="container section center">
        <h1>{error}</h1>
        <Link to="/products" className="btn btn-primary">
          Back to products
        </Link>
      </section>
    )
  }
  if (!product) return <p className="container section status">Loading…</p>

  const inventory = product.inventory ?? []
  const selected = inventory.find((s) => s.size === selectedSize)
  const maxQty = Math.min(selected?.quantity ?? 1, 10)

  const add = async () => {
    if (!selected) return setCartMessage({ ok: false, text: 'Pick a size first.' })
    setAdding(true)
    setCartMessage(null)
    try {
      const cart = await addToCart(product.product_id, selected.size, quantity)
      setCartMessage({ ok: true, text: `Added to your cart (${cart.item_count} ${cart.item_count === 1 ? 'item' : 'items'}).` })
    } catch (err) {
      setCartMessage({ ok: false, text: (err as Error).message })
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="container section">
      <Link to="/products" className="text-link back-link">
        ← All products
      </Link>

      <div className="detail">
        <div className="detail-image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <p className="eyebrow dark">{categoryOf(product.garment_type)}</p>
          <div className="detail-title">
            <h1>{product.name}</h1>
            <FavoriteButton productId={product.product_id} name={product.name} large />
          </div>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-desc">{product.description}</p>

          <dl className="detail-facts">
            <dt>Garment</dt>
            <dd className="capitalize">{product.garment_type}</dd>
            {product.primary_color && (
              <>
                <dt>Color</dt>
                <dd className="capitalize">{product.primary_color}</dd>
              </>
            )}
          </dl>

          <div className="sizes-heading">
            <h3>Sizes</h3>
            <button type="button" className="size-guide-link" onClick={() => setGuideOpen(true)} aria-haspopup="dialog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 8h18v8H3z" />
                <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
              </svg>
              Size guide
            </button>
          </div>
          {guideOpen && <SizeGuideModal highlight={selectedSize} onClose={() => setGuideOpen(false)} />}
          <div className="sizes">
            {inventory.map((s) => (
              <button
                key={s.size}
                className={`size${s.quantity === 0 ? ' size-out' : ''}${selectedSize === s.size ? ' selected' : ''}`}
                disabled={s.quantity === 0}
                onClick={() => {
                  setSelectedSize(s.size)
                  setQty(1)
                  setCartMessage(null)
                }}
                title={stockLabel(s.quantity).text}
              >
                {s.size}
              </button>
            ))}
          </div>
          <p className="stock-note">
            {selected ? (
              <span className={`stock ${stockLabel(selected.quantity).cls}`}>
                Size {selected.size}: {stockLabel(selected.quantity).text}
              </span>
            ) : (
              `${product.total_stock} units in stock across all sizes. Pick a size to check availability.`
            )}
          </p>

          <div className="add-to-cart">
            <div className="qty-picker" aria-label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">
                −
              </button>
              <span>{quantity}</span>
              <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={!selected || quantity >= maxQty} aria-label="Increase quantity">
                +
              </button>
            </div>
            <button className="btn btn-primary add-to-cart-button" onClick={add} disabled={adding || product.total_stock === 0}>
              {adding ? 'Adding…' : selected ? `Add to cart · ${formatPrice(product.price * quantity)}` : 'Select a size'}
            </button>
          </div>
          {cartMessage && (
            <p className={cartMessage.ok ? 'cart-added' : 'form-error'} role="status">
              {cartMessage.text} {cartMessage.ok && <Link to="/cart">View cart →</Link>}
            </p>
          )}

          <table className="stock-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((s) => {
                const label = stockLabel(s.quantity)
                return (
                  <tr key={s.size}>
                    <td>{s.size}</td>
                    <td>
                      <span className={`stock ${label.cls}`}>{label.text}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {product.search_tags.length > 0 && (
            <div className="tags">
              {product.search_tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
