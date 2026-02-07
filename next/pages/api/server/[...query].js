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

const LARAVEL_API_BASE = 'http://laravel:8000/api'

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
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

  const searchParams = buildSearchParams(req.query)
  const upstreamUrl = `${LARAVEL_API_BASE}/${path}` + (searchParams.toString() ? `?${searchParams.toString()}` : '')

  try {
    switch (req.method) {
      case "GET": {
        const upstreamRes = await fetch(upstreamUrl)
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
            },
            body: req,
            duplex: 'half',
          })
        } else {
          const raw = await readRawBody(req)
          upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
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

    await prisma.log?.create({
        data: {
            userId: id,
            page: page,
            query: stringifyQuery(query),
            ip: getIpAddress()
        },
    });
}
// ログの文字数はmediumTextを超えてはならない
function truncateIfTooLong(input) {
    if (input.length > 16777215 ) {
        return input.substring(0, 16777215);
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
