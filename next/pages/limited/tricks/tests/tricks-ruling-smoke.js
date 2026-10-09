async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 10
    const player = {name: 'ruling_test', draw_points: 10, total_rank_points: 0, card_count: 0, hand_limit: 6, take_level: 0}
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '裁定テスト切り札', rule_name: '元ルール', text: 'テスト本文', rarity: 1, difficulty: 1, stack_count: 2, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 1}
    const state = {tournament: {event_id: 990401, title: '裁定UI検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: player, players: [player], field: [card], hand: [], deck_count: 198, logs: []}
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
    await page.locator('.tricks-dom-card-field').click()
    await page.getByRole('button', {name: 'ルール変更', exact: true}).click()
    await page.getByRole('textbox', {name: /ルール本文/}).fill('裁定後の本文')
    await page.waitForTimeout(300)
    await page.screenshot({path: 'output/playwright/tricks-rule-edit.png'})
    await page.getByRole('button', {name: '変更を保存'}).click()
    await page.getByRole('dialog').waitFor({state: 'hidden'})
    assert(requests[0].data.text === '裁定後の本文', '本文編集送信')
    await page.locator('.tricks-dom-card-field').click()
    await page.getByRole('button', {name: 'リセット', exact: true}).click()
    assert(requests.length === 1, '確認表示時は削除しない')
    await page.getByText('ランキングをリセットしますか？', {exact: true}).waitFor()
    await page.waitForTimeout(300)
    await page.screenshot({path: 'output/playwright/tricks-ranking-reset.png'})
    await page.getByRole('button', {name: 'キャンセル'}).click()
    assert(requests.length === 1, 'キャンセルは削除しない')
    await page.getByRole('button', {name: 'リセット', exact: true}).click()
    await page.getByRole('button', {name: 'リセットする', exact: true}).click()
    await page.getByRole('dialog').waitFor({state: 'hidden'})
    assert(requests.length === 2 && requests[1].path.endsWith('/reset'), '確認後のみリセット')
    await page.waitForTimeout(500)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, '静止中canvas再描画なし')
    role = 0
    await page.reload()
    await page.locator('.tricks-dom-card-field').click()
    assert(await page.getByRole('button', {name: 'ルール変更', exact: true}).count() === 0, '一般ユーザーにルール変更非表示')
    assert(await page.getByRole('button', {name: 'リセット', exact: true}).count() === 0, '一般ユーザーにリセット非表示')
    return {passed: 'admin edit, confirmation, cancel, reset, ordinary user, canvas idle', metrics: after}
}
