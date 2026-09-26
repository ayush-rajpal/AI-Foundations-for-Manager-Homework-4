import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import SizeGuide from './SizeGuide'

// Pop-up showing the US size guide (used on product pages). Closes with the black ×, Escape,
// or a click outside.
export default function SizeGuideModal({ highlight, onClose }: { highlight?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="size-modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close size guide">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="guide-title">Size guide</h2>
        <p className="guide-sub">Find your size in US measurements. Your selected size is highlighted.</p>
        <SizeGuide highlight={highlight} />
      </div>
    </div>,
    document.body,
  )
}
