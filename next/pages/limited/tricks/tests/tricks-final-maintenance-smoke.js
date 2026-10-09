async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 10
    let requests = 0
    const player = {name: 'stats_test', draw_points: 4, total_rank_points: 2, card_count: 1, hand_limit: 6, take_count: 1}
    const card = {id: 302, event_card_id: 1302, stage_id: 7502, title: '統計テストカード', rule_name: 'テストルール', text: '合成データ', rarity: 2, difficulty: 1, creator: 'creator_test', was_opened: true}
    const state = {tournament: {event_id: 990405, title: '統計検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-08T12:00:00+09:00', me: player, players: [player], hand: [card], field: [{...card, taker: player.name, limit_at: '2099-01-01T00:00:00+09:00', stack_count: 5, live_total_reward: 5}], deck_count: 17, logs: [], draw_total: 12, take_total: 3, points_total: 29, post_total: 7}
    const stats = {users: [{user_id: player.name, total_rank_points: 2, draw_count: 12, earned_points: 21, spent_points: 17}], cards: [{event_card_id: 999, stage_id: null, title: '未テイクカード'}, {...card, field_seconds: 3900, post_count: 5, total_reward_points: 15, participants: [player.name], creator: 'creator_test', taker: player.name, holders: [player.name]}]}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: player.name, role}, expires: '2099-01-01'}
        else if (path === '/api/users') json = [{userId: player.name, name: 'テスト参加者'}, {userId: 'creator_test', name: 'テスト作者'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/admin-stats')) {
            requests += 1
            json = stats
        }
        else if (path.endsWith('/scores')) json = [{post_id: 1, post_rank: 1, user_id: player.name, score: 123, rule: 1, post_comment: '1234567890追加コメント', stage_id: 7502, created_at: state.server_now}]
        else if (path.endsWith('/collected')) json = []
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    const info = page.locator('[data-tricks-tournament-info]')
    await page.locator('[data-tricks-post-total]').filter({hasText: '7件'}).waitFor()
    assert((await info.innerText()).match(/投稿\s*7件/), '総投稿数')
    await page.getByRole('button', {name: 'ナレッジ', exact: true}).hover()
    await page.getByRole('tooltip', {name: 'ナレッジ', exact: true}).waitFor({timeout: 1000})
    await page.getByRole('button', {name: 'ナレッジ', exact: true}).click()
    const manual = page.locator('[data-tricks-manual]')
    await manual.waitFor()
    assert((await manual.innerText()).includes('1. まずは遊んでみましょう'), 'マニュアル本文')
    await page.waitForTimeout(400)
    await page.screenshot({path: 'output/playwright/tricks-final-manual.png'})
    await page.getByRole('button', {name: '閉じる', exact: true}).click()
    await info.click()
    const panel = page.locator('[data-tricks-admin-stats]')
    await panel.waitFor()
    assert(await panel.getByRole('tabpanel').count() === 1, 'ユーザータブのみ表示')
    await panel.getByRole('tab', {name: 'カード別ステータス', exact: true}).click()
    assert(await panel.locator('[data-tricks-card-stats] tbody tr').count() === 1, 'ステージIDなし除外')
    assert(await panel.locator('[data-tricks-card-stats] tbody td').nth(7).innerText() === '1', '参加者数')
    await page.screenshot({path: 'output/playwright/tricks-final-stats.png'})
    await page.keyboard.press('Escape')
    await page.locator('.tricks-dom-card-field[data-tricks-card-id="302"]').click()
    const comment = page.locator('[data-tricks-comment]')
    await comment.waitFor()
    assert((await comment.innerText()) === '1234567890…', '10文字省略')
    await comment.getByRole('button').click()
    assert((await comment.innerText()) === '1234567890追加コメント', 'コメント全文')
    await page.getByRole('button', {name: '閉じる', exact: true}).click()
    await page.locator('[data-tricks-log-toggle]').click()
    const log = page.locator('[data-tricks-log-wrapper]')
    const settled = async () => { await page.waitForTimeout(300); return await log.boundingBox() }
    let box = await settled()
    assert(box.height === 178 && box.y === 180, 'ログ初期位置')
    await page.locator('[data-tricks-log-dock]').click()
    box = await settled()
    assert(box.y + box.height === 1000, '最下部')
    const drag = async (edge, delta) => {
        const handle = await page.locator(`[data-tricks-log-resize="${edge}"]`).boundingBox()
        await page.mouse.move(handle.x + 100, handle.y + 3)
        await page.mouse.down()
        await page.mouse.move(handle.x + 100, handle.y + 3 + delta, {steps: 5})
        await page.mouse.up()
        return await settled()
    }
    box = await drag('top', -100)
    assert(box.height === 278 && box.y + box.height === 1000, '下部でドラッグ拡大')
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.height === 178, 'ドラッグ後compress')
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.height === 1000 && box.y === 0, '全高拡大')
    await page.screenshot({path: 'output/playwright/tricks-final-log.png'})
    await page.locator('[data-tricks-log-dock]').click()
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.height === 178 && box.y === 180, '元の位置と高さ復帰')
    box = await drag('bottom', 120)
    assert(box.height === 298, '元位置でドラッグ')
    box = await drag('bottom', -500)
    assert(box.height === 178, '最小高制約')
    box = await drag('bottom', 2000)
    assert(box.height === 1000 && box.y === 0, '最大高制約')
    await page.locator('[data-tricks-log-toggle]').click()
    assert(await log.getAttribute('data-log-open') === 'false', 'アイコン以外で格納')
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.y + box.height === 1000, '観戦の下部ログ')
    await page.locator('[data-tricks-log-dock]').click()
    box = await settled()
    assert(box.y === 180 && await page.locator('[data-tricks-spectator-toggle]').getAttribute('aria-pressed') === 'true', '観戦を維持して移動')
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.waitForTimeout(2500)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, '静止時Canvas再描画なし')
    await page.setViewportSize({width: 390, height: 844})
    if (await log.getAttribute('data-log-open') === 'false') await page.locator('[data-tricks-log-toggle]').click()
    await page.locator('[data-tricks-log-dock]').click()
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.height === 844 && box.y === 0 && box.width <= 390, 'モバイル画面内で最大化')
    await page.screenshot({path: 'output/playwright/tricks-final-mobile.png'})
    await page.locator('[data-tricks-log-expand]').click()
    box = await settled()
    assert(box.height === 178 && box.y + box.height === 844, 'モバイル下部で高さ復帰')
    return {passed: 'manual, immediate tooltip, stats tabs/filter/count, post total, comment, log dock/resize/expand/collapse, spectator, canvas idle', metrics: after}
}
