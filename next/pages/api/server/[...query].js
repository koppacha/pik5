import {logger} from "../../../lib/logger";
import fetch from "node-fetch";
import prisma from "../../../lib/prisma";
import {networkInterfaces} from "os";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../auth/[...nextauth]";

export default async function handle(req, res){

    const session = await getServerSession(req, res, authOptions)

    return new Promise(async resolve => {
        switch (req.method) {
            case "POST": {
                try {
                    const query = req.query.query.join("/")
                    await prismaLogging(session?.user?.id ?? "guest", "queryPost", req.body)

                    const post = await fetch(`http://laravel:8000/api/${query}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(req.body)
                    })
                    const data = await post.json()
                    res.status(200).json({data})
                    return resolve()

                } catch (e) {
                    await prismaLogging(session?.user?.id ?? "guest", "queryPostError", e)
                    res.status(404).json(e)
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
                    const resText = get.text()
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