import crypto from "crypto"

const API_PREFIX = '/api/server'
const ACCESS_TOKEN_COOKIE = 'pik5_server_access'
const ACCESS_TOKEN_TTL_SEC = 60 * 10
const ACCESS_TOKEN_SECRET = process.env.SERVER_API_TOKEN_SECRET
  || process.env.NEXTAUTH_SECRET
  || (process.env.NODE_ENV !== 'production' ? 'pik5-local-dev-secret-change-me' : '')

function getRequestHost(req) {
  return (req.headers['x-forwarded-host'] || req.headers.host || '').toString().toLowerCase()
}

function getRequestProtocol(req) {
  const forwardedProto = req.headers['x-forwarded-proto']
  if (typeof forwardedProto === 'string' && forwardedProto.length > 0) {
    return forwardedProto.split(',')[0].trim().toLowerCase()
  }

  const originProtocol = getNormalizedOrigin(req.headers.origin)
  if (originProtocol) {
    try {
      return new URL(originProtocol).protocol.replace(':', '').toLowerCase()
    } catch {
      // noop
    }
  }

  const refererProtocol = getNormalizedOrigin(req.headers.referer)
  if (refererProtocol) {
    try {
      return new URL(refererProtocol).protocol.replace(':', '').toLowerCase()
    } catch {
      // noop
    }
  }

  return req.socket?.encrypted ? 'https' : 'http'
}

function getNormalizedOrigin(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return null
  try {
    const parsed = new URL(rawValue)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return null
  }
}

function getNormalizedHost(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return null
  try {
    return new URL(rawValue).host.toLowerCase()
  } catch {
    return null
  }
}

function isSameOriginBrowserRequest(req) {
  const host = getRequestHost(req)
  if (!host) return false

  const expectedOrigin = `${getRequestProtocol(req)}://${host}`
  const origin = getNormalizedOrigin(req.headers.origin)
  const referer = getNormalizedOrigin(req.headers.referer)
  const originHost = getNormalizedHost(req.headers.origin)
  const refererHost = getNormalizedHost(req.headers.referer)
  const secFetchSite = (req.headers['sec-fetch-site'] || '').toString().toLowerCase()

  const originMatch = origin ? origin === expectedOrigin : false
  const refererMatch = referer ? referer === expectedOrigin : false
  const originHostMatch = originHost ? originHost === host : false
  const refererHostMatch = refererHost ? refererHost === host : false
  const fetchSiteOk = !secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'same-site'

  if (!fetchSiteOk) return false
  if (originMatch || refererMatch) return true

  // TLS終端が手前のプロキシにあると、Node 側で http 扱いになり protocol だけ不一致になることがある。
  // その場合でも same-site 判定と host 一致が取れていれば同一サイトのブラウザ要求として扱う。
  return originHostMatch || refererHostMatch
}

function createAccessToken() {
  if (!ACCESS_TOKEN_SECRET) return null

  const payload = JSON.stringify({
    exp: Date.now() + ACCESS_TOKEN_TTL_SEC * 1000,
    nonce: crypto.randomBytes(16).toString('hex'),
  })
  const payloadB64 = Buffer.from(payload).toString('base64url')
  const signature = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payloadB64).digest('base64url')
  return `${payloadB64}.${signature}`
}

function verifyAccessToken(token) {
  if (!ACCESS_TOKEN_SECRET || typeof token !== 'string') return false

  const parts = token.split('.')
  if (parts.length !== 2) return false

  const payloadB64 = parts[0]
  const receivedSignature = parts[1]
  const expectedSignature = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payloadB64).digest('base64url')
  const receivedBuffer = Buffer.from(receivedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (receivedBuffer.length !== expectedBuffer.length) return false

  const isValidSignature = crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  if (!isValidSignature) return false

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    return typeof payload?.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

function appendSetCookie(res, cookieValue) {
  const prev = res.getHeader('Set-Cookie')
  if (!prev) {
    res.setHeader('Set-Cookie', cookieValue)
    return
  }
  const next = Array.isArray(prev) ? [...prev, cookieValue] : [prev.toString(), cookieValue]
  res.setHeader('Set-Cookie', next)
}

function issueAccessTokenCookie(res) {
  const token = createAccessToken()
  if (!token) return false

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const cookie = `${ACCESS_TOKEN_COOKIE}=${token}; Path=${API_PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${ACCESS_TOKEN_TTL_SEC}${secure}`
  appendSetCookie(res, cookie)
  return true
}

export function ensureServerApiAccess(req, res) {
  const currentToken = req.cookies?.[ACCESS_TOKEN_COOKIE]
  const hasValidToken = verifyAccessToken(currentToken)
  if (hasValidToken) return true

  const canIssueToken = isSameOriginBrowserRequest(req)
  if (!canIssueToken) return false

  return issueAccessTokenCookie(res)
}
