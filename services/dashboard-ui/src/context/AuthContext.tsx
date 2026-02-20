import { createContext, useState, useCallback, ReactNode } from 'react'
import axios from 'axios'

interface AuthContextType {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post('/auth/login', { email, password })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await axios.post('/auth/register', { email, password, name })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    delete axios.defaults.headers.common['Authorization']
  }, [])

  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  return <AuthContext.Provider value={{ token, login, register, logout }}>{children}</AuthContext.Provider>
}
