import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../types'
import { formatPrice } from '../api'
import { useShop } from '../shop'
import FavoriteButton from './FavoriteButton'
import SizePickerModal from './SizePickerModal'

// Sizes with stock: from the product list (in_stock_sizes) or a full product record (inventory).
function inStockSizes(p: Product): string[] {
  if (p.in_stock_sizes) return p.in_stock_sizes
  return (p.inventory ?? []).filter((s) => s.quantity > 0).map((s) => s.size)
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="product-card">
      <Link to={`/products/${product.product_id}`} className="product-card-link">
        <div className="product-card-image">
          <img src={product.image_url} alt={product.name} loading="lazy" />
        </div>
        <div className="product-card-body">
          <div className="product-card-top">
            <h3>{product.name}</h3>
            <span className="price">{formatPrice(product.price)}</span>
          </div>
          {product.primary_color && (
            <p className="product-card-colors">
              <span className="label">Color:</span> {product.primary_color}
            </p>
          )}
          <p className="product-card-desc">{product.description}</p>
        </div>
      </Link>
      <div className="product-card-actions">
        <QuickAdd product={product} />
        <FavoriteButton productId={product.product_id} name={product.name} />
      </div>
    </div>
  )
}

// "Add to cart" on a card: opens a pop-up to choose a size (with a size guide).
function QuickAdd({ product }: { product: Product }) {
  const { addToCart } = useShop()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const available = inStockSizes(product)

  // Hide the confirmation after a moment.
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  const add = async (size: string, quantity: number) => {
    await addToCart(product.product_id, size, quantity) // errors are shown inside the pop-up
    setOpen(false)
    setMessage(`Added ${quantity > 1 ? `${quantity} × ` : ''}${size}`)
  }

  return (
    <>
      {message ? (
        <p className="quick-add-message ok" role="status">
          <span aria-hidden="true">✓ </span>
          {message}
          <Link to="/cart" className="quick-add-view">
            View cart
          </Link>
        </p>
      ) : (
        <button
          type="button"
          className="quick-add-button"
          onClick={() => setOpen(true)}
          disabled={available.length === 0}
          aria-haspopup="dialog"
        >
          {available.length === 0 ? 'Sold out' : 'Add to cart'}
        </button>
      )}
      {open && <SizePickerModal product={product} onClose={() => setOpen(false)} onAdd={add} />}
    </>
  )
}
