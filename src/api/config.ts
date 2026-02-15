// In development, requests go through Vite's proxy (/api/...)
// In production, requests go directly to the configured backend URL
const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080')

export const API_ENDPOINTS = {
  svgConversion: `${API_BASE_URL}/svg-conversion/vtrace`,
} as const
