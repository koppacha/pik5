async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const players = ['time_test_dummy', 'time_slow_dummy'].map(name => ({name, total_rank_points: 0, draw_points: 20, card_count: 0, hand_limit: 6, take_level: 0, take_count: 0}))
    const card = {id: 202, event_card_id: 1202, stage_id: 1491, score_type: 'time', title: 'ダミータイムステージ', rule_name: 'クリアタイム', text: '経過時間が短い方を上位とする。整数秒で計測。', rarity: 1, difficulty: 1, stack_count: 3, creator: players[0].name, taker: players[0].name, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 2}
    const state = {tournament: {event_id: 990412, title: 'タイム基準検証', participant_count: 2, state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-09T12:00:00+09:00', me: players[0], players, hand: [], field: [card], deck_count: 69, logs: []}
    const posts = []
    await page.route('**/api/**', async route => {
        const req = route.request()
        const path = new URL(req.url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: players[0].name, role: 0}, expires: '2099-01-01T00:00:00.000Z'}
        else if (path === '/api/users') json = players.map(p => ({userId: p.name, name: p.name}))
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = [83, 120].map((score, i) => ({post_id: i + 1, unique_id: `dummy_${i}`, user_id: players[i].name, user_name: players[i].name, score, score_type: card.score_type, stage_id: card.stage_id, rule: 1, console: 1, rank: i + 1, post_rank: i + 1, rps: 3 - i, post_comment: '', created_at: '2026-10-09T12:00:00+09:00'}))
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.startsWith('/api/server/record/rank/')) json = 1
        else if (path.startsWith('/api/server/count/')) json = {post_count: 100, first_posted_at: '2020-01-01'}
        else if (path.startsWith('/api/server/stage/')) json = {stage_id: 1491, display: card.score_type === 'time' ? 'time' : 'int'}
        else if (path === '/api/token') json = {token: 'synthetic-placeholder'}
        else if (path === '/api/server/post') {
            const body = req.postData()
            const read = key => body.match(new RegExp(`name="${key}"\\r?\\n\\r?\\n([^\\r\\n]+)`))?.[1]
            posts.push({score: read('score'), rule: read('rule'), event: read('tricks_event_id')})
            json = ['OK', 200]
        }
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('.tricks-dom-card-field').first().waitFor()
    const openForm = async () => {
        await page.locator('.tricks-dom-card-field').first().click()
        await page.locator('[data-tricks-post-button]').click()
        await page.locator('#time').waitFor({state: 'attached'})
    }
    await page.locator('.tricks-dom-card-field').first().click()
    await page.getByText('01:23', {exact: true}).waitFor()
    await page.getByText('02:00', {exact: true}).waitFor()
    await page.screenshot({path: 'output/playwright/tricks-time-ranking.png'})
    await page.locator('[data-tricks-post-button]').click()
    assert(await page.locator('#time').isVisible(), 'タイムカードは時間入力を表示')
    assert(await page.locator('#score').isDisabled(), '秒数は自動計算')
    await page.locator('#time').fill('01:23')
    await page.waitForFunction(() => document.querySelector('#score').value === '83')
    await page.locator('#time').fill('01:99')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    assert(posts.length === 0, '不正な秒フォーマットを拒否')
    await page.locator('#time').fill('00:00:00')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    assert(posts.length === 0, '0秒を拒否')
    await page.locator('#time').fill('01:02:03')
    await page.waitForFunction(() => document.querySelector('#score').value === '3723')
    await page.locator('#time').fill('01:23')
    await page.waitForFunction(() => document.querySelector('#time').getAttribute('aria-invalid') === 'false')
    assert(await page.locator('#rule').inputValue() === 'タイム基準検証', 'カテゴリ名は大会タイトル')
    await page.screenshot({path: 'output/playwright/tricks-time-input.png'})
    await page.getByRole('button', {name: '送信', exact: true}).click()
    await page.waitForFunction(() => !document.querySelector('#time'))
    assert(posts[0]?.score === '83' && posts[0]?.rule === '990412' && posts[0]?.event === '990412', '整数秒83を送信')
    await openForm()
    await page.locator('#time').fill('00:00:01')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    await page.waitForFunction(() => !document.querySelector('#time'))
    assert(posts[1]?.score === '1', '1秒の送信を許可')
    card.score_type = 'points'
    await page.reload()
    await openForm()
    assert(!await page.locator('#time').isVisible(), 'ポイントカードは時間入力を隠す')
    assert(await page.locator('#score').isEnabled(), 'ポイントカードのスコア入力を有効化')
    await page.locator('#score').fill('120')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    await page.waitForFunction(() => !document.querySelector('#time'))
    assert(posts[2]?.score === '120', 'ポイントカードは120点を送信')
    await page.locator('canvas').waitFor()
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping === true)
    await page.waitForTimeout(300)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(1200)
    const metrics = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(metrics.activeRaf === 0 && metrics.activeTimers === 0 && metrics.phaserRenderCount === before.phaserRenderCount, '静止時に描画ループとタイマーを残さない')
    return {metrics, passed: 'time format, seconds conversion, validation, time/points switch, multipart payload, canvas', posts}
}
