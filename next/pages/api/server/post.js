/*
 *  バイナリデータを含むPOST専用のAPI
 */
import {getServerSession} from "next-auth/next";
const formidable = require("formidable");
import fs from "fs";
import {authOptions} from "../auth/[...nextauth]";
import {prismaLogging} from "./[...query]";
import {ensureServerApiAccess} from "../../../lib/serverApiAccess";
import prisma from "../../../lib/prisma";

export const config = {
    api: {
        bodyParser: false,
    },
}

function getFieldValue(value) {
    if (Array.isArray(value)) return value[0]
    return value
}

async function parseForm(req) {
    const form = new formidable.IncomingForm()
    return new Promise((resolve, reject) => {
        form.parse(req, (error, fields, files) => {
            if (error) {
                reject(error)
                return
            }
            resolve({fields, files})
        })
    })
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

function canEditRecord(sessionUserId, role, createdAt, ownerUserId) {
    if (Number(role) === 10) return true

    const postDate = new Date(createdAt)
    if (Number.isNaN(postDate.getTime())) return false
    if ((postDate.getTime() + 86400000) < Date.now()) return false

    if (sessionUserId === ownerUserId) return true
    return Number(role) > 0
}

export default async function handler(req, res){

    const session = await getServerSession(req, res, authOptions)

    if (!ensureServerApiAccess(req, res)) {
        await prismaLogging(session?.user?.userId ?? "guest", "postAccessDenied", {
            method: req.method,
            path: req.url,
        })
        res.status(403).json({error: true, message: "forbidden"})
        return
    }

    if(req.method !== "POST"){
        res.setHeader("Allow", "POST")
        res.status(405).json({error: true, message: "method not allowed"})
        return
    }

    if(!session) {
        res.status(401).json({error: true, message: "unauthorized"})
        return
    }

    try {
        const {fields, files} = await parseForm(req)
        const mode = String(getFieldValue(fields.mode) || 'create')
        const editUniqueId = String(getFieldValue(fields.edit_unique_id) || '')
        const isEdit = mode === 'edit'
        const requiredKeys = ['stage_id', 'rule', 'region', 'score', 'console', 'difficulty', 'created_at', 'user_agent']
        const missing = requiredKeys.filter((key) => !getFieldValue(fields[key]))
        if (missing.length > 0) {
            res.status(400).json({error: true, message: `missing fields: ${missing.join(',')}`})
            return
        }
        if (isEdit && !editUniqueId) {
            res.status(400).json({error: true, message: 'missing fields: edit_unique_id'})
            return
        }

        const currentUserId = String(session.user.userId || session.user.id || '')
        let editorRole = Number(session.user.role || 0)
        if (!Number.isFinite(editorRole) || editorRole === 0) {
            const editor = await prisma.user.findFirst({
                where: {userId: currentUserId},
                select: {role: true},
            })
            editorRole = Number(editor?.role || 0)
        }

        if (isEdit) {
            const currentRecordRes = await fetch(`http://laravel:8000/api/record/id/${editUniqueId}`)
            if (!currentRecordRes.ok) {
                res.status(404).json({error: true, message: 'record not found'})
                return
            }
            const currentRecord = await currentRecordRes.json()
            if (!currentRecord?.unique_id || Number(currentRecord?.flg) > 1) {
                res.status(404).json({error: true, message: 'record not found'})
                return
            }
            const editable = canEditRecord(
                currentUserId,
                editorRole,
                currentRecord.created_at,
                String(currentRecord.user_id || '')
            )
            if (!editable) {
                res.status(403).json({error: true, message: 'forbidden'})
                return
            }
        }

        const formData = new FormData()
        formData.append('stage_id', String(getFieldValue(fields.stage_id)))
        formData.append('rule', String(getFieldValue(fields.rule)))
        formData.append('region', String(getFieldValue(fields.region)))
        formData.append('score', String(getFieldValue(fields.score)))
        formData.append('user_id', currentUserId)
        formData.append('console', String(getFieldValue(fields.console)))
        formData.append('difficulty', String(getFieldValue(fields.difficulty)))
        formData.append('video_url', String(getFieldValue(fields.video_url) || ''))
        formData.append('team', '0')
        formData.append('post_comment', String(getFieldValue(fields.post_comment)))
        formData.append('created_at', String(getFieldValue(fields.created_at)))
        formData.append('user_agent', String(getFieldValue(fields.user_agent)))
        formData.append('mode', mode)
        formData.append('editor_role', String(editorRole))
        if (isEdit) {
            formData.append('edit_unique_id', editUniqueId)
            formData.append('old_img_url', String(getFieldValue(fields.old_img_url) || ''))
        }

        const uploadFile = Array.isArray(files?.file) ? files.file[0] : files?.file
        if (uploadFile?.filepath) {
            const fileBuffer = await fs.promises.readFile(uploadFile.filepath)
            const filename = uploadFile.originalFilename || uploadFile.newFilename || 'upload.bin'
            formData.append('file', new Blob([fileBuffer]), filename)
        }

        const proxyHeaders = {
            'x-forwarded-for': getForwardedFor(req),
            'x-real-ip': String(req.headers['x-real-ip'] || req.socket?.remoteAddress || ''),
            'x-forwarded-proto': String(req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')),
            'x-forwarded-host': String(req.headers.host || ''),
        }

        const response = await fetch("http://laravel:8000/api/record", {
            method: "POST",
            headers: proxyHeaders,
            body: formData,
        })
        const data = await parseUpstreamResponse(response)

        if (!response.ok) {
            await prismaLogging(session.user.userId, "postUpstreamError", {status: response.status})
            res.status(response.status).json({error: true, status: response.status, data})
            return
        }

        res.status(response.status).json(data)
        return
    } catch (error) {
        await prismaLogging(session.user.userId, "postProxyError", String(error))
        res.status(502).json({error: true, message: "proxy error"})
        return
    }
}
