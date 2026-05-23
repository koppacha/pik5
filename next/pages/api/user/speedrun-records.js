import prisma from '../../../lib/prisma'
import {getSpeedrunRecordsForUsername} from '../../../lib/speedrunRecords'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET'])
        return res.status(405).json({ok: false, message: 'Method Not Allowed'})
    }

    const userId = String(req.query.userId || '').trim()
    if (!userId) {
        return res.status(400).json({ok: false, message: 'userId is required'})
    }

    const user = await prisma.user.findFirst({
        where: {userId},
        select: {srcUserId: true},
    })

    if (!user?.srcUserId) {
        return res.status(200).json({ok: true, records: []})
    }

    const records = await getSpeedrunRecordsForUsername(user.srcUserId)
    return res.status(200).json({ok: true, records})
}
