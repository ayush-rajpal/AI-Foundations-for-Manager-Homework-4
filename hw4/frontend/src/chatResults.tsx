import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PageResults } from './types'

// Products the chatbot found for the customer, shown on the Products page.
// Kept in sessionStorage so a page refresh doesn't lose them.

const STORAGE_KEY = 'cc_chat_results'

interface ChatResultsState {
  results: PageResults | null
  showResults: (results: PageResults) => void
  clearResults: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

function load(): PageResults | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PageResults) : null
  } catch {
    return null
  }
}

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<PageResults | null>(load)

  const showResults = (next: PageResults) => {
    setResults(next)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const clearResults = () => {
    setResults(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return (
    <ChatResultsContext.Provider value={{ results, showResults, clearResults }}>{children}</ChatResultsContext.Provider>
  )
}

export function useChatResults() {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside <ChatResultsProvider>')
  return ctx
}
