import {getServerSession} from "next-auth/next"
import {authOptions} from "../auth/[...nextauth]"

const BASE_URL = "http://laravel:8000/api/swiss-tournaments"

export default async function handler(req, res) {
    const path = Array.isArray(req.query.path) ? req.query.path.map(String) : []
    if (path.some(part => !part || part.includes("..") || part.includes("/") || part.includes("?") || part.includes("#"))) {
        res.status(400).json({message: "invalid path"})
        return
    }
    if (req.method !== "GET") {
        const session = await getServerSession(req, res, authOptions)
        if (Number(session?.user?.role || 0) !== 10) {
            res.status(403).json({message: "forbidden"})
            return
        }
    }
    const target = [BASE_URL, ...path].join("/")
    try {
        const upstream = await fetch(target, {
            method: req.method,
            headers: req.method === "GET" ? {} : {"content-type": "application/json"},
            body: req.method === "GET" ? undefined : JSON.stringify(req.body ?? {}),
        })
        const text = await upstream.text()
        let data
        try { data = JSON.parse(text) } catch { data = {message: text || "upstream error"} }
        res.status(upstream.status).json(data)
    } catch {
        res.status(502).json({message: "proxy error"})
    }
}
