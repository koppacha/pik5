import fetch from "node-fetch"
import {getServerSession} from "next-auth/next"
import {authOptions} from "../../auth/[...nextauth]"
import {prismaLogging} from "../[...query]"
import {ensureServerApiAccess} from "../../../../lib/serverApiAccess"
import prisma from "../../../../lib/prisma"
import {tricksIdentityHeaders} from "../../../../lib/tricks/proxyAuth"

const LARAVEL_API_BASE = process.env.TRICKS_LARAVEL_API_BASE || "http://laravel:8000/api"

function canDeleteRecord(sessionUserId, role, createdAt, ownerUserId) {
    if (Number(role) === 10) return true

    const postDate = new Date(createdAt)
    if (Number.isNaN(postDate.getTime())) return false
    if ((postDate.getTime() + 86400000) < Date.now()) return false

    return sessionUserId === ownerUserId || Number(role) > 0
}

export default async function handler(req, res){

    const session = await getServerSession(req, res, authOptions)

    if (!ensureServerApiAccess(req, res)) {
        res.status(403).json({error: true, message: "forbidden"})
        return
    }

    if(!session){
        res.status(401).json({error: true, message: "unauthorized"})
        return
    }

    if(req.method === "DELETE"){

        const [uniqueId] = req.query.delete
        const currentUserId = String(session.user.userId || session.user.id || "")
        let role = Number(session.user.role || 0)
        if (!Number.isFinite(role) || role === 0) {
            const user = await prisma.user.findFirst({
                where: {userId: currentUserId},
                select: {role: true},
            })
            role = Number(user?.role || 0)
        }
        const recordRes = await fetch(`${LARAVEL_API_BASE}/record/id/${encodeURIComponent(uniqueId)}`)
        const record = await recordRes.json().catch(() => ({}))
        if (!recordRes.ok || !record?.unique_id || Number(record.flg) > 1) {
            res.status(404).json({error: true, message: "record not found"})
            return
        }
        if (!canDeleteRecord(currentUserId, role, record.created_at, String(record.user_id || ""))) {
            res.status(403).json({error: true, message: "forbidden"})
            return
        }
        await prismaLogging(currentUserId, "delete", uniqueId)

        const params = new URLSearchParams({user_id: currentUserId, editor_role: String(role)})
        const del = await fetch(`${LARAVEL_API_BASE}/record/${encodeURIComponent(uniqueId)}?${params}`, {
            method: "DELETE",
            headers: tricksIdentityHeaders(currentUserId, role),
        })

        const data = await del.json()
        res.status(del.status).json({data})

    } else {
        res.setHeader("Allow", "DELETE")
        res.status(405).json({error: "Method not allowed"})
    }
}
