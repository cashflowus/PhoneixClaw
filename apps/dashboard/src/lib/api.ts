/**
 * API client for Phoenix v2 Backend.
 * Centralized HTTP client with auth token injection.
 */
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('phoenix-v2-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('phoenix-v2-token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
