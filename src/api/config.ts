// All requests go through /api proxy (Vite dev proxy or Nginx reverse proxy)
const API_BASE_URL = '/api'

export const API_ENDPOINTS = {
  svgConversion: `${API_BASE_URL}/svg-conversion/vtrace`,
} as const
