import {getServerSession} from 'next-auth/next'
import {authOptions} from './auth/[...nextauth]'
import {currentManagementUser, managementRequest} from '../../lib/dandoriServer'
import {ensureServerApiAccess} from '../../lib/serverApiAccess'
import prisma from '../../lib/prisma'

export const config = {api: {bodyParser: {sizeLimit: '64kb'}}}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()
    if (!ensureServerApiAccess(req, res)) return res.status(403).json({message: 'アクセスできません'})
    try {
        const user = await currentManagementUser(await getServerSession(req, res, authOptions))
        if (!user) return res.status(401).json({message: 'ログインが必要です'})
        let body = req.body
        if (req.method === 'POST' && ['grant', 'revoke'].includes(body?.action)) {
            if (Number(user.role) !== 10) return res.status(403).json({message: '管理者権限が必要です'})
            const subject = await prisma.user.findUnique({where: {userId: String(body.userId || '')}, select: {id: true}})
            if (!subject) return res.status(422).json({message: 'ユーザーが見つかりません'})
            body = {action: body.action, subject: subject.id}
        }
        const response = await managementRequest(user, req.method, req.method === 'POST' ? body : undefined)
        if (response.ok && req.method === 'GET' && Number(user.role) === 10) {
            const ids = response.data.permissions.map(permission => permission.user_id)
            const users = await prisma.user.findMany({where: {id: {in: ids}}, select: {id: true, userId: true, name: true}})
            response.data.permissions = response.data.permissions.map(permission => ({...permission, ...users.find(subject => subject.id === permission.user_id)}))
        }
        return res.status(response.status).json(response.data)
    } catch {
        return res.status(503).json({message: '管理情報を取得できません。時間をおいて再実行してください'})
    }
}
