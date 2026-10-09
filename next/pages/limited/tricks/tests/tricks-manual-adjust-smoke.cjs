async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const player = {name: 'manual_test_taker', draw_points: 20, total_rank_points: 0, card_count: 1, hand_limit: 6, take_level: 0}
    const base = {rarity: 1, difficulty: 1, stack_count: 5, taker: player.name, my_can_extend: true, my_can_post: true, participant_count: 2, title: '還元確認A', rule_name: '試験', text: '試験', limit_at: '2099-01-01T00:00:00+09:00'}
    const a = {...base, id: 202, event_card_id: 1202, stage_id: 1202, live_total_reward: 11, provisional_total_reward: 11, provisional_taker_remainder: 1}
    const b = {...base, id: 203, event_card_id: 1203, stage_id: 1203, title: '還元確認B', live_total_reward: 5, provisional_total_reward: 5, provisional_taker_remainder: 1}
    const hand = {...base, id: 201, state: player.name, was_opened: false, title: '再抽選した手札'}
    const state = {tournament: {event_id: 990401, title: 'マニュアル整合検証', state: 'active', available: true, end_at: '2099-01-02T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: player, players: [player], field: [a, b], hand: [hand], deck_count: 17, logs: []}
    let extended = false
    await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: player.name, role: 0}, expires: '2099-01-01T00:00:00.000Z'}
        else if (path === '/api/users') json = [{userId: player.name, name: 'テイカー'}, {userId: 'manual_test_b', name: '参加者B'}, {userId: 'manual_test_c', name: '参加者C'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = ['manual_test_b', 'manual_test_c'].map((user, i) => ({post_id: i + 1, post_rank: 1, rank: 1, user_id: user, score: 999999, rule: 1, stage_id: 1202, rps: 2, provisional_reward_points: extended ? 3 : 5, created_at: state.server_now}))
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.endsWith('/extend')) {
            extended = true
            Object.assign(a, {live_total_reward: 6, provisional_total_reward: 6, provisional_taker_remainder: 0, my_can_extend: false})
            Object.assign(b, {live_total_reward: 11, provisional_total_reward: 11})
            json = {card: a}
        }
        else if (path.includes('/rank/')) json = {data: 1}
        await route.fulfill({json})
    })
    await page.addInitScript(() => { window.confirm = () => true })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    const card = page.locator('[data-tricks-card-id="202"]')
    assert(await card.locator('.tricks-dom-stack-value').innerText() === '11', 'ポット込み総還元P')
    assert(await page.locator('.tricks-dom-card-hand [data-tricks-opened]').count() === 0, '再抽選手札は開封済みなし')
    await card.click()
    await page.locator('[data-tricks-taker-remainder]').waitFor()
    assert((await page.locator('[data-tricks-taker-remainder]').innerText()).includes('1P'), '未投稿テイカー端数を別枠表示')
    await page.screenshot({path: 'output/playwright/tricks-taker-remainder.png'})
    await page.getByRole('button', {name: '延長', exact: true}).click()
    await page.waitForFunction(() => document.querySelector('[data-tricks-card-id="202"] .tricks-dom-stack-value')?.textContent === '6')
    assert(await page.locator('[data-tricks-card-id="203"] .tricks-dom-stack-value').innerText() === '11', '延長後のポット表示対象変更')
    assert(await page.locator('[data-tricks-taker-remainder]').count() === 0, '端数見込み再計算')
    await page.getByRole('button', {name: '投稿', exact: true}).click()
    await page.locator('#score').fill('1000000')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    await page.getByText('スコアの最大値は999,999です', {exact: true}).waitFor()
    await page.locator('#score').fill('999999')
    await page.getByRole('button', {name: '送信', exact: true}).click()
    await page.getByText('スコアの最大値は999,999です', {exact: true}).waitFor({state: 'hidden'})
    await page.getByRole('dialog').waitFor({state: 'hidden'})
    await page.waitForTimeout(2500)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, `静止時canvas再描画なし ${JSON.stringify({before, after})}`)
    return {passed: 'pot total, extension transfer, unposted taker remainder, rarity redraw, score boundary, canvas idle', metrics: after}
}
