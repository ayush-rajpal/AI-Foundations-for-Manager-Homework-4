import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import { formatPrice, postJson } from '../api'
import { useAuth } from '../auth'
import { useChatResults } from '../chatResults'
import { useShop } from '../shop'
import type { PageResults, Product } from '../types'
import BulldogAvatar from './BulldogAvatar'
import { useFloatingWindow, type Corner } from './useFloatingWindow'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  viewingProductId?: string // product page a customer message was sent from (Rule 1: context)
  local?: boolean // greeting or error shown only in the browser; never sent to the agent
}

interface ChatResponse {
  reply: string
  products: Product[]
  page: PageResults | null // set when the agent's search should fill the page
  cart_changed: boolean // the chatbot added something to the cart
  tools_used: string[]
}

const MAX_HISTORY = 20 // turns sent along for guests (logged-in history lives on the server)

// Where the customer is on the site, sent with every message so the agent knows what
// "this" means on a product page. The backend checks it against the database.
interface PageContext {
  path: string
  product_id?: string
  category?: string
  search?: string
  collection?: string
  chat_results_title?: string
}

function pageContext(pathname: string, search: string, chatResultsTitle?: string): PageContext {
  const params = new URLSearchParams(search)
  const productMatch = pathname.match(/^\/products\/([^/]+)$/)
  const context: PageContext = { path: pathname }
  if (productMatch) context.product_id = decodeURIComponent(productMatch[1])
  if (pathname === '/products') {
    if (params.get('from') === 'chat' && chatResultsTitle) context.chat_results_title = chatResultsTitle
    // One product type selected -> tell the agent (the backend only accepts a single known category).
    const types = (params.get('type') ?? params.get('category') ?? '').split(',').filter(Boolean)
    if (types.length === 1) context.category = types[0]
    for (const [key, param] of [['search', 'q'], ['collection', 'collection']] as const) {
      const value = params.get(param)
      if (value) context[key] = value
    }
  }
  return context
}

const greeting = (firstName?: string | null): ChatMessage => ({
  role: 'assistant',
  content: `Hi${firstName ? ` ${firstName}` : ''}! I'm the Campus Customs assistant. Ask me about Yale gear, sizes, prices, or what's in stock.`,
  local: true,
})

export default function ChatWidget() {
  const { user, loading } = useAuth()
  const { results: chatResults, showResults } = useChatResults()
  const { refreshCart } = useShop()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()])
  const listRef = useRef<HTMLDivElement>(null)
  const floating = useFloatingWindow()

  // Load the saved conversation when a customer logs in; start fresh when they log out.
  useEffect(() => {
    if (loading) return
    if (!user) {
      setMessages([greeting()])
      return
    }
    let cancelled = false
    fetch('/api/chat/history')
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages: ChatMessage[] }) => {
        if (!cancelled) setMessages(data.messages.length ? data.messages : [greeting(user.first_name)])
      })
      .catch(() => !cancelled && setMessages([greeting(user.first_name)]))
    return () => {
      cancelled = true
    }
  }, [user?.id, loading])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, open])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return

    const history = messages
      .filter((m) => !m.local)
      .slice(-MAX_HISTORY)
      .map(({ role, content, viewingProductId }) => ({ role, content, viewing_product_id: viewingProductId ?? null }))
    const page = pageContext(location.pathname, location.search, chatResults?.title)
    setMessages((m) => [...m, { role: 'user', content: text, viewingProductId: page.product_id }])
    setInput('')
    setPending(true)
    try {
      const res = await postJson<ChatResponse>('/api/chat', { message: text, history, page })
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, products: res.products }])
      if (res.cart_changed) refreshCart() // update the cart badge
      if (res.page && res.page.products.length > 0) {
        // Show every match on the Products page; the chat panel stays open.
        showResults(res.page)
        navigate('/products?from=chat')
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: (err as Error).message, local: true }])
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button className="chat-launcher" onClick={() => setOpen(true)} aria-label="Open chat assistant: How can I help?">
        <BulldogAvatar size={34} />
        How can I help?
      </button>
    )
  }

  const panelClass = [
    'chat-panel',
    floating.enabled && 'floating',
    floating.active === 'move' && 'is-moving',
    floating.active === 'resize' && 'is-resizing',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={panelClass} aria-label="Chatbot" style={floating.style}>
      <header
        className="chat-header"
        onPointerDown={floating.enabled ? floating.onDragStart : undefined}
        onKeyDown={floating.enabled ? floating.onKeyDown : undefined}
        onDoubleClick={floating.enabled ? floating.reset : undefined}
        tabIndex={floating.enabled ? 0 : undefined}
        aria-label={
          floating.enabled
            ? 'Chat window. Drag to move; arrow keys move, Shift plus arrow keys resize; double-click to reset.'
            : undefined
        }
        title={floating.enabled ? 'Drag to move · double-click to reset' : undefined}
      >
        <span className="chat-title">
          <BulldogAvatar size={30} />
          How can I help?
        </span>
        <span className="chat-header-actions">
          {floating.enabled && (
            <button onClick={floating.reset} aria-label="Reset chat window position and size" title="Reset position and size">
              ⤢
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close chatbot" title="Close">
            ×
          </button>
        </span>
      </header>

      <div className="chat-messages" ref={listRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`chat-turn ${m.role}`}>
            <div className={`chat-bubble ${m.role}`}>
              {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
            </div>
            {m.products && m.products.length > 0 && (
              <div className="chat-products">
                {m.products.map((p) => (
                  <Link key={p.product_id} to={`/products/${p.product_id}`} className="chat-product">
                    <img src={p.image_url} alt="" />
                    <span className="chat-product-name">{p.name}</span>
                    <span className="chat-product-price">{formatPrice(p.price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && (
          <div className="chat-bubble assistant typing" aria-label="Assistant is typing">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about hoodies, sizes, prices…"
          maxLength={2000}
          autoFocus
        />
        <button type="submit" disabled={!input.trim() || pending}>
          Send
        </button>
      </form>

      {floating.enabled &&
        (['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
          <span
            key={corner}
            className={`chat-resize chat-resize-${corner}`}
            onPointerDown={floating.onResizeStart(corner)}
            aria-hidden="true"
          />
        ))}
    </section>
  )
}
