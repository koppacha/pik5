// Shared with the isolated server worker. Never evaluate JavaScript from an answer.
function createEvaluator({create, all}) {
    const math = create(all, {number: 'BigNumber', precision: 64, relTol: 0, absTol: 0})
    const functions = new Set(['abs', 'sqrt', 'cbrt', 'nthRoot', 'exp', 'log', 'log10', 'log2',
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
        'asinh', 'acosh', 'atanh', 'floor', 'ceil', 'round', 'sign', 'min', 'max',
        'factorial', 'combinations', 'permutations', 'gamma'])
    const constants = new Set(['pi', 'e', 'tau', 'phi'])
    const operators = new Set(['add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus', 'factorial', 'mod'])
    return input => {
        const raw = typeof input === 'string' ? input : ''
        const failure = error => ({raw, value: '0e+0', display: '0', valid: false, error})
        if (typeof input !== 'string' || raw.length > 512) return failure('回答は512文字以内にしてください')
        const expression = raw.normalize('NFKC').replace(/[−–]/g, '-').replace(/[×・]/g, '*')
            .replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt')
        if (!expression.trim()) return {raw, value: '0e+0', display: '0', valid: true, error: null}
        try {
            const tree = math.parse(expression)
            let count = 0
            const visit = (node, depth = 0) => {
                if (++count > 160 || depth > 24) throw new Error('complex')
                if (node.isConstantNode) {
                    if (typeof node.value !== 'string' && !math.isBigNumber(node.value) && typeof node.value !== 'number') throw new Error('constant')
                    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(node.value))) throw new Error('constant')
                } else if (node.isSymbolNode) {
                    if (!constants.has(node.name)) throw new Error('symbol')
                } else if (node.isOperatorNode) {
                    if (!operators.has(node.fn)) throw new Error('operator')
                    node.args.forEach(arg => visit(arg, depth + 1))
                } else if (node.isFunctionNode) {
                    if (!node.fn.isSymbolNode || !functions.has(node.fn.name) || node.args.length > 8) throw new Error('function')
                    node.args.forEach(arg => visit(arg, depth + 1))
                } else if (node.isParenthesisNode) visit(node.content, depth + 1)
                else throw new Error('syntax')
            }
            visit(tree)
            const result = tree.compile().evaluate()
            if (!math.isBigNumber(result) && typeof result !== 'number') return failure('有限の実数を入力してください')
            const number = math.bignumber(result)
            if (!number.isFinite() || (!number.isZero() && Math.abs(number.e) > 100000)) return failure('計算可能な範囲の有限の実数を入力してください')
            const truncated = number.toSignificantDigits(30, 1)
            return {raw, value: truncated.isZero() ? '0e+0' : truncated.toExponential(), display: truncated.toString(), valid: true, error: null}
        } catch {
            return failure('式を確認してください（対応する関数・定数と有限の実数のみ使用できます）')
        }
    }
}

module.exports = {createEvaluator}
