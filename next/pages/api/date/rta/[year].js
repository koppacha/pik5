import {speedrunStageConfigs} from '../../../../lib/const'
import {parseRecordYear, yearWindow} from '../../../../lib/yearRecords.mjs'
import {cachedYearJson} from '../../../../lib/yearRecordsCache.mjs'
import {fetchYearSpeedruns, speedrunYearKey} from '../../../../lib/yearSpeedruns.mjs'

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        return res.status(405).end()
    }
    const now = new Date()
    const year = parseRecordYear(req.query.year, now)
    if (!year) return res.status(404).json({message: 'Not found'})
    try {
        const ttl = (yearWindow(year, now).current ? 600 : 30 * 86400) * 1000
        const data = await cachedYearJson(speedrunYearKey(year, speedrunStageConfigs), ttl,
            () => fetchYearSpeedruns(year, speedrunStageConfigs, {now}))
        return res.json(data)
    } catch {
        return res.status(503).json({message: 'RTA records are temporarily unavailable'})
    }
}
