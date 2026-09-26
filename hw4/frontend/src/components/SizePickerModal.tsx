import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { fetchProduct, formatPrice } from '../api'
import type { Product, SizeStock } from '../types'
import SizeGuide from './SizeGuide'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const LOW_STOCK = 5

interface Props {
  product: Product
  onClose: () => void
  onAdd: (size: string, quantity: number) => Promise<void>
}

// Pop-up for choosing a size (with stock and a size guide) before adding a product to the cart.
export default function SizePickerModal({ product, onClose, onAdd }: Props) {
  const [inventory, setInventory] = useState<SizeStock[] | null>(product.inventory ?? null)
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [showGuide, setShowGuide] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Exact stock per size (the product list only says which sizes are in stock).
  useEffect(() => {
    if (product.inventory) return
    fetchProduct(product.product_id)
      .then((p) => setInventory(p.inventory ?? []))
      .catch(() => setInventory([]))
  }, [product])

  // Close with Escape; keep focus inside the pop-up; stop the page scrolling behind it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  const stockOf = (s: string) => inventory?.find((i) => i.size === s)?.quantity ?? (product.in_stock_sizes?.includes(s) ? null : 0)
  const selectedStock = size ? stockOf(size) : null
  const maxQty = Math.max(1, Math.min(typeof selectedStock === 'number' ? selectedStock : 10, 10))

  const add = async () => {
    if (!size) return setError('Please choose a size.')
    setAdding(true)
    setError('')
    try {
      await onAdd(size, quantity)
    } catch (err) {
      setError((err as Error).message)
      setAdding(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="size-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className="size-modal-product">
          <div className="size-modal-image">
            <img src={product.image_url} alt="" />
          </div>
          <div>
            <h2 id="size-modal-title">{product.name}</h2>
            <p className="size-modal-price">{formatPrice(product.price)}</p>
            {product.primary_color && <p className="size-modal-color">Color: {product.primary_color}</p>}
          </div>
        </div>

        <div className="size-modal-section">
          <div className="size-modal-row">
            <h3>Choose a size</h3>
            <button type="button" className="text-link size-guide-toggle" onClick={() => setShowGuide((g) => !g)} aria-expanded={showGuide}>
              {showGuide ? 'Hide size guide' : 'Size guide'}
            </button>
          </div>
          <div className="size-modal-sizes">
            {SIZES.map((s) => {
              const stock = stockOf(s)
              const soldOut = stock === 0
              return (
                <button
                  key={s}
                  type="button"
                  className={`size-option${size === s ? ' selected' : ''}${soldOut ? ' sold-out' : ''}`}
                  disabled={soldOut}
                  onClick={() => {
                    setSize(s)
                    setQuantity(1)
                    setError('')
                  }}
                  aria-pressed={size === s}
                >
                  <span className="size-option-label">{s}</span>
                  <span className={`size-option-stock${typeof stock === 'number' && stock > 0 && stock <= LOW_STOCK ? ' low' : ''}`}>
                    {soldOut ? 'Sold out' : typeof stock === 'number' && stock <= LOW_STOCK ? `Only ${stock} left` : 'In stock'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {showGuide && <SizeGuide highlight={size} />}

        <div className="size-modal-actions">
          <div className="qty-picker" aria-label="Quantity">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">
              −
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={!size || quantity >= maxQty}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button type="button" className="btn btn-primary size-modal-add" onClick={add} disabled={adding || !size}>
            {adding ? 'Adding…' : size ? `Add to cart · ${formatPrice(product.price * quantity)}` : 'Select a size'}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <Link to={`/products/${product.product_id}`} className="text-link size-modal-details" onClick={onClose}>
          View full product details →
        </Link>
      </div>
    </div>,
    document.body,
  )
}
