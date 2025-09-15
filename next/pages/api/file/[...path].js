// /pages/api/file/[...path].js
import http from 'http'

export const config = {
    api: { bodyParser: false },
}

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            res.status(405).json({ message: 'Method Not Allowed' })
            return
        }

        // 期待: /api/file/(path...)/(file)
        const parts = Array.isArray(req.query.path) ? req.query.path : []
        if (parts.length < 2) {
            res.status(400).json({ message: 'Bad Request' })
            return
        }

        // 後方はファイル名、先頭〜中間は path
        const file = parts[parts.length - 1]
        const pathOnly = parts.slice(0, -1).join('/')

        // Laravel 側の新エンドポイントへ中継
        const upstreamUrl = `http://laravel:8000/api/file/${encodeURI(pathOnly)}/${encodeURI(file)}`
        http.get(upstreamUrl, (response) => {
            const contentType = response.headers['content-type'] || 'application/octet-stream'
            if (response.statusCode && response.statusCode >= 400) {
                res.status(response.statusCode).json({ message: 'Upstream error' })
                return
            }
            res.setHeader('Content-Type', contentType)
            // キャッシュしたい場合はここで Cache-Control を付与
            response.pipe(res)
        }).on('error', (err) => {
            console.error('Error fetching file:', err)
            res.status(502).json({ message: 'Bad Gateway' })
        })
    } catch (e) {
        console.error('Error in file proxy handler:', e)
        res.status(500).json({ message: 'Internal Server Error' })
    }
}