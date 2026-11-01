const {test} = require('node:test')
const assert = require('node:assert/strict')
const {compareValues, bubbleFrames} = require('../lib/median/reveal.cjs')

test('bubble reveal makes only adjacent swaps and sorts exact large and negative values', () => {
    const original = ['1e+10000', '2e+0', '-1e+10000', '0e+0'].map((value, index) => ({value, playerId: String(index)}))
    let previous = original
    const frames = bubbleFrames(original)
    let step
    while (!(step = frames.next()).done) {
        const changed = step.value.flatMap((answer, index) => answer.playerId === previous[index].playerId ? [] : [index])
        assert.ok(changed.length === 0 || (changed.length === 2 && changed[1] === changed[0] + 1))
        previous = step.value
    }
    assert.deepEqual(step.value.map(a => a.value), ['-1e+10000', '0e+0', '2e+0', '1e+10000'])
    assert.equal(original[0].value, '1e+10000')
    assert.ok(compareValues('1.00000000000000000000000000001e+0', '1.00000000000000000000000000002e+0') < 0)
})

test('equal answers retain participant order and an ordered pass terminates early', () => {
    const initial = [{playerId:'first',value:'1e+0'},{playerId:'second',value:'1e+0'},{playerId:'third',value:'2e+0'}]
    const frames = Array.from(bubbleFrames(initial))
    assert.equal(frames.length, 2)
    assert.deepEqual(frames.at(-1).map(a=>a.playerId), ['first','second','third'])
    assert.equal(bubbleFrames([]).next().done, true)
    assert.equal(bubbleFrames([initial[0]]).next().done, true)
})
