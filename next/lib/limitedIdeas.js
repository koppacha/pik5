// End is exclusive: submissions are accepted through 19:59:59 JST.
export const LIMITED_IDEAS_START = '2026-09-13T00:00:00+09:00'
export const LIMITED_IDEAS_END = '2026-11-06T20:00:00+09:00'

export const isLimitedIdeasAdmin = user => String(user?.role) === '10'
export const canAccessLimitedIdeas = (user, now = Date.now()) =>
    isLimitedIdeasAdmin(user) || (now >= Date.parse(LIMITED_IDEAS_START) && now < Date.parse(LIMITED_IDEAS_END))

export const limitedIdeasRatio = count => (Math.max(100, Math.round(count / 2)) / 100).toFixed(2)

export function validateLimitedIdea(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '入力形式が不正です。'
    if (![2, 4].includes(value.title)) return 'タイトルを選択してください。'
    const start = value.title === 2 ? 201 : 401
    const end = value.title === 2 ? 230 : 428
    if (!Number.isInteger(value.stageId) || value.stageId < start || value.stageId > end) return 'タイトルに対応するステージを選択してください。'
    if (typeof value.ruleName !== 'string' || !value.ruleName.trim() || [...value.ruleName].length > 10) return 'ルール名は1〜10文字で入力してください。'
    if (!Number.isInteger(value.difficulty) || value.difficulty < 1 || value.difficulty > 5) return '難易度は1〜5を選択してください。'
    if (!['score', 'time'].includes(value.registrationMethod)) return '登録方法を選択してください。'
    if (typeof value.body !== 'string' || !value.body.trim() || [...value.body].length > 256) return '本文は1〜256文字で入力してください。'
    return null
}

export const formatLimitedIdeasDate = value => new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(new Date(value))
