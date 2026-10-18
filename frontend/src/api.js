const configuredApiBase = import.meta.env?.VITE_API_BASE_URL?.trim() || ''
const apiBase = configuredApiBase.replace(/\/+$/, '')

export function apiUrl(path) {
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path)) return path
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`
}

export function backendAssetUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/uploads/')) return path
  return apiUrl(path)
}

export async function requestJson(url, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(apiUrl(url), { credentials: 'include', ...options, headers })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que el backend esté activo.')
  }

  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json') ? await response.json().catch(() => null) : null
  if (!response.ok || !result?.success) {
    const error = new Error(result?.error || `El servidor respondió con el estado ${response.status}.`)
    error.status = response.status
    throw error
  }
  return result
}

export function safeReturnTo(value, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const destination = new URL(value, window.location.origin)
    return destination.origin === window.location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : fallback
  } catch {
    return fallback
  }
}
