const {test} = require('node:test')
const assert = require('node:assert/strict')
const {pathToFileURL} = require('node:url')
const path = require('node:path')
const {defaultConfig} = require('next/dist/server/config-shared')
const {ImageOptimizerCache, getSharp, imageOptimizer} = require('next/dist/server/image-optimizer')
const sharp = require('sharp')

async function config() {
    const {default: project} = await import(pathToFileURL(path.resolve(__dirname, '../next.config.mjs')))
    return {...defaultConfig, ...project, images: {...defaultConfig.images, ...project.images}}
}

test('image optimizer keeps the Laravel image route and rejects other hosts, schemes and recursion', async () => {
    const nextConfig = await config()
    const validate = url => ImageOptimizerCache.validateParams(
        {headers: {accept: 'image/webp'}}, {url, w: '640', q: '75'}, nextConfig, false
    )
    for (const url of ['/img/bg29.jpg', 'http://laravel:8000/api/img/test-image.png']) {
        assert.equal(validate(url).errorMessage, undefined)
    }
    for (const url of [
        'http://127.0.0.1:8000/api/img/test.png',
        'http://laravel.example.invalid:8000/test.png',
        'http://laravel:8001/test.png',
        'https://laravel:8000/test.png',
        'file:///etc/passwd',
        '//example.invalid/test.png',
        '/_next/image?url=/img/bg29.jpg',
    ]) {
        assert.ok(validate(url).errorMessage, `must reject ${url}`)
    }
})

test('Next uses the patched native sharp and still optimizes an ordinary raster image', async () => {
    assert.equal(getSharp(null), sharp)
    const [major, minor, patch] = sharp.versions.sharp.split('.').map(Number)
    assert.ok(major > 0 || minor > 35 || (minor === 35 && patch >= 5))
    const buffer = await sharp({create: {width: 8, height: 4, channels: 3, background: 'white'}}).png().toBuffer()
    const result = await imageOptimizer(
        {buffer, contentType: 'image/png', cacheControl: null, etag: 'synthetic-raster'},
        {href: '/synthetic.png', width: 4, quality: 75, mimeType: 'image/webp'},
        await config(), {isDev: false, silent: true}
    )
    assert.equal(result.contentType, 'image/webp')
    assert.equal((await sharp(result.buffer).metadata()).width, 4)
})

test('SVG and non-image upstream bodies remain rejected by the optimizer', async () => {
    const nextConfig = await config()
    assert.equal(nextConfig.images.dangerouslyAllowSVG, false)
    for (const [contentType, body] of [
        ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'],
        ['text/html', '<html><body>synthetic upstream error</body></html>'],
    ]) {
        await assert.rejects(imageOptimizer(
            {buffer: Buffer.from(body), contentType, cacheControl: null, etag: 'synthetic-invalid'},
            {href: '/synthetic-image', width: 4, quality: 75, mimeType: 'image/webp'},
            nextConfig, {isDev: false, silent: true}
        ), error => error.statusCode === 400)
    }
})
