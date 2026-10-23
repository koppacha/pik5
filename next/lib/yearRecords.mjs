export function japanYear(now = new Date()) {
    return Number(new Intl.DateTimeFormat('en', {timeZone: 'Asia/Tokyo', year: 'numeric'}).format(now))
}

export function parseRecordYear(value, now = new Date()) {
    return typeof value === 'string' && /^[0-9]{4}$/.test(value) && Number(value) >= 2014 && Number(value) <= japanYear(now)
        ? Number(value) : null
}

export function yearWindow(year, now = new Date()) {
    const current = year === japanYear(now)
    const cutoff = current ? now : new Date(`${year + 1}-01-01T00:00:00+09:00`)
    return {current, cutoff, start: year === 2014 ? null : new Date(`${year}-01-01T00:00:00+09:00`)}
}

export function evidenceUrl(value) {
    if (typeof value !== 'string') return null
    try {
        const url = new URL(value.trim())
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null
    } catch {
        return null
    }
}
