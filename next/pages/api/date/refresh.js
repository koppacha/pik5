import {getServerSession} from 'next-auth/next'
import {authOptions} from '../auth/[...nextauth]'
import {currentManagementUser, managementRequest} from '../../../lib/dandoriServer'
import {ensureServerApiAccess} from '../../../lib/serverApiAccess'
import {parseRecordYear} from '../../../lib/yearRecords.mjs'
import {invalidateYearJson} from '../../../lib/yearRecordsCache.mjs'
import {speedrunYearKey} from '../../../lib/yearSpeedruns.mjs'
import {speedrunStageConfigs} from '../../../lib/const'

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).end()
    }
    if (!ensureServerApiAccess(req, res)) return res.status(403).json({message: 'Forbidden'})
    const year = parseRecordYear(req.body?.year)
    if (!year) return res.status(404).json({message: 'Not found'})
    try {
        const user = await currentManagementUser(await getServerSession(req, res, authOptions))
        if (Number(user?.role) !== 10) return res.status(403).json({message: 'Forbidden'})
        const result = await managementRequest(user, 'POST', {}, `date/${year}/refresh`)
        if (!result.ok) return res.status(result.status).json({message: 'Cache refresh failed'})
        await invalidateYearJson(speedrunYearKey(year, speedrunStageConfigs))
        return res.json({refreshed: true})
    } catch {
        return res.status(503).json({message: 'Cache refresh failed'})
    }
}
