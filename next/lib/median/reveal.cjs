function compareValues(left, right) {
    const parts = value => {
        const [, negative, integer, fraction = '', exponent] = value.match(/^(-?)([0-9])(?:\.([0-9]+))?e([+-]?[0-9]+)$/)
        return {sign: integer === '0' ? 0 : negative ? -1 : 1, exponent: Number(exponent), digits: (integer + fraction).padEnd(30, '0')}
    }
    const a = parts(left), b = parts(right)
    if (a.sign !== b.sign) return a.sign - b.sign
    if (!a.sign) return 0
    return a.sign * (Math.sign(a.exponent - b.exponent) || (a.digits < b.digits ? -1 : a.digits > b.digits ? 1 : 0))
}

// One adjacent comparison per yield, preserving participant order for equal values.
function* bubbleFrames(answers) {
    const items = [...answers]
    for (let end = items.length - 1; end > 0; end--) {
        let swapped = false
        for (let i = 0; i < end; i++) {
            if (compareValues(items[i].value, items[i + 1].value) > 0) {
                const previous = items[i]
                items[i] = items[i + 1]
                items[i + 1] = previous
                swapped = true
            }
            yield [...items]
        }
        if (!swapped) break
    }
    return items
}

module.exports = {compareValues, bubbleFrames}
