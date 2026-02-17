export const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://pik5.net'

export function normalizePath(path) {
  const raw = String(path || '/')
    .split('#')[0]
    .split('?')[0]
    .trim()

  if (!raw || raw === '/') return '/'

  const prefixed = raw.startsWith('/') ? raw : `/${raw}`
  return prefixed.replace(/\/+$/, '') || '/'
}

export function stripLocalePrefix(path) {
  return normalizePath(path).replace(/^\/(ja|en)(?=\/|$)/, '') || '/'
}

export function buildLocalizedPath(path, locale) {
  const basePath = stripLocalePrefix(path)

  if (locale === 'en') {
    return basePath === '/' ? '/en' : `/en${basePath}`
  }

  return basePath
}

export function toAbsoluteUrl(path) {
  return `${siteOrigin}${normalizePath(path)}`
}
