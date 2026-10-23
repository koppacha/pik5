import fs from 'fs/promises'
import {getServerSession} from 'next-auth/next'
import {authOptions} from './auth/[...nextauth]'
import {ensureServerApiAccess} from '../../lib/serverApiAccess'
import {currentManagementUser, dandoriBase} from '../../lib/dandoriServer'
import {tricksIdentityHeaders} from '../../lib/tricks/proxyAuth'
import {clientIpHeaders} from '../../lib/clientIpSignature'
import {parseForm, getFieldValue} from '../../lib/recordUpload'
import {logger} from '../../lib/logger'

export const config = {api: {bodyParser: false}}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'GET') {
        if (req.query.action === 'capabilities') {
            try {
                const actor = await currentManagementUser(await getServerSession(req, res, authOptions))
                if (!actor?.userId) return res.status(200).json({can_report: false, can_delete: false})
                const response = await fetch(`${dandoriBase}/world-records/capabilities`, {headers: {
                    accept: 'application/json', ...tricksIdentityHeaders(actor.userId, actor.role),
                    ...clientIpHeaders(req, new URL(`${dandoriBase}/world-records/capabilities`).pathname),
                }})
                if (!response.ok) return res.status(503).json({message: '利用状態を取得できません'})
                return res.status(200).json(await response.json())
            } catch { return res.status(503).json({message: '利用状態を取得できません'}) }
        }
        const stage = String(req.query.stage || '')
        const rule = String(req.query.rule || '')
        if (!/^(?:[1-9][0-9]{2,3}|4[A-Z][0-9A-Z])$/.test(stage) || !['31', '32', '33', '34', '36', '48'].includes(rule)) return res.status(400).json({message: '対象が不正です'})
        try {
            const url = new URL(`${dandoriBase}/world-records/${stage}/${rule}`)
            const response = await fetch(url, {headers: clientIpHeaders(req, url.pathname)})
            return res.status(response.status).json(await response.json())
        } catch { return res.status(503).json({message: '世界記録を取得できません'}) }
    }
    if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).end()
    if (!ensureServerApiAccess(req, res)) return res.status(403).json({message: 'アクセスできません'})
    const actor = await currentManagementUser(await getServerSession(req, res, authOptions))
    if (!actor?.userId) return res.status(401).json({message: 'ログインが必要です'})
    if (req.method === 'DELETE') {
        if (Number(actor.role) !== 10) return res.status(403).json({message: 'アクセスできません'})
        const id = String(req.query.id || '')
        if (!/^[1-9]\d{0,17}$/.test(id)) return res.status(400).json({message: '対象が不正です'})
        try {
            const url = new URL(`${dandoriBase}/world-records/${id}`)
            const response = await fetch(url, {method: 'DELETE', headers: {
                accept: 'application/json', ...tricksIdentityHeaders(actor.userId, actor.role), ...clientIpHeaders(req, url.pathname),
            }})
            if (response.status >= 500) return res.status(503).json({message: '削除できません'})
            return res.status(response.status).json(await response.json())
        } catch { return res.status(503).json({message: '削除できません'}) }
    }
    let upload
    let phase = 'parse'
    let upstreamStatus
    try {
        const {fields, files} = await parseForm(req)
        upload = Array.isArray(files.file) ? files.file[0] : files.file
        const body = new FormData()
        phase = 'upload'
        for (const field of ['stage_id', 'rule', 'holder_name', 'score', 'platform']) body.append(field, String(getFieldValue(fields[field]) || ''))
        if (upload?.filepath) body.append('file', new Blob([await fs.readFile(upload.filepath)]), upload.originalFilename || 'evidence.jpg')
        const url = new URL(`${dandoriBase}/world-records`)
        phase = 'upstream'
        const response = await fetch(url, {method: 'POST', body, headers: {
            accept: 'application/json', ...tricksIdentityHeaders(actor.userId, actor.role), ...clientIpHeaders(req, url.pathname),
        }})
        upstreamStatus = response.status
        phase = 'response'
        return res.status(response.status).json(await response.json())
    } catch (error) {
        logger.warn('worldRecordProxyFailed', {phase, name: error?.name, code: error?.code, status: upstreamStatus})
        return res.status(Number(error?.httpCode) === 413 ? 413 : 502).json({message: '世界記録を保存できません'})
    } finally {
        if (upload?.filepath) await fs.unlink(upload.filepath).catch(() => {})
    }
}
