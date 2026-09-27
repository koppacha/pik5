import {getServerSession} from "next-auth/next"
import {authOptions} from "../auth/[...nextauth]"

const BASE_URL = "http://laravel:8000/api/swiss-tournaments"

export default async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
        res.setHeader("Allow", "GET, POST")
        res.status(405).json({message: "method not allowed"})
        return
    }
    if (req.method !== "GET") {
        const session = await getServerSession(req, res, authOptions)
        if (Number(session?.user?.role || 0) !== 10) {
            res.status(403).json({message: "forbidden"})
            return
        }
    }
    try {
        const upstream = await fetch(BASE_URL, {
            method: req.method,
            headers: req.method === "POST" ? {"content-type": "application/json"} : {},
            body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
        })
        const text = await upstream.text()
        let data
        try { data = JSON.parse(text) } catch { data = {message: text || "upstream error"} }
        res.status(upstream.status).json(data)
    } catch {
        res.status(502).json({message: "proxy error"})
    }
}
