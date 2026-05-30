import {getServerSession} from "next-auth/next"
import {authOptions} from "../auth/[...nextauth]"
import prisma from "../../../lib/prisma"

const LARAVEL_API_BASE = "http://laravel:8000/api/new-arena"

function getSafePath(rawPath) {
    if (!Array.isArray(rawPath) || rawPath.length === 0) return null

    const segments = rawPath
        .map(segment => String(segment || '').trim())
        .filter(Boolean)

    if (segments.length === 0) return null
    if (segments.some(segment => segment.includes('..') || segment.includes('/') || segment.includes('?') || segment.includes('#'))) {
        return null
    }

    return segments.map(segment => encodeURIComponent(segment)).join('/')
}

async function parseUpstreamResponse(response) {
    const raw = await response.text()
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function collectArenaUserIds(data) {
    const ids = new Set()

    for (const player of data?.players ?? []) {
        if (player?.user_id) ids.add(String(player.user_id))
    }

    for (const match of data?.history ?? []) {
        if (match?.holder_user_id) ids.add(String(match.holder_user_id))
        if (match?.challenger_user_id) ids.add(String(match.challenger_user_id))
        for (const receiverId of match?.receiver_user_ids ?? []) {
            if (receiverId) ids.add(String(receiverId))
        }
    }

    return [...ids]
}

async function enrichArenaState(data) {
    if (!data || typeof data !== "object") return data

    const userIds = collectArenaUserIds(data)
    if (userIds.length === 0) return data

    const users = await prisma.user.findMany({
        where: {
            userId: {
                in: userIds,
            },
        },
        select: {
            userId: true,
            name: true,
        },
    })
    const nameByUserId = new Map(users.map(user => [user.userId, user.name]))
    const resolveName = userId => nameByUserId.get(userId) || null

    return {
        ...data,
        players: (data.players ?? []).map(player => ({
            ...player,
            display_name: resolveName(player.user_id),
        })),
        history: (data.history ?? []).map(match => ({
            ...match,
            holder_display_name: resolveName(match.holder_user_id),
            challenger_display_name: resolveName(match.challenger_user_id),
        })),
    }
}

export default async function handler(req, res) {
    const path = getSafePath(req.query.path)
    if (!path) {
        res.status(400).json({error: true, message: "invalid path"})
        return
    }

    const session = await getServerSession(req, res, authOptions)
    if (req.method !== "GET" && Number(session?.user?.role || 0) !== 10) {
        res.status(403).json({error: true, message: "forbidden"})
        return
    }

    const upstreamUrl = `${LARAVEL_API_BASE}/${path}`

    try {
        if (req.method === "GET") {
            const upstreamRes = await fetch(upstreamUrl)
            let data = await parseUpstreamResponse(upstreamRes)
            if (upstreamRes.ok && path === "state") {
                data = await enrichArenaState(data)
            }
            res.status(upstreamRes.status).json(data)
            return
        }

        if (req.method === "POST") {
            const upstreamRes = await fetch(upstreamUrl, {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify(req.body ?? {}),
            })
            const data = await parseUpstreamResponse(upstreamRes)
            res.status(upstreamRes.status).json(data)
            return
        }

        res.setHeader("Allow", "GET, POST")
        res.status(405).json({error: true, message: "method not allowed"})
    } catch (error) {
        res.status(502).json({error: true, message: "proxy error"})
    }
}
