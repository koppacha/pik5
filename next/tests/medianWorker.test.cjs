const {test} = require('node:test')
const assert = require('node:assert/strict')
const {readFile, mkdtemp, rm} = require('node:fs/promises')
const {pathToFileURL} = require('node:url')
const path = require('node:path')
const os = require('node:os')

async function loadServer(workerClass) {
    const evaluator = pathToFileURL(path.resolve(__dirname, '../lib/median/evaluator.cjs')).href
    const literal = pathToFileURL(path.resolve(__dirname, '../lib/median/literal.cjs')).href
    const source = (await readFile(path.resolve(__dirname, '../lib/median/server.js'), 'utf8'))
        .replace("import {createEvaluator} from './evaluator.cjs'", `import evaluator from ${JSON.stringify(evaluator)}\nconst {createEvaluator} = evaluator`)
    let transformed = source.replace("import {evaluateLiteral} from './literal.cjs'", `import literal from ${JSON.stringify(literal)}\nconst {evaluateLiteral} = literal`)
    if (workerClass) {
        globalThis.__medianTestWorker = workerClass
        transformed = transformed.replace("import {Worker} from 'worker_threads'", 'const Worker = globalThis.__medianTestWorker')
    }
    return import(`data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`)
}

test('actual evaluation worker accepts integers, zero, negative values and decimals', async () => {
    const {evaluateAnswer} = await loadServer()
    for (const [raw, value] of [['123', '1.23e+2'], ['0', '0e+0'], ['-45', '-4.5e+1'], ['0.1+0.2', '3e-1'], ['sin(pi/2)', '1e+0']]) {
        const result = await evaluateAnswer(raw)
        assert.equal(result.valid, true, raw)
        assert.equal(result.value, value, raw)
    }
})

test('missing runtime dependency is distinguished from an invalid answer', async () => {
    const {evaluateAnswer} = await loadServer()
    const original = process.cwd()
    const directory = await mkdtemp(path.join(os.tmpdir(), 'median-worker-missing-'))
    try {
        process.chdir(directory)
        await assert.rejects(evaluateAnswer('1+2'), {message: 'EVALUATOR_UNAVAILABLE'})
    } finally {
        process.chdir(original)
        await rm(directory, {recursive: true, force: true})
    }
})


test('slow worker startup is outside the computation budget', async () => {
    const {EventEmitter} = require('node:events')
    class SlowStartup extends EventEmitter {
        constructor() {super(); this.timer = setTimeout(() => this.emit('message', {ready: true}), 2100)}
        postMessage() {this.emit('message', {result: {valid: true, value: '3e+0'}})}
        terminate() {clearTimeout(this.timer)}
    }
    const {evaluateAnswer} = await loadServer(SlowStartup)
    const result = await evaluateAnswer('1+2')
    assert.equal(result.valid, true)
    assert.equal(result.value, '3e+0')
    delete globalThis.__medianTestWorker
})
