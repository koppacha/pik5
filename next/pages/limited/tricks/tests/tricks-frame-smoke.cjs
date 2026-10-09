async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 0
    const player = {name: 'ruling_test', draw_points: 10, total_rank_points: 0, card_count: 0, hand_limit: 6, take_level: 0}
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '裁定テスト切り札', rule_name: '元ルール', text: 'テスト本文', rarity: 1, difficulty: 1, stack_count: 40, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 1, creator: player.name, taker: player.name}
    const state = {tournament: {event_id: 990401, title: '裁定UI検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: player, players: [player], field: [card, {...card, id: 203, stage_id: 7403}], hand: [{...card, id: 303, stage_id: null, creator: player.name, taker: player.name}], deck_count: 198, logs: []}
    state.holder_cards = [{...card, player_name: player.name}]
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
    const field = page.locator('.tricks-dom-card-field[data-tricks-card-id="202"]')
    const next = page.locator('.tricks-dom-card-field[data-tricks-card-id="203"]')
    await field.waitFor()
    const check = async () => {
        const colors = await page.evaluate(() => ({
            deck: getComputedStyle(document.querySelector('.tricks-dom-deck')).borderTopColor,
            face: getComputedStyle(document.querySelector('.tricks-dom-card-field .tricks-dom-card-face')).borderTopColor,
            hand: getComputedStyle(document.querySelector('.tricks-dom-card-hand .tricks-dom-card-face')).borderTopColor,
            frame: getComputedStyle(document.querySelector('.tricks-dom-card-field .tricks-card-border')).backgroundColor,
            mini: getComputedStyle(document.querySelector('[data-tricks-mini-holder-cards] button')).borderTopColor,
            miniFrame: getComputedStyle(document.querySelector('[data-border-mini]')).backgroundColor,
        }))
        assert(Object.values(colors).every(color => color === 'rgb(128, 128, 128)'), 'デッキ・C1・ミニカードの灰色フレーム')
        const alignment = await field.locator('.tricks-dom-card-taker').evaluate(el => ({justify: getComputedStyle(el).justifyContent, text: getComputedStyle(el).textAlign, right: el.getBoundingClientRect().right, parentRight: el.parentElement.getBoundingClientRect().right}))
        assert(alignment.justify === 'flex-end' && alignment.text === 'right' && Math.abs(alignment.right - alignment.parentRight) < 1, 'テイカー右寄せ')
        const backs = await field.locator('.tricks-dom-card-back').evaluateAll(els => els.map(el => ({right: el.getBoundingClientRect().right, offset: new DOMMatrixReadOnly(getComputedStyle(el).transform).m41})))
        const bounds = await next.boundingBox()
        assert(backs.length === 5 && Math.max(...backs.map(b => b.offset)) === 20, '最大スタック5枚・4px間隔')
        const gap = bounds.x - Math.max(...backs.map(b => b.right))
        assert(gap >= 2, '隣のカードまで2px以上の余白')
        return {colors, gap}
    }
    const first = await check()
    await page.getByRole('button', {name: 'テーマ変更', exact: true}).click()
    await page.waitForTimeout(300)
    const second = await check()
    assert(JSON.stringify(first.colors) === JSON.stringify(second.colors), 'テーマ変更後も同色')
    await page.screenshot({path: 'output/playwright/tricks-frame-gray.png'})
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(1200)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping && after.activeRaf === 0 && after.activeTimers === 0, 'Canvas静止・追加タイマーなし')
    return {passed: 'gray deck/C1/mini in both themes, right aligned taker, maximum stack spacing, canvas idle', gap: second.gap, metrics: after}
}
