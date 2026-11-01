// Decimal literals need no math.js startup and never pass through floating point.
function evaluateLiteral(input) {
    const raw = typeof input === 'string' ? input : ''
    const failure = error => ({raw, value: '0e+0', display: '0', valid: false, error})
    if (typeof input !== 'string' || raw.length > 512) return failure('回答は512文字以内にしてください')
    const text = raw.normalize('NFKC').replace(/[−–]/g, '-').trim()
    if (!text) return {raw, value: '0e+0', display: '0', valid: true, error: null}
    const match = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?$/i.exec(text)
    if (!match) return null
    const [whole, fraction = ''] = match[2].split('.')
    const digits = whole + fraction
    const first = digits.search(/[1-9]/)
    if (first === -1) return {raw, value: '0e+0', display: '0', valid: true, error: null}
    const exponent = Number(match[3] || 0) + whole.length - first - 1
    if (!Number.isFinite(exponent) || Math.abs(exponent) > 100000) return failure('計算可能な範囲の有限の実数を入力してください')
    const significant = digits.slice(first, first + 30).replace(/0+$/, '')
    const sign = match[1] === '-' ? '-' : ''
    const value = sign + significant[0] + (significant.length > 1 ? '.' + significant.slice(1) : '') + 'e' + (exponent >= 0 ? '+' : '') + exponent
    let display = value
    if (exponent > -7 && exponent < 21) {
        const point = exponent + 1
        if (point <= 0) display = sign + '0.' + '0'.repeat(-point) + significant
        else if (point >= significant.length) display = sign + significant + '0'.repeat(point - significant.length)
        else display = sign + significant.slice(0, point) + '.' + significant.slice(point)
    }
    return {raw, value, display, valid: true, error: null}
}

module.exports = {evaluateLiteral}
