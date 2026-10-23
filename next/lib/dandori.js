export const DANDORI_START = Date.parse('2026-11-12T00:00:00+09:00')

export function showDandoriBox(now, development) {
    return development || now >= DANDORI_START
}

export function dandoriMonthLabel(month, now) {
    const value = month || new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit'}).format(new Date(now))
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    return match ? `${match[1]}年${match[2]}月` : ''
}

export function dandoriDifficultyLabel(difficulty) {
    return ({1: 'おてがる', 2: 'ほんかく', 3: 'きわみ'})[difficulty] || '不明'
}

export function dandoriStagesForYear(catalog, year) {
    // Release dates are provided by the public catalog, including repeat appearances.
    return (catalog?.stages || []).filter(stage => !stage.first_publish_at || Number(new Intl.DateTimeFormat('en', {year: 'numeric', timeZone: 'Asia/Tokyo'}).format(new Date(stage.first_publish_at))) <= Number(year))
}
