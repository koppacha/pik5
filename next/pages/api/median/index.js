import {getServerSession} from 'next-auth/next'
import {authOptions} from '../auth/[...nextauth]'
import prisma from '../../../lib/prisma'
import {evaluateAnswer, guestIdentity, medianRequest, medianSecret, setGuestCookie} from '../../../lib/median/server'

export const config = {api: {bodyParser: {sizeLimit: '256kb'}}}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, private')
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({message: 'method not allowed'})
    if (req.method === 'POST') {
        let sameOrigin = false
        try { sameOrigin = new URL(req.headers.origin).host === req.headers.host } catch {}
        if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({message: '同じサイトから操作してください'})
    }
    if (!medianSecret()) return res.status(503).json({message: 'ゲーム用APIの認証設定がありません'})
    try {
        const session = await getServerSession(req, res, authOptions)
        let identity = guestIdentity(req)
        if (session?.user) {
            const where = session.user.dbId ? {id: session.user.dbId} : {userId: session.user.userId || session.user.id}
            const user = await prisma.user.findUnique({where, select: {userId: true, name: true}})
            if (!user?.userId || !user.name) return res.status(401).json({message: 'ログイン情報を確認してください'})
            identity = {kind: 'user', userId: user.userId, name: user.name}
        }
        const data = req.body || {}
        if (data.action === 'join' && !session?.user) {
            if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80 || /[\r\n\u0000-\u001f]/.test(data.name)) return res.status(422).json({message: '名前を1〜80文字で入力してください'})
            identity = {kind: 'guest', name: data.name}
        }
        let payload = {...data}
        delete payload.name
        delete payload.answer
        if (req.method === 'POST' && data.action === 'answer') {
            if (!identity) return res.status(401).json({message: '参加してから回答してください'})
            if (typeof data.raw !== 'string' || data.raw.length > 512) return res.status(422).json({message: '回答は512文字以内にしてください'})
            payload.answer = await evaluateAnswer(data.raw)
        }
        const result = await medianRequest(identity, req.method, payload)
        if (result.status >= 400) return res.status(result.status).json({message: result.status >= 500 ? 'ゲームの保存先に接続できません' : (result.data.message || '操作できませんでした')})
        if (data.action === 'join' && identity?.kind === 'guest' && result.status < 300) setGuestCookie(res, identity.name)
        return res.status(result.status).json(result.data)
    } catch (error) {
        if (error.message === 'EVALUATOR_UNAVAILABLE') return res.status(503).json({message: '計算機能を利用できません。管理者にお問い合わせください'})
        return res.status(error.message === 'EVALUATOR_BUSY' ? 429 : 503).json({message: '処理できませんでした。少し待って再度お試しください'})
    }
}
