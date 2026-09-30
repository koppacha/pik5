import assert from 'node:assert/strict'
import {createServer} from 'node:net'
import {test} from 'node:test'
import {serverFetchJson} from '../lib/serverFetchJson.mjs'

async function withResponse(status, body, run) {
    // Laravel開発サーバーと同じ、Content-Lengthなし・切断で終端する応答。
    const server = createServer(socket => {
        socket.once('data', () => socket.end(
            `HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n${body}`
        ))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
        await run(`http://127.0.0.1:${server.address().port}`)
    } finally {
        await new Promise(resolve => server.close(resolve))
    }
}

test('大きな切断終端JSONを並列で繰り返し読み取れる', {timeout: 10000}, async () => {
    const expected = {data: 'a'.repeat(256 * 1024)}
    await withResponse('200 OK', JSON.stringify(expected), async url => {
        for (let i = 0; i < 5; i++) {
            const results = await Promise.all(Array.from({length: 3}, () => serverFetchJson(url)))
            results.forEach(result => assert.deepEqual(result, expected))
        }
    })
})

test('上流エラーと壊れたJSONは空データや404に置き換えない', async () => {
    await withResponse('503 Service Unavailable', '{}', async url => {
        await assert.rejects(serverFetchJson(url), /status 503/)
    })
    await withResponse('200 OK', '{', async url => {
        await assert.rejects(serverFetchJson(url), SyntaxError)
    })
})
