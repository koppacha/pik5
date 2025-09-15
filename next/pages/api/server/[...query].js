export const config = {
  api: {
    bodyParser: false,
  },
}
import {logger} from "../../../lib/logger";
import fetch from "node-fetch";
import prisma from "../../../lib/prisma";
import {networkInterfaces} from "os";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../auth/[...nextauth]";

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handle(req, res){

    const session = await getServerSession(req, res, authOptions)

    return new Promise(async resolve => {
        switch (req.method) {
            case "POST": {
                try {
                    const query = req.query.query.join("/")
                    await prismaLogging(session?.user?.id ?? "guest", "queryPost", { headers: req.headers, length: req.headers['content-length'] })

                    const contentType = (req.headers['content-type'] || '').toLowerCase()
                    let upstreamRes

                    if (contentType.startsWith('multipart/form-data')) {
                        // Pass through the original stream and headers (including boundary)
                        upstreamRes = await fetch(`http://laravel:8000/api/${query}`, {
                            method: 'POST',
                            // Preserve content-type (with boundary) and content-length if present
                            headers: {
                                'content-type': req.headers['content-type'] || '',
                                ...(req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {})
                            },
                            body: req
                        })
                    } else if (contentType.includes('application/json')) {
                        // bodyParser is disabled, so req.body is undefined. Read raw JSON and forward as-is.
                        const raw = await readRawBody(req)
                        // Optional: try to log a tiny preview to ensure 'keyword' exists without leaking full content
                        let preview = null
                        try { preview = JSON.parse(raw.toString('utf8')) } catch {}
                        await prismaLogging(session?.user?.id ?? "guest", "queryPostJsonPreview", {
                          hasKeyword: preview && typeof preview === 'object' && Object.prototype.hasOwnProperty.call(preview, 'keyword'),
                          keys: preview && typeof preview === 'object' ? Object.keys(preview).slice(0, 10) : []
                        })

                        upstreamRes = await fetch(`http://laravel:8000/api/${query}`, {
                            method: 'POST',
                            headers: { 'content-type': req.headers['content-type'] || 'application/json' },
                            body: raw
                        })
                    } else {
                        // Fallback: forward as-is without forcing JSON
                        upstreamRes = await fetch(`http://laravel:8000/api/${query}`, {
                            method: 'POST',
                            headers: { 'content-type': req.headers['content-type'] || 'application/octet-stream' },
                            body: req
                        })
                    }

                    const text = await upstreamRes.text()
                    let data
                    try { data = JSON.parse(text) } catch { data = text }

                    if (!upstreamRes.ok) {
                        await prismaLogging(session?.user?.id ?? "guest", "queryPostErrorUpstream", { status: upstreamRes.status, body: text?.slice?.(0, 2000) })
                        res.status(upstreamRes.status).json({ error: true, status: upstreamRes.status, data })
                        return resolve()
                    }

                    res.status(200).json({ data })
                    return resolve()

                } catch (e) {
                    await prismaLogging(session?.user?.id ?? "guest", "queryPostError", String(e))
                    res.status(500).json({ error: true, message: 'proxy error' })
                    return resolve()
                }
            }
            case "GET": {

                const path = req.query.query.join('/')

                // Build full URL with all query parameters
                const params = { ...req.query }
                delete params.query
                const searchParams = new URLSearchParams()
                Object.entries(params).forEach(([key, val]) => {
                  const values = Array.isArray(val) ? val : [val]
                  values.forEach(v => {
                    searchParams.append(key, htmlSpecialChars(v))
                  })
                })
                const url = `http://laravel:8000/api/${path}` + (searchParams.toString() ? `?${searchParams.toString()}` : '')
                const get = await fetch(url)
                let data

                if(!get.ok) {
                    const resText = await get.text()
                    await prismaLogging(session?.user?.id ?? "guest", "queryNotPostError", resText)
                    console.log(resText)
                    res.status(500).end()
                    return resolve()
                }
                data = await get.json()
                res.status(200).json({data})
                return resolve()
            }
        }
        res.status(405).end()
        return resolve()
    })
}

// JSON形式にパースできるかどうか判定する
function isValidJson(value){
    try {
        JSON.parse(value)
    } catch (e) {
        return false
    }
    return true
}

// HTMLで有効な特殊文字をエンコードする
function htmlSpecialChars(string) {
    return string.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;';
            default:
                return match;
        }
    });
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