async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 0
    const player = {name: 'ruling_test', draw_points: 10, total_rank_points: 0, card_count: 0, hand_limit: 6, take_level: 0}
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '裁定テスト切り札', rule_name: '元ルール', text: 'テスト本文', rarity: 1, difficulty: 1, stack_count: 2, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 1}
    const state = {tournament: {event_id: 990401, title: '裁定UI検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: player, players: [player], field: [card], hand: [], deck_count: 198, logs: []}
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
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    await page.locator('.tricks-dom-deck').click()
    const tooltip = page.getByRole('tooltip', {name: 'デッキ情報'})
    await tooltip.waitFor()
    assert(await tooltip.locator('strong').first().innerText() === 'デッキ 残り17枚', '残数ヘッダー')
    assert((await tooltip.locator('[data-tricks-deck-series]').innerText()).includes('ピクミン1：6枚'), 'シリーズ内訳')
    assert((await tooltip.locator('[data-tricks-deck-creators] > div').allTextContents()).join('|') === 'alice：7枚|bob：5枚|carol：2枚|dave：2枚|eve：1枚', '上位5名')
    await page.screenshot({path: 'output/playwright/tricks-deck-info.png'})
    await page.waitForTimeout(1000)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, 'canvas静止')
    await page.keyboard.press('Escape')
    await tooltip.waitFor({state: 'hidden'})
    await page.setViewportSize({width: 390, height: 844})
    await page.locator('.tricks-dom-deck').click()
    await tooltip.waitFor()
    const box = await tooltip.boundingBox()
    assert(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, 'スマホ画面内')
    await page.screenshot({path: 'output/playwright/tricks-deck-info-mobile.png'})
    return {passed: '3 columns, remaining header, creator top 5, escape, mobile, canvas idle', metrics: after}
}
