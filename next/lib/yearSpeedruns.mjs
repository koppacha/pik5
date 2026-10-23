import fetch from 'node-fetch'
import {createHash} from 'node:crypto'
import {evidenceUrl, yearWindow} from './yearRecords.mjs'

const base = 'https://www.speedrun.com/api/v1/'
export const speedrunYearKey = (year, configs) => `rta-v1-${year}-${createHash('sha256').update(JSON.stringify(configs)).digest('hex').slice(0, 16)}`

async function fetchJson(url) {
    const response = await fetch(url, {signal: AbortSignal.timeout(15000)})
    if (!response.ok) {
        response.body.destroy()
        throw new Error(`Speedrun API status ${response.status}`)
    }
    return response.json()
}

function playersOf(run) {
    const players = run.players?.data || run.players || []
    return players.map(player => ({
        key: player.id || `guest:${player.name}`,
        name: player.names?.japanese || player.names?.international || player.name || player.id || '?',
        url: evidenceUrl(player.weblink) || (player.id ? `https://www.speedrun.com/user/${encodeURIComponent(player.id)}` : null),
    }))
}

async function allRuns(game, category, request) {
    const result = new Map()
    const seen = new Set()
    let url = `${base}runs?${new URLSearchParams({game, category, status: 'verified', max: '200', embed: 'players', orderby: 'submitted', direction: 'asc'})}`
    while (url) {
        if (seen.has(url)) throw new Error('Invalid speedrun pagination')
        seen.add(url)
        const response = await request(url)
        if (!Array.isArray(response.data)) throw new Error('Invalid speedrun response')
        for (const run of response.data) result.set(run.id, run)
        const next = response.pagination?.links?.find(link => link.rel === 'next')?.uri
        if (next) {
            const parsed = new URL(next)
            if (parsed.origin !== 'https://www.speedrun.com' || parsed.pathname !== '/api/v1/runs') throw new Error('Invalid speedrun pagination URL')
            url = parsed.href
        } else {
            // A full page without pagination cannot be treated as a complete history.
            if (!response.pagination && response.data.length >= 200) throw new Error('Missing speedrun pagination')
            url = null
        }
    }
    return [...result.values()]
}

export async function fetchYearSpeedruns(year, configs, {request = fetchJson, now = new Date()} = {}) {
    const {cutoff, start, current} = yearWindow(year, now)
    const targets = new Map()
    for (const definition of Object.values(configs)) {
        for (const config of Object.values(definition.consoles)) targets.set(`${config.gameId}:${config.categoryId}`, config)
    }
    const queue = [...targets.entries()]
    const histories = new Map()
    await Promise.all(Array.from({length: Math.min(3, queue.length)}, async () => {
        while (queue.length) {
            const [key, config] = queue.shift()
            histories.set(key, await allRuns(config.gameId, config.categoryId, request))
        }
    }))
    const boards = []
    const unknownDates = new Set()
    for (const [stage, definition] of Object.entries(configs)) {
        for (const [consoleId, config] of Object.entries(definition.consoles)) {
            const candidates = []
            for (const run of histories.get(`${config.gameId}:${config.categoryId}`) || []) {
                if (run.game !== config.gameId || run.category !== config.categoryId || run.level) continue
                if (run.status?.status !== 'verified' || run.values?.dloe59en === 'q650zkjl') continue
                if (!Object.entries(config.variables || {}).every(([key, value]) => run.values?.[key.replace(/^var-/, '')] === value)) continue
                const submitted = run.submitted ? new Date(run.submitted) : null
                if (!submitted || !Number.isFinite(submitted.getTime())) {
                    unknownDates.add(run.id)
                    continue
                }
                if (current ? submitted > cutoff : submitted >= cutoff) continue
                const verified = run.status?.['verify-date']
                if (verified) {
                    const verification = new Date(verified)
                    if (!Number.isFinite(verification.getTime()) || (current ? verification > cutoff : verification >= cutoff)) continue
                }
                const time = Number(run.times?.realtime_t ?? run.times?.primary_t)
                if (!Number.isFinite(time) || time < 0) continue
                const players = playersOf(run)
                if (!players.length) continue
                candidates.push({id: run.id, time, submitted: submitted.toISOString(), players,
                    playerKey: players.map(player => player.key).sort().join('|'),
                    videoUrl: (run.videos?.links || []).map(link => evidenceUrl(link.uri)).find(Boolean) || null,
                    url: evidenceUrl(run.weblink) || `https://www.speedrun.com/run/${encodeURIComponent(run.id)}`})
            }
            candidates.sort((a, b) => a.time - b.time || a.submitted.localeCompare(b.submitted) || a.id.localeCompare(b.id))
            const seenPlayers = new Set()
            const best = candidates.filter(run => {
                if (seenPlayers.has(run.playerKey)) return false
                seenPlayers.add(run.playerKey)
                return true
            })
            let rank = 1
            const runs = best.map((run, index) => {
                if (index && run.time !== best[index - 1].time) rank = index + 1
                const {playerKey, ...data} = run
                return {...data, rank}
            }).filter(run => !start || new Date(run.submitted) >= start)
            if (runs.length) boards.push({stage: Number(stage), console: Number(consoleId), runs})
        }
    }
    return {year, generatedAt: now.toISOString(), asOf: new Date(cutoff.getTime() - (current ? 0 : 1000)).toISOString(), boards, unknownDates: unknownDates.size}
}
