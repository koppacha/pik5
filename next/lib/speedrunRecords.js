import {
    buildSpeedrunLeaderboardPath,
    getSpeedrunConsoleIds,
    getSpeedrunStageConfig,
    sp,
    speedrunPlatformConsoleMap,
    speedrunStageSeries,
} from "./const"

const SPEEDRUN_API_BASE = "https://www.speedrun.com/api/v1"
export const SPEEDRUN_RECORD_CACHE_TTL_MS = 72 * 60 * 60 * 1000

function getStore() {
    if (!globalThis.__pik5SpeedrunCache) {
        globalThis.__pik5SpeedrunCache = new Map()
    }
    return globalThis.__pik5SpeedrunCache
}

function getCached(key) {
    const cached = getStore().get(key)
    if (!cached || cached.expiresAt < Date.now()) {
        getStore().delete(key)
        return {hit: false, value: null}
    }
    return {hit: true, value: cached.value}
}

function setCached(key, value) {
    getStore().set(key, {
        value,
        expiresAt: Date.now() + SPEEDRUN_RECORD_CACHE_TTL_MS,
    })
    return value
}

export function clearSpeedrunCacheForUsername(username) {
    const normalized = String(username || "").trim().toLowerCase()
    if (!normalized) return

    const store = getStore()
    store.delete(`speedrun:user:${normalized}`)
    store.delete(`speedrun:records:${normalized}`)
}

async function fetchSpeedrunJson(path) {
    const res = await fetch(`${SPEEDRUN_API_BASE}/${path}`)
    if (!res.ok) {
        throw new Error(`Speedrun.com API error: ${res.status}`)
    }
    return res.json()
}

export async function resolveSpeedrunUser(username) {
    const normalized = String(username || "").trim()
    if (!normalized) return null

    const cacheKey = `speedrun:user:${normalized.toLowerCase()}`
    const cached = getCached(cacheKey)
    if (cached.hit) return cached.value

    const params = new URLSearchParams({lookup: normalized})
    const data = await fetchSpeedrunJson(`users?${params.toString()}`)
    const user = Array.isArray(data?.data)
        ? data.data.find(item => {
            const names = item?.names ?? {}
            return [names.international, names.japanese, item?.id]
                .filter(Boolean)
                .some(value => String(value).toLowerCase() === normalized.toLowerCase())
        }) ?? data.data[0] ?? null
        : null

    return setCached(cacheKey, user ? {
        id: user.id,
        username: user.names?.international || user.names?.japanese || normalized,
        weblink: user.weblink || `https://www.speedrun.com/user/${normalized}`,
    } : null)
}

function isIgnoredRun(entry) {
    return entry?.run?.values?.dloe59en === "q650zkjl"
}

function runConsoleId(entry, fallbackConsole) {
    return speedrunPlatformConsoleMap[entry?.run?.system?.platform] ?? Number(fallbackConsole)
}

function variableMatches(runValues, configVariables) {
    return Object.entries(configVariables ?? {}).every(([rawKey, expectedValue]) => {
        const key = rawKey.replace(/^var-/, "")
        return runValues?.[key] === expectedValue
    })
}

function findStageConfigForPersonalBest(entry) {
    const run = entry?.run
    if (!run?.game || !run?.category) return null

    for (const stage of sp) {
        for (const consoleId of getSpeedrunConsoleIds(stage)) {
            const config = getSpeedrunStageConfig(stage, consoleId)
            if (!config) continue
            if (run.game !== config.gameId || run.category !== config.categoryId) continue
            if (!variableMatches(run.values ?? {}, config.variables ?? {})) continue

            return {stage, consoleId, config}
        }
    }

    return null
}

function formatPersonalBestRecord({stage, consoleId, leaderboard, entry}) {
    const stageConfig = getSpeedrunStageConfig(stage, consoleId)
    const time = Number(entry?.run?.times?.realtime_t || 0)
    const participants = (leaderboard?.runs ?? []).filter(item => !isIgnoredRun(item)).length
    const actualConsole = runConsoleId(entry, stageConfig.console)

    return {
        stage: Number(stage),
        series: speedrunStageSeries(stage),
        console: actualConsole,
        configuredConsole: Number(stageConfig.console),
        gameId: stageConfig.gameId,
        categoryId: stageConfig.categoryId,
        time,
        rank: Number(entry?.place || 0),
        participants,
        url: leaderboard?.weblink || entry?.run?.weblink || `https://www.speedrun.com/leaderboards/${stageConfig.gameId}/category/${stageConfig.categoryId}`,
    }
}

async function getLeaderboardForRecord(stage, consoleId) {
    const path = buildSpeedrunLeaderboardPath(stage, consoleId)
    if (!path) return null

    const cacheKey = `speedrun:leaderboard:${path}`
    const cached = getCached(cacheKey)
    if (cached.hit) return cached.value

    const leaderboard = await fetchSpeedrunJson(`leaderboards/${path}`)
    return setCached(cacheKey, leaderboard?.data ?? null)
}

async function fetchUserRecordsForResolvedUser(speedrunUser) {
    if (!speedrunUser?.id) return []

    const personalBests = await fetchSpeedrunJson(`users/${speedrunUser.id}/personal-bests`)
    const records = []

    for (const entry of personalBests?.data ?? []) {
        if (isIgnoredRun(entry)) continue

        const matched = findStageConfigForPersonalBest(entry)
        if (!matched) continue

        const leaderboard = await getLeaderboardForRecord(matched.stage, matched.consoleId)
        records.push(formatPersonalBestRecord({
            stage: matched.stage,
            consoleId: matched.consoleId,
            leaderboard,
            entry,
        }))
    }

    return records.sort((a, b) => a.stage - b.stage || a.configuredConsole - b.configuredConsole)
}

export async function getSpeedrunRecordsForUsername(username) {
    const normalized = String(username || "").trim()
    if (!normalized) return []

    const cacheKey = `speedrun:records:${normalized.toLowerCase()}`
    const cached = getCached(cacheKey)
    if (cached.hit) return cached.value

    const speedrunUser = await resolveSpeedrunUser(normalized)
    if (!speedrunUser) return setCached(cacheKey, [])

    const records = await fetchUserRecordsForResolvedUser(speedrunUser)
    return setCached(cacheKey, records)
}
