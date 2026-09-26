import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { postJson } from './api'
import type { User } from './types'

export interface RegisterData {
  first_name: string
  last_name: string
  email: string
  password: string
  phone: string | null
  phone_country: string | null
}

interface AuthState {
  user: User | null
  loading: boolean // true until we know whether a session cookie is still valid
  login: (email: string, password: string) => Promise<User>
  register: (data: RegisterData) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The session lives in an HttpOnly cookie; ask the backend who it belongs to.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user: User | null }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { user } = await postJson<{ user: User }>('/api/auth/login', { email, password })
    setUser(user)
    return user
  }

  const register = async (data: RegisterData) => {
    const { user } = await postJson<{ user: User }>('/api/auth/register', data)
    setUser(user)
    return user
  }

  const logout = async () => {
    await postJson('/api/auth/logout', {})
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
