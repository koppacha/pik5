const SPEEDRUN_USER_CACHE_PREFIX = 'pik5:speedrun:user:'
const SPEEDRUN_USER_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000

function getStorageKey(userId) {
  return `${SPEEDRUN_USER_CACHE_PREFIX}${userId}`
}

export function getSpeedrunUserCache(userId) {
  if (!userId || typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(getStorageKey(userId))
      return null
    }

    return parsed.data || null
  } catch {
    return null
  }
}

export function setSpeedrunUserCache(userId, data) {
  if (!userId || !data || typeof window === 'undefined') return

  try {
    const payload = {
      data,
      expiresAt: Date.now() + SPEEDRUN_USER_CACHE_TTL_MS,
    }
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(payload))
  } catch {
    // ignore storage errors (quota/private mode)
  }
}

