import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30s — Render free tier cold starts can take 15-20s
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Retry up to 2 times on network errors and Render gateway errors (502/503/504).
// Render free tier returns 502 from its gateway ~20% of the time under concurrent
// load — single retry isn't enough, so we do exponential backoff (1s, 3s).
const RETRYABLE_STATUSES = [502, 503, 504]
const MAX_RETRIES = 2

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (!config) return Promise.reject(error)

    const status = error.response?.status
    const isRetryable = !error.response || RETRYABLE_STATUSES.includes(status)

    config._retryCount = config._retryCount || 0
    if (isRetryable && config._retryCount < MAX_RETRIES) {
      config._retryCount++
      const delay = config._retryCount === 1 ? 1000 : 3000
      await new Promise(r => setTimeout(r, delay))
      return api(config)
    }

    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
