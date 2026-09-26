import { CATEGORIES, categoryOf, type Category } from '../api'
import { applyFilters, countBy, SWATCHES, titleCase, type Filters } from '../productFilters'
import type { Product } from '../types'
import PriceRangeSlider from './PriceRangeSlider'

interface Props {
  products: Product[] // the whole catalogue
  filters: Filters
  priceBounds: [number, number]
  onChange: (next: Filters) => void
}

const toggle = <T,>(items: T[], item: T) => (items.includes(item) ? items.filter((i) => i !== item) : [...items, item])

// Sidebar with Product type, Color, and Price filters. Counts next to each option show how
// many products it would give, taking the other filters into account.
export default function ProductFilters({ products, filters, priceBounds, onChange }: Props) {
  const typeCounts = countBy(applyFilters(products, filters, 'types'), (p) => categoryOf(p.garment_type))
  const colorCounts = countBy(applyFilters(products, filters, 'colors'), (p) => p.primary_color)
  // Every primary color in the catalogue, most common first, so options don't jump around.
  const allColors = [...countBy(products, (p) => p.primary_color).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([color]) => color)

  const [lo, hi] = [filters.minPrice ?? priceBounds[0], filters.maxPrice ?? priceBounds[1]]
  const setPrice = ([min, max]: [number, number]) =>
    onChange({
      ...filters,
      minPrice: min <= priceBounds[0] ? null : min,
      maxPrice: max >= priceBounds[1] ? null : max,
    })

  return (
    <div className="filter-panel">
      <fieldset className="filter-group">
        <legend>
          Product type
          {filters.types.length > 0 && (
            <button type="button" className="filter-clear" onClick={() => onChange({ ...filters, types: [] })}>
              Clear
            </button>
          )}
        </legend>
        {CATEGORIES.map((type: Category) => {
          const count = typeCounts.get(type) ?? 0
          const checked = filters.types.includes(type)
          return (
            <label key={type} className={`filter-option${count === 0 && !checked ? ' empty' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange({ ...filters, types: toggle(filters.types, type) })}
              />
              <span className="filter-label">{type}</span>
              <span className="filter-count">{count}</span>
            </label>
          )
        })}
      </fieldset>

      <fieldset className="filter-group">
        <legend>
          Color
          {filters.colors.length > 0 && (
            <button type="button" className="filter-clear" onClick={() => onChange({ ...filters, colors: [] })}>
              Clear
            </button>
          )}
        </legend>
        {allColors.map((color) => {
          const count = colorCounts.get(color) ?? 0
          const checked = filters.colors.includes(color)
          return (
            <label key={color} className={`filter-option${count === 0 && !checked ? ' empty' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange({ ...filters, colors: toggle(filters.colors, color) })}
              />
              <span className="swatch" style={{ background: SWATCHES[color] ?? '#ccc' }} aria-hidden="true" />
              <span className="filter-label">{titleCase(color)}</span>
              <span className="filter-count">{count}</span>
            </label>
          )
        })}
      </fieldset>

      <fieldset className="filter-group">
        <legend>
          Price
          {(filters.minPrice !== null || filters.maxPrice !== null) && (
            <button
              type="button"
              className="filter-clear"
              onClick={() => onChange({ ...filters, minPrice: null, maxPrice: null })}
            >
              Clear
            </button>
          )}
        </legend>
        <PriceRangeSlider bounds={priceBounds} value={[lo, hi]} onChange={setPrice} />
      </fieldset>
    </div>
  )
}
