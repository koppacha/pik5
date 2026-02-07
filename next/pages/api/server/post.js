/*
 *  バイナリデータを含むPOST専用のAPI
 */
import {getServerSession} from "next-auth/next";
const formidable = require("formidable");
import FormData from "form-data";
import fs from "fs";
import {authOptions} from "../auth/[...nextauth]";
import {prismaLogging} from "./[...query]";
import {ensureServerApiAccess} from "../../../lib/serverApiAccess";

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
        const requiredKeys = ['stage_id', 'rule', 'region', 'score', 'console', 'difficulty', 'post_comment', 'created_at', 'user_agent']
        const missing = requiredKeys.filter((key) => !getFieldValue(fields[key]))
        if (missing.length > 0) {
            res.status(400).json({error: true, message: `missing fields: ${missing.join(',')}`})
            return
        }

        const formData = new FormData()
        formData.append('stage_id', String(getFieldValue(fields.stage_id)))
        formData.append('rule', String(getFieldValue(fields.rule)))
        formData.append('region', String(getFieldValue(fields.region)))
        formData.append('score', String(getFieldValue(fields.score)))
        formData.append('user_id', String(session.user.userId))
        formData.append('console', String(getFieldValue(fields.console)))
        formData.append('difficulty', String(getFieldValue(fields.difficulty)))
        formData.append('video_url', String(getFieldValue(fields.video_url) || ''))
        formData.append('team', '0')
        formData.append('post_comment', String(getFieldValue(fields.post_comment)))
        formData.append('created_at', String(getFieldValue(fields.created_at)))
        formData.append('user_ip', String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''))
        formData.append('user_agent', String(getFieldValue(fields.user_agent)))

        const uploadFile = Array.isArray(files?.file) ? files.file[0] : files?.file
        if (uploadFile?.filepath) {
            formData.append('file', fs.createReadStream(uploadFile.filepath))
        }

        const response = await fetch("http://laravel:8000/api/record", {
            method: "POST",
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
