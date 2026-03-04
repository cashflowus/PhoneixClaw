import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/api'

const TOKEN_KEY = 'phoenix_token'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

interface LoginResponse {
  access_token: string
  user: AuthUser
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = useMemo(() => !!user, [user])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`
    api
      .get<AuthUser>('/api/v2/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        delete api.defaults.headers.common.Authorization
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/api/v2/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data } = await api.post<LoginResponse>('/api/v2/auth/register', { email, password, name })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    delete api.defaults.headers.common.Authorization
    setUser(null)
  }, [])

  return { user, isLoading, login, register, logout, isAuthenticated }
}
