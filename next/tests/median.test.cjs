const {test} = require('node:test')
const assert = require('node:assert/strict')
const {createEvaluator} = require('../lib/median/evaluator.cjs')
const evaluate = createEvaluator(require('mathjs'))

test('decimal arithmetic, university functions, full width input and large exponents', () => {
    const cases = [['0.1+0.2', '3e-1'], ['９×（３＋１）', '3.6e+1'], ['sin(pi/2)', '1e+0'],
        ['combinations(10,3)', '1.2e+2'], ['5!', '1.2e+2'],
        ['nthRoot(27,3)', '3e+0'], ['', '0e+0'], ['   ', '0e+0'], ['1e100000', '1e+100000']]
    for (const [raw, expected] of cases) {
        const result = evaluate(raw)
        assert.equal(result.valid, true, raw)
        assert.equal(result.raw, raw)
        assert.equal(result.value, expected, raw)
    }
    assert.equal(evaluate('2^1000').value, '1.07150860718626732094842504906e+301')
    assert.ok(Math.abs(Number(evaluate('log(8,2)').display) - 3) < 1e-14)
})

test('truncate toward zero and use a canonical equality key', () => {
    assert.equal(evaluate('-1.2345678901234567890123456789019').value, '-1.2345678901234567890123456789e+0')
    assert.equal(evaluate('1e-100000').value, '1e-100000')
    assert.equal(evaluate('1.234567890123456789012345678901').value, evaluate('1.234567890123456789012345678909').value)
    assert.equal(evaluate('1/2').value, evaluate('0.5').value)
    assert.equal(evaluate('-0').value, '0e+0')
})

test('reject scripting, property access, assignments, non-scalars and non-finite values', () => {
    for (const input of ['Infinity', 'Inf', 'NaN', 'null', 'true', 'sqrt(-1)', '1/0', '[1,2]', '2 cm',
        'x=2', 'f(x)=x', 'import("x")', 'evaluate("1")', 'pi.constructor', 'pi[0]', 'random()', '1;2',
        '1e100001', '1e-100001', '2'.repeat(513), '('.repeat(30)+'1'+')'.repeat(30)]) {
        const result = evaluate(input)
        assert.equal(result.valid, false, input)
        assert.equal(result.value, '0e+0', input)
    }
})

test('decimal literal fast path preserves exact comparison and display without math startup', () => {
    const {evaluateLiteral} = require('../lib/median/literal.cjs')
    const inputs = ['123', '１２３', '−45', '-0', '.001', '+001.2300', '1e21', '1e-7', '1e100000', '1e-100000', '', '   ', '-1.2345678901234567890123456789019']
    for (let i = 0; i < 200; i++) inputs.push(`${i % 2 ? '-' : ''}000${i}.001234567890123456789012345678901e${i - 100}`)
    for (const input of inputs) {
        const actual = evaluateLiteral(input), expected = evaluate(input)
        assert.equal(actual.value, expected.value, input)
        assert.equal(actual.display, expected.display, input)
        assert.equal(actual.valid, expected.valid, input)
    }
    assert.equal(evaluateLiteral('1+2'), null)
    assert.equal(evaluateLiteral('1e100001').valid, false)
})
