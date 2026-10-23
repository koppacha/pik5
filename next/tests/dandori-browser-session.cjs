// Ephemeral localhost-only login bridge: no password or cookies are printed or saved.
const http = require('node:http')
const {randomBytes} = require('node:crypto')
const {execFileSync} = require('node:child_process')

const userId = `codex_dandori_${randomBytes(4).toString('hex')}`
const testEnvironment = {...process.env, PIK5_TEST_USER_ID: userId, PIK5_POST_TEST_PASSWORD: randomBytes(24).toString('hex')}
const compose = ['compose', 'exec', '-T', '-e', 'PIK5_TEST_USER_ID', '-e', 'PIK5_POST_TEST_PASSWORD', 'next', 'node', '--experimental-strip-types', 'tests/dandori-local-user.cjs']
let identity
try {identity = JSON.parse(execFileSync('docker', compose, {env: testEnvironment, stdio: 'pipe'}).toString())} catch {console.error('Dedicated identity setup failed'); process.exit(1)}
const base = 'http://localhost:3015'
let cookies = []
function remember(response) {
    for (const cookie of response.headers.getSetCookie()) {
        const entry = cookie.split(';')[0]
        cookies = cookies.filter(previous => previous.split('=')[0] !== entry.split('=')[0])
        cookies.push(entry)
    }
}
const server = http.createServer(async (request, response) => {
    if (request.url !== '/login') {response.writeHead(404).end(); return}
    try {
        const csrf = await fetch(`${base}/api/auth/csrf`)
        remember(csrf)
        const {csrfToken} = await csrf.json()
        const login = await fetch(`${base}/api/auth/callback/credentials`, {method: 'POST', redirect: 'manual',
            headers: {'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ')},
            body: new URLSearchParams({csrfToken, userId, password: testEnvironment.PIK5_POST_TEST_PASSWORD, json: 'true', callbackUrl: `${base}/admin/stages`})})
        remember(login)
        const session = await fetch(`${base}/api/auth/session`, {headers: {cookie: cookies.join('; ')}}).then(result => result.json())
        if (session.user?.userId !== userId) throw new Error('Test login failed')
        const setCookies = cookies.map(cookie => `${cookie}; Path=/; HttpOnly; SameSite=Lax`)
        response.writeHead(302, {'Set-Cookie': setCookies, Location: `${base}/admin/stages`}).end()
        console.log('Dedicated test login succeeded')
    } catch {
        response.writeHead(503).end('Dedicated test login failed')
        console.log('Dedicated test login failed')
    }
})
server.listen(3017, '127.0.0.1', () => console.log('Dedicated browser login bridge ready on localhost:3017'))
let closing = false
function close() {
    if (closing) return
    closing = true
    server.close()
    try {
        execFileSync('docker', [...compose, '--delete'], {env: testEnvironment, stdio: 'pipe'})
        // Authentication and application databases may be separate; clean audit on Laravel's connection.
        const cleanup = "require 'vendor/autoload.php'; $app = require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); Illuminate\\Support\\Facades\\DB::table('login_events')->where('user_id', $argv[1])->delete();"
        execFileSync('docker', ['compose', 'exec', '-T', 'laravel', 'php', '-r', cleanup, identity.dbId], {stdio: 'pipe'})
    } catch {console.error('Dedicated test identity cleanup requires retry')}
    process.exit()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
setTimeout(close, 15 * 60 * 1000)
