import {test} from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

// Explicit opt-in: run against an isolated production build with synthetic configuration.
const base = process.env.NEXT_SECURITY_TEST_BASE_URL
if (base) {
    const url = new URL(base)
    assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    assert.equal(url.username + url.password, '')
}
const options = {skip: !base}
const request = (pathname, init = {}) => fetch(new URL(pathname, base), {
    ...init, signal: AbortSignal.timeout(15000), redirect: 'manual',
})

test('Japanese and English login SSR retain CSS-in-JS and the local background image', options, async () => {
    for (const [pathname, locale] of [['/auth/login', 'ja'], ['/en/auth/login', 'en']]) {
        const response = await request(pathname)
        assert.equal(response.status, 200)
        const html = await response.text()
        assert.ok(html.includes(`<html lang="${locale}"`))
        assert.ok(html.includes('data-styled='))
        assert.ok(html.includes('data-emotion='))
        assert.ok(html.includes('bg29.jpg'))
        assert.ok(html.includes('__initial-loading'))
    }
})

test('production optimizer returns a raster image and rejects forbidden URLs', options, async () => {
    const response = await request('/_next/image?url=%2Fimg%2Fbg29.jpg&w=640&q=75', {
        headers: {accept: 'image/webp'},
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /^image\//)
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 640)
    for (const url of ['http://127.0.0.1:8000/test.png', '//example.invalid/image.png', '/_next/image?url=/img/bg29.jpg']) {
        assert.equal((await request(`/_next/image?${new URLSearchParams({url, w: '640', q: '75'})}`)).status, 400)
    }
})

test('Pages API and anonymous NextAuth session preserve their response contracts', options, async () => {
    const hello = await request('/api/hello')
    assert.equal(hello.status, 200)
    assert.deepEqual(await hello.json(), {name: 'John Doe'})
    const session = await request('/api/auth/session')
    assert.equal(session.status, 200)
    assert.deepEqual(await session.json(), {})
    const csrf = await request('/api/auth/csrf')
    assert.equal(csrf.status, 200)
    assert.equal(typeof (await csrf.json()).csrfToken, 'string')
    const revalidate = await request('/api/revalidate')
    assert.equal(revalidate.status, 405)
    assert.equal(revalidate.headers.get('allow'), 'POST')
})

test('SSG HTML and Next data stay distinct after requests with forged routing headers', options, async () => {
    for (const prefix of ['', '/en']) {
        const pathname = `${prefix}/keyword/tricks-manual`
        const before = await request(pathname)
        assert.equal(before.status, 200)
        const html = await before.text()
        const data = JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)[1])
        const locale = prefix ? 'en' : 'ja'
        const jsonPath = `/_next/data/${data.buildId}/${locale}/keyword/tricks-manual.json`
        const jsonResponse = await request(jsonPath)
        assert.equal(jsonResponse.status, 200)
        const json = await jsonResponse.json()
        assert.deepEqual(json.pageProps, data.props.pageProps)
        for (const headers of [
            {'x-nextjs-data': '1', 'x-matched-path': '/api/hello'},
            {'x-now-route-matches': 'path=api%2Fhello', 'x-invoke-path': '/api/hello'},
        ]) {
            const crafted = await request(pathname, {headers})
            await crafted.arrayBuffer()
            const clean = await request(pathname)
            assert.equal(clean.status, 200)
            assert.match(clean.headers.get('content-type'), /^text\/html/)
            assert.equal(await clean.text(), html)
        }
        const after = await request(jsonPath)
        assert.equal(after.status, 200)
        assert.deepEqual((await after.json()).pageProps, json.pageProps)
    }
})
