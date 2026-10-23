import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fetcher} from '../lib/clientFetchJson.mjs'

test('fetcher preserves the JSON response shape', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({data: [1]})))
    assert.deepEqual(await fetcher('/api/server/new'), {data: [1]})
})

test('HTML rate limit responses retain status 429 without exposing the body', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('Synthetic proxy error', {status: 429}))
    await assert.rejects(fetcher('/api/server/new'), error => {
        assert.equal(error.status, 429)
        assert.equal(error.message, 'Request failed with status 429')
        return true
    })
})

test('unauthorized and upstream failures remain errors rather than empty data', async t => {
    for (const status of [401, 503]) {
        t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status}))
        await assert.rejects(fetcher('/api/server/new'), error => error.status === status)
    }
})
