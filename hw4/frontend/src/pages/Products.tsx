import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import ProductFilters from '../components/ProductFilters'
import { COLLECTIONS, fetchProducts, formatPrice } from '../api'
import { useChatResults } from '../chatResults'
import {
  displayWord,
  searchProducts,
  readFilters,
  SORT_OPTIONS,
  titleCase,
  writeFilters,
  type Filters,
  type SortKey,
} from '../productFilters'
import type { Product } from '../types'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { results: chatResults, clearResults } = useChatResults()
  const fromChat = params.get('from') === 'chat' && chatResults !== null

  // A new chat search replaces the page's products: bring the customer to the top to see them.
  useEffect(() => {
    if (fromChat) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [fromChat, chatResults])

  // Filter panel is hidden until the customer clicks "Filters"; remembered for this visit.
  // ?filters=open in the address opens the panel (handy for sharing a link with filters showing).
  const [showFilters, setShowFilters] = useState(
    () => sessionStorage.getItem('cc_show_filters') === '1' || new URLSearchParams(window.location.search).get('filters') === 'open',
  )
  const toggleFilters = () =>
    setShowFilters((open) => {
      sessionStorage.setItem('cc_show_filters', open ? '0' : '1')
      return !open
    })
  const filters = readFilters(params)
  const collection = filters.collection ? COLLECTIONS[filters.collection] : null

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products. Is the backend running on port 8000?'))
      .finally(() => setLoading(false))
  }, [])

  const update = (next: Filters) => setParams(writeFilters(params, next), { replace: true })

  // Slider range = cheapest to most expensive product in the catalogue.
  const bounds = useMemo<[number, number]>(() => {
    if (!products.length) return [0, 100]
    const prices = products.map((p) => p.price)
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))]
  }, [products])
  const lo = Math.max(bounds[0], filters.minPrice ?? bounds[0])
  const hi = Math.min(bounds[1], filters.maxPrice ?? bounds[1])

  // Everything the search bar understood (keywords, spelling fixes, price, size, color, sort).
  const search = searchProducts(products, filters)
  const visible = search.products
  const showUnderstood = search.corrections.length > 0 || search.understood.length > 0

  if (fromChat) {
    const showAll = () => {
      clearResults()
      navigate('/products')
    }
    return (
      <>
        <section className="page-hero">
          <div className="container">
            <p className="eyebrow">From your chat</p>
            <h1>{chatResults.title}</h1>
            <p className="section-sub light">Our assistant found these for you. Tap any item for sizes and stock.</p>
          </div>
        </section>

        <section className="container section">
          <div className="chat-results-banner" role="status">
            <span>
              <span aria-hidden="true">💬 </span>
              Showing <strong>{chatResults.total}</strong> {chatResults.total === 1 ? 'item' : 'items'} matching your
              chat search.
            </span>
            <button className="btn btn-primary btn-small" onClick={showAll}>
              Show all products
            </button>
          </div>
          <div className="product-grid chat-results-grid" key={chatResults.title + chatResults.total}>
            {chatResults.products.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </section>
      </>
    )
  }

  const chips = [
    ...filters.types.map((t) => ({ label: t, clear: { types: filters.types.filter((x) => x !== t) } })),
    ...filters.colors.map((c) => ({ label: titleCase(c), clear: { colors: filters.colors.filter((x) => x !== c) } })),
    ...(filters.minPrice !== null || filters.maxPrice !== null
      ? [{ label: `${formatPrice(lo)} – ${formatPrice(hi)}`, clear: { minPrice: null, maxPrice: null } }]
      : []),
    ...(collection ? [{ label: collection.title, clear: { collection: null } }] : []),
  ]
  const clearAll = () =>
    update({ ...filters, types: [], colors: [], minPrice: null, maxPrice: null, collection: null, query: '' })
  const activeCount = filters.types.length + filters.colors.length + (lo !== bounds[0] || hi !== bounds[1] ? 1 : 0)

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Shop</p>
          <h1>{collection ? collection.title : 'All Products'}</h1>
          <p className="section-sub light">Tap any item for full details, sizes, and stock.</p>
        </div>
      </section>

      <section className="container section">
        <div className="shop-toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search hoodies, colleges, sports…"
            value={filters.query}
            onChange={(e) => update({ ...filters, query: e.target.value })}
            aria-label="Search products"
          />
          <button
            type="button"
            className={`filters-toggle${showFilters ? ' active' : ''}`}
            onClick={toggleFilters}
            aria-expanded={showFilters}
            aria-controls="product-filters"
            title={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeCount > 0 && <span className="filters-count">{activeCount}</span>}
          </button>
          <label className="sort-control">
            Sort by
            <select value={filters.sort} onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`shop-layout${showFilters ? ' with-filters' : ''}`}>
          <aside id="product-filters" className={`shop-sidebar${showFilters ? ' open' : ''}`} aria-label="Filters" hidden={!showFilters}>
            {products.length > 0 && (
              <ProductFilters products={products} filters={filters} priceBounds={bounds} onChange={update} />
            )}
          </aside>

          <div className="shop-results">
            {loading && <p className="status">Loading products…</p>}
            {error && <p className="status error">{error}</p>}
            {!loading && !error && (
              <>
                <div className="results-bar">
                  <p className="result-count">
                    {visible.length} {visible.length === 1 ? 'item' : 'items'}
                  </p>
                  {showUnderstood && (
                    <p className="spelling-note" role="status">
                      Showing results for{' '}
                      <strong>
                        {[
                          search.words.length ? `“${search.words.map(displayWord).join(' ')}”` : 'all products',
                          ...search.understood,
                        ].join(' · ')}
                      </strong>
                      {search.corrections.length > 0 && (
                        <span className="spelling-typed"> (you typed “{filters.query.trim()}”)</span>
                      )}
                    </p>
                  )}
                  {search.note && (
                    <p className="search-relaxed" role="status">
                      {search.note}
                    </p>
                  )}
                  {chips.length > 0 && (
                    <div className="active-filters">
                      {chips.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          className="filter-chip"
                          onClick={() => update({ ...filters, ...chip.clear })}
                          aria-label={`Remove filter ${chip.label}`}
                        >
                          {chip.label} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                      <button type="button" className="text-link clear-all" onClick={clearAll}>
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
                {visible.length === 0 ? (
                  <div className="status empty-results">
                    <p>No products match these filters.</p>
                    <button type="button" className="btn btn-primary btn-small" onClick={clearAll}>
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  <div className="product-grid">
                    {visible.map((p) => (
                      <ProductCard key={p.product_id} product={p} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
