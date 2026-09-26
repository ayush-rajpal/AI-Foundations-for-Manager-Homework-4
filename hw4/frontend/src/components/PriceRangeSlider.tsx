import { useEffect, useState, type KeyboardEvent } from 'react'

interface Props {
  bounds: [number, number] // cheapest and most expensive price in the catalogue
  value: [number, number] // selected min and max
  onChange: (value: [number, number]) => void
}

// Two-handle price slider plus Min / Max boxes. Dragging a handle updates the boxes;
// typing a price and pressing Enter (or leaving the box) moves the handle.
export default function PriceRangeSlider({ bounds, value, onChange }: Props) {
  const [lo, hi] = value
  const [floor, ceiling] = bounds
  const [minText, setMinText] = useState(String(lo))
  const [maxText, setMaxText] = useState(String(hi))

  useEffect(() => setMinText(String(lo)), [lo])
  useEffect(() => setMaxText(String(hi)), [hi])

  const clamp = (n: number) => Math.min(ceiling, Math.max(floor, Math.round(n)))

  const commit = () => {
    const min = Number(minText)
    const max = Number(maxText)
    let nextLo = Number.isFinite(min) && minText.trim() !== '' ? clamp(min) : floor
    let nextHi = Number.isFinite(max) && maxText.trim() !== '' ? clamp(max) : ceiling
    if (nextLo > nextHi) [nextLo, nextHi] = [nextHi, nextLo]
    setMinText(String(nextLo))
    setMaxText(String(nextHi))
    if (nextLo !== lo || nextHi !== hi) onChange([nextLo, nextHi])
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
  }

  const span = ceiling - floor || 1
  const left = ((lo - floor) / span) * 100
  const right = 100 - ((hi - floor) / span) * 100

  return (
    <div className="price-range">
      <div className="range-slider">
        <div className="range-track" />
        <div className="range-fill" style={{ left: `${left}%`, right: `${right}%` }} />
        <input
          type="range"
          min={floor}
          max={ceiling}
          step={1}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={floor}
          max={ceiling}
          step={1}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          aria-label="Maximum price"
        />
      </div>

      <div className="price-inputs">
        <label>
          Min
          <span className="price-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={floor}
              max={ceiling}
              value={minText}
              onChange={(e) => setMinText(e.target.value)}
              onBlur={commit}
              onKeyDown={onEnter}
              aria-label="Minimum price in dollars"
            />
          </span>
        </label>
        <span className="price-dash" aria-hidden="true">
          –
        </span>
        <label>
          Max
          <span className="price-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={floor}
              max={ceiling}
              value={maxText}
              onChange={(e) => setMaxText(e.target.value)}
              onBlur={commit}
              onKeyDown={onEnter}
              aria-label="Maximum price in dollars"
            />
          </span>
        </label>
      </div>
    </div>
  )
}
