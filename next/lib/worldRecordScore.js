// Pikmin 3 elapsed times use the same remaining-time storage as ordinary posts.
export function worldRecordScore(value, rule, countdown = null) {
    const score = Number(value)
    if (Number(rule) !== 48 && countdown) return countdown.time - score + countdown.score
    return score
}

export function worldRecordPlatforms(stage, rule) {
    const id = Number(stage)
    if (Number(rule) === 48 || (id >= 331 && id <= 344)) return [4]
    if ((id >= 301 && id <= 330) || (id >= 345 && id <= 350)) return [3, 4]
    return []
}

export const worldRecordPlatformNames = {3: 'Wii U', 4: 'Nintendo Switch'}

export function parseWorldRecordTime(value) {
    const text = String(value).trim()
    if (!/^(?:\d{1,3}:)?\d{1,2}:[0-5]\d$/.test(text)) return NaN
    const parts = text.split(':').map(Number)
    if (parts.length === 3 && parts[1] > 59) return NaN
    return parts.reduce((total, part) => total * 60 + part, 0)
}
