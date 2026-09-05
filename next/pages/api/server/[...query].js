export const config = {
  api: {
    bodyParser: false,
  },
}
import prisma from "../../../lib/prisma";
import {networkInterfaces} from "os";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../auth/[...nextauth]";
import {ensureServerApiAccess} from "../../../lib/serverApiAccess";
import {tricksIdentityHeaders, tricksTestIdentityHeaders} from "../../../lib/tricks/proxyAuth";

const LARAVEL_API_BASE = process.env.TRICKS_LARAVEL_API_BASE || 'http://laravel:8000/api'
const MAX_RAW_BODY_BYTES = 1024 * 1024

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0
    req.on('data', (c) => {
      const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c)
      totalBytes += chunk.length
      if (totalBytes > MAX_RAW_BODY_BYTES) {
        const error = new Error('request body too large')
        error.code = 'REQUEST_BODY_TOO_LARGE'
        reject(error)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function getSafeQueryPath(rawQuery) {
  if (!Array.isArray(rawQuery) || rawQuery.length === 0) return null

  const segments = rawQuery
    .map((segment) => String(segment || '').trim())
    .filter(Boolean)

  if (segments.length === 0) return null
  if (segments.some((segment) => segment.includes('..') || segment.includes('/') || segment.includes('?') || segment.includes('#'))) {
    return null
  }

  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

function buildSearchParams(queryObject) {
  const params = new URLSearchParams()
  Object.entries(queryObject).forEach(([key, value]) => {
    if (key === 'query') return
    const values = Array.isArray(value) ? value : [value]
    values.forEach((v) => {
      if (v === undefined || v === null) return
      params.append(key, String(v))
    })
  })
  return params
}

async function parseUpstreamResponse(upstreamRes) {
  const raw = await upstreamRes.text()
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function getForwardedFor(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded.join(', ')
  return req.socket?.remoteAddress || ''
}

export default async function handle(req, res){

  const session = await getServerSession(req, res, authOptions)

  if (!ensureServerApiAccess(req, res)) {
    await prismaLogging(session?.user?.id ?? "guest", "queryAccessDenied", {
      method: req.method,
      path: req.url,
    })
    res.status(403).json({error: true, message: 'forbidden'})
    return
  }

  const path = getSafeQueryPath(req.query.query)
  if (!path) {
    res.status(400).json({error: true, message: 'invalid path'})
    return
  }

  // 記録更新は認証と本人性を強制する専用 /api/server/post だけに限定する
  if (req.method === 'POST' && (path === 'record' || path.startsWith('record/'))) {
    res.status(405).json({error: true, message: 'use authenticated record endpoint'})
    return
  }

  const searchParams = buildSearchParams(req.query)
  const upstreamUrl = `${LARAVEL_API_BASE}/${path}` + (searchParams.toString() ? `?${searchParams.toString()}` : '')
  const testIdentityHeaders = tricksTestIdentityHeaders(req.headers)
  const identityHeaders = path.startsWith('tricks/')
    ? Object.keys(testIdentityHeaders).length > 0
      ? testIdentityHeaders
      : path === 'tricks/maintenance/collect-expired'
        ? tricksIdentityHeaders('system', 10)
      : tricksIdentityHeaders(session?.user?.userId || session?.user?.id, session?.user?.role)
    : {}
  try {
    switch (req.method) {
      case "GET": {
        const upstreamRes = await fetch(upstreamUrl, {headers: identityHeaders})
        const data = await parseUpstreamResponse(upstreamRes)

        if (!upstreamRes.ok) {
          await prismaLogging(session?.user?.id ?? "guest", "queryGetErrorUpstream", {status: upstreamRes.status})
          res.status(upstreamRes.status).json({error: true, status: upstreamRes.status, data})
          return
        }

        res.status(upstreamRes.status).json({data})
        return
      }
      case "POST": {
        await prismaLogging(session?.user?.id ?? "guest", "queryPost", {
          path,
          contentType: req.headers['content-type'] || '',
          length: req.headers['content-length'] || '',
        })

        const contentType = (req.headers['content-type'] || '').toLowerCase()
        let upstreamRes

        if (contentType.startsWith('multipart/form-data')) {
          upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              'content-type': req.headers['content-type'] || '',
              ...(req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
              'x-forwarded-for': getForwardedFor(req),
              'x-real-ip': String(req.headers['x-real-ip'] || req.socket?.remoteAddress || ''),
              'x-forwarded-proto': String(req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')),
              'x-forwarded-host': String(req.headers.host || ''),
              ...identityHeaders,
            },
            body: req,
            duplex: 'half',
          })
        } else {
          const contentLength = Number(req.headers['content-length'] || 0)
          if (Number.isFinite(contentLength) && contentLength > MAX_RAW_BODY_BYTES) {
            res.status(413).json({error: true, message: 'request body too large'})
            return
          }
          const raw = await readRawBody(req)
          upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
              'x-forwarded-for': getForwardedFor(req),
              'x-real-ip': String(req.headers['x-real-ip'] || req.socket?.remoteAddress || ''),
              'x-forwarded-proto': String(req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')),
              'x-forwarded-host': String(req.headers.host || ''),
              ...identityHeaders,
            },
            body: raw,
          })
        }

        const data = await parseUpstreamResponse(upstreamRes)
        if (!upstreamRes.ok) {
          await prismaLogging(session?.user?.id ?? "guest", "queryPostErrorUpstream", {status: upstreamRes.status})
          res.status(upstreamRes.status).json({error: true, status: upstreamRes.status, data})
          return
        }

        res.status(upstreamRes.status).json({data})
        return
      }
      default: {
        res.setHeader('Allow', 'GET, POST')
        res.status(405).json({error: true, message: 'method not allowed'})
        return
      }
    }
  } catch (error) {
    if (error?.code === 'REQUEST_BODY_TOO_LARGE') {
      res.status(413).json({error: true, message: 'request body too large'})
      return
    }
    await prismaLogging(session?.user?.id ?? "guest", "queryProxyError", String(error))
    res.status(502).json({error: true, message: 'proxy error'})
  }
}

// IPアドレスを取得
export function getIpAddress() {
    const nets = networkInterfaces()
    for (const interfaceName in nets) {
        const net = nets[interfaceName].find((v) => v.family === 'IPv4')
        if (net && !net.internal) {
            return net.address
        }
    }
    return ""
}
// 各リクエストをログテーブルへ送信
export async function prismaLogging(id, page, query) {
    try {
        await prisma.log?.create({
            data: {
                userId: id,
                page: page,
                query: stringifyQuery(query),
                ip: getIpAddress()
            },
        })
        return true
    } catch (error) {
        // 監査ログの一時障害でゲームAPI自体を停止させない
        return false
    }
}
// ログの文字数はmediumTextを超えてはならない
function truncateIfTooLong(input) {
    if (input.length > 16384 ) {
        return input.substring(0, 16384);
    } else {
        return input;
    }
}
// オブジェクトを連結して文字列に変換
function stringifyQuery(query) {
    // もし query がオブジェクトまたは配列なら、要素を連結して文字列にする
    if (typeof query === 'object' && query !== null) {
        const flattenQuery = (obj, parentKey = '') => {
            return Object.keys(obj).map(key => {
                const value = obj[key]
                const newKey = parentKey ? `${parentKey}[${key}]` : key

                if (typeof value === 'object' && value !== null) {
                    // もしオブジェクトが含まれていたら再帰的に処理
                    return flattenQuery(value, newKey)
                } else {
                    return `${encodeURIComponent(newKey)}=${encodeURIComponent(value)}`
                }
            }).join('&')
        };

        const result = flattenQuery(query)

        // 文字列が長すぎる場合に切り捨て
        return truncateIfTooLong(result)
    }

    // もし query が文字列ならそのまま返す
    if (typeof query === 'string') {

        // 文字列が長すぎる場合に切り捨て
        return truncateIfTooLong(query)
    }

    // 上記以外の場合は空文字列を返すか、エラー処理を追加することもできます
    return ''
}
