async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 0
    const player = {name: 'ruling_test', draw_points: 10, total_rank_points: 0, card_count: 0, hand_limit: 6, take_level: 0}
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '裁定テスト切り札', rule_name: '元ルール', text: 'テスト本文', rarity: 1, difficulty: 1, stack_count: 2, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 1, creator: player.name}
    const state = {tournament: {event_id: 990401, title: '裁定UI検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: player, players: [player], field: [card], hand: [{...card, id: 303, stage_id: null, creator: player.name}], deck_count: 198, logs: []}
    state.deck_count = 17
    state.deck_difficulty_counts = {1: 1, 2: 2, 3: 3, 4: 4, 5: 7}
    state.deck_series_counts = {1: 6, 2: 5, 3: 4, 4: 2}
    state.deck_creator_counts = [{creator: 'alice', count: 7}, {creator: 'bob', count: 5}, {creator: 'carol', count: 2}, {creator: 'dave', count: 2}, {creator: 'eve', count: 1}]
    let requests = []
    await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: player.name, role}, expires: '2099-01-01T00:00:00.000Z'}
        else if (path === '/api/users') json = [{userId: player.name, name: 'テスト参加者'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = [{post_id: 1, post_rank: 1, user_id: player.name, score: 123, rule: 1, stage_id: 7402, rps: 2, created_at: state.server_now}]
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.endsWith('/rule') || path.endsWith('/reset')) {
            requests.push({path, data: route.request().postDataJSON()})
            json = {deleted: 1, compensated: 1}
            if (path.endsWith('/rule')) Object.assign(card, route.request().postDataJSON())
        }
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 720})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    const field = page.locator('.tricks-dom-card-field').first()
    const style = el => {
        const css = getComputedStyle(el)
        return Object.fromEntries(['color', 'fontSize', 'fontWeight', 'display', 'alignItems', 'gap'].map(key => [key, css[key]]))
    }
    const fieldStyle = await field.locator('.tricks-dom-card-creator').evaluate(style)
    const handStyle = await page.locator('.tricks-dom-card-hand .tricks-dom-card-creator').evaluate(style)
    assert(JSON.stringify(fieldStyle) === JSON.stringify(handStyle), 'クリエイターの共通スタイル')
    const baseline = await field.boundingBox()
    for (let round = 0; round < 3; round++) {
        await field.focus()
        let reachedDeck = false
        for (let i = 0; i < 30; i++) {
            await page.keyboard.press('Tab')
            if (await page.locator('.tricks-dom-deck').evaluate(el => el === document.activeElement)) {
                reachedDeck = true
                break
            }
        }
        assert(reachedDeck, 'Tabでデッキへ移動できる')
        const bounds = await field.boundingBox()
        assert(bounds.y === baseline.y && bounds.x === baseline.x, 'フォーカス移動後の切り札座標')
        assert(await page.evaluate(() => [...document.querySelectorAll('[data-tricks-root], [data-tricks-game-layer]')].every(el => el.scrollTop === 0 && el.scrollLeft === 0)), 'ネイティブスクロールなし')
    }
    await page.evaluate(() => {
        document.querySelectorAll('[data-tricks-root], [data-tricks-game-layer]').forEach(el => { el.scrollTop = 155 })
    })
    assert((await field.boundingBox()).y === baseline.y, '強制スクロールでも初期位置を維持')
    await page.screenshot({path: 'output/playwright/tricks-focus-scroll.png'})
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(1200)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping && after.activeRaf === 0 && after.activeTimers === 0, 'Canvas静止・タイマー残留なし')
    state.field = Array.from({length: 10}, (_, index) => ({...card, id: 202 + index, stage_id: 7402 + index}))
    await page.reload()
    await page.locator('canvas').waitFor()
    const first = page.locator('.tricks-dom-card-field[data-tricks-card-id="202"]')
    await first.waitFor()
    const initial = await first.boundingBox()
    await page.mouse.move(initial.x + 240, initial.y + 20)
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(200)
    assert((await first.boundingBox()).y < initial.y, '通常の切り札ホイールスクロールを維持')
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(200)
    assert((await first.boundingBox()).y === initial.y, 'ホイールで元の位置へ戻る')
    return {passed: 'shared creator style, repeated Tab to deck, forced native scroll blocked, wheel scrolling preserved, canvas idle', metrics: after}
}
