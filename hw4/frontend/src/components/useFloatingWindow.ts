import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// A movable, resizable floating window (used by the chat panel).
// Drag the header to move it, drag a corner to resize it, or use the keyboard on the header:
// arrow keys move, Shift + arrow keys resize. Position and size are remembered in localStorage.
// On small screens (under 640 px wide) it stays a fixed panel, since there's no room to move it.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export type Corner = 'nw' | 'ne' | 'sw' | 'se'

const MIN_W = 300
const MIN_H = 360
const MARGIN = 8 // keep the window at least this far inside the browser edges
const STEP = 20 // keyboard move / resize step in px
const STORAGE_KEY = 'cc_chat_window'
const DESKTOP_QUERY = '(min-width: 640px)'

function defaultRect(): Rect {
  const w = Math.min(400, window.innerWidth - 32)
  const h = Math.min(600, window.innerHeight - 110)
  return { x: window.innerWidth - w - 24, y: window.innerHeight - h - 24, w, h }
}

/** Keep the window on screen and within its minimum / maximum size. */
function clamp(r: Rect): Rect {
  const maxW = window.innerWidth - 2 * MARGIN
  const maxH = window.innerHeight - 2 * MARGIN
  const w = Math.max(Math.min(MIN_W, maxW), Math.min(r.w, maxW))
  const h = Math.max(Math.min(MIN_H, maxH), Math.min(r.h, maxH))
  const x = Math.min(Math.max(r.x, MARGIN), window.innerWidth - w - MARGIN)
  const y = Math.min(Math.max(r.y, MARGIN), window.innerHeight - h - MARGIN)
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

function load(): Rect | null {
  try {
    const r = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Rect | null
    return r && [r.x, r.y, r.w, r.h].every(Number.isFinite) ? clamp(r) : null
  } catch {
    return null
  }
}

export function useFloatingWindow() {
  const [rect, setRect] = useState<Rect>(() => load() ?? defaultRect())
  const [enabled, setEnabled] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  const [active, setActive] = useState<'move' | 'resize' | null>(null)
  const rectRef = useRef(rect)
  rectRef.current = rect

  // Remember position and size (only once the customer has moved or resized it).
  const save = (r: Rect) => localStorage.setItem(STORAGE_KEY, JSON.stringify(r))

  // Turn floating on/off with the screen width, and keep the window on screen when the browser resizes.
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    const onMedia = () => setEnabled(media.matches)
    const onResize = () => {
      setEnabled(media.matches)
      setRect((r) => clamp(r))
    }
    media.addEventListener('change', onMedia)
    window.addEventListener('resize', onResize)
    return () => {
      media.removeEventListener('change', onMedia)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const track = useCallback((e: PointerEvent, mode: 'move' | 'resize', update: (start: Rect, dx: number, dy: number) => Rect) => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = rectRef.current
    const [px, py] = [e.clientX, e.clientY]
    setActive(mode)
    const onMove = (ev: globalThis.PointerEvent) => setRect(clamp(update(start, ev.clientX - px, ev.clientY - py)))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setActive(null)
      save(rectRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  /** Header: drag to move (clicks on the header's buttons are ignored). */
  const onDragStart = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    track(e, 'move', (s, dx, dy) => ({ ...s, x: s.x + dx, y: s.y + dy }))
  }

  /** Corner handle: drag to resize, keeping the opposite corner where it is. */
  const onResizeStart = (corner: Corner) => (e: PointerEvent<HTMLElement>) =>
    track(e, 'resize', (s, dx, dy) => {
      const left = corner === 'nw' || corner === 'sw'
      const top = corner === 'nw' || corner === 'ne'
      const w = Math.max(MIN_W, left ? s.w - dx : s.w + dx)
      const h = Math.max(MIN_H, top ? s.h - dy : s.h + dy)
      return { w, h, x: left ? s.x + s.w - w : s.x, y: top ? s.y + s.h - h : s.y }
    })

  /** Header keyboard control: arrows move, Shift + arrows resize. */
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d || (e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const [dx, dy] = [d[0] * STEP, d[1] * STEP]
    const r = rectRef.current
    const next = clamp(e.shiftKey ? { ...r, w: r.w + dx, h: r.h + dy } : { ...r, x: r.x + dx, y: r.y + dy })
    setRect(next)
    save(next)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRect(defaultRect())
  }

  const style = enabled
    ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, right: 'auto', bottom: 'auto' }
    : undefined

  return { enabled, active, style, onDragStart, onResizeStart, onKeyDown, reset }
}
