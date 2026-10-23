import {getServerSession} from 'next-auth/next'
import {authOptions} from './auth/[...nextauth]'
import {currentManagementUser, managementRequest} from '../../lib/dandoriServer'

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'GET') return res.status(405).end()
    try {
        const user = await currentManagementUser(await getServerSession(req, res, authOptions))
        if (!user) return res.status(401).json({message: 'ログインが必要です'})
        const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1))
        const result = await managementRequest(user, 'GET', undefined, `security/events?page=${page}`)
        return res.status(result.status).json(result.data)
    } catch {
        return res.status(503).json({message: 'ログイン履歴を取得できません'})
    }
}
