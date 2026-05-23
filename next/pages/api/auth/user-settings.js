import {getServerSession} from 'next-auth/next'
import prisma from '../../../lib/prisma'
import {authOptions} from './[...nextauth]'
import {invalidateUsersCache} from '../../../lib/usersCache'
import {totalRankingRules} from '../../../lib/const'
import {resolveSpeedrunUser} from '../../../lib/speedrunRecords'

async function findSessionUser(session) {
    const dbId = session?.user?.dbId
    const loginUserId = session?.user?.userId ?? session?.user?.id

    if (dbId != null) {
        const user = await prisma.user.findUnique({
            where: {id: dbId},
            select: {id: true, userId: true, srcUserId: true, userCatSelect: true},
        })
        if (user) return user
    }

    if (loginUserId) {
        return prisma.user.findFirst({
            where: {userId: loginUserId},
            select: {id: true, userId: true, srcUserId: true, userCatSelect: true},
        })
    }

    return null
}

async function revalidateUserPages(res, userId) {
    if (!userId) return

    const targets = [`/user/${userId}`]
    await Promise.all(targets.map(target => res.revalidate(target).catch(() => null)))
}

export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
        return res.status(401).json({ok: false, message: 'Unauthorized'})
    }

    const user = await findSessionUser(session)
    if (!user) {
        return res.status(404).json({ok: false, message: 'User not found'})
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            ok: true,
            srcUserId: user.srcUserId ?? '',
            userCatSelect: user.userCatSelect ?? 0,
        })
    }

    if (req.method !== 'PATCH') {
        res.setHeader('Allow', ['GET', 'PATCH'])
        return res.status(405).json({ok: false, message: 'Method Not Allowed'})
    }

    const body = req.body ?? {}
    const data = {}

    if (Object.prototype.hasOwnProperty.call(body, 'srcUserId')) {
        const srcUserId = String(body.srcUserId ?? '').trim()
        if (srcUserId) {
            const speedrunUser = await resolveSpeedrunUser(srcUserId)
            if (!speedrunUser) {
                return res.status(400).json({ok: false, message: 'Speedrun.comユーザー名が見つかりません'})
            }
            data.srcUserId = speedrunUser.username
        } else {
            data.srcUserId = null
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'userCatSelect')) {
        const userCatSelect = Number(body.userCatSelect || 0)
        if (userCatSelect && !totalRankingRules.includes(userCatSelect)) {
            return res.status(400).json({ok: false, message: 'カテゴリ指定が正しくありません'})
        }
        data.userCatSelect = userCatSelect || null
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ok: false, message: 'No changes'})
    }

    const updated = await prisma.user.update({
        where: {id: user.id},
        data,
        select: {srcUserId: true, userCatSelect: true},
    })

    invalidateUsersCache()
    await revalidateUserPages(res, user.userId)

    return res.status(200).json({
        ok: true,
        srcUserId: updated.srcUserId ?? '',
        userCatSelect: updated.userCatSelect ?? 0,
    })
}
