async (page) => {
    await page.unrouteAll()
    const players = [{name: 'release_dummy', total_rank_points: 0, draw_points: 20, card_count: 0, hand_limit: 6, take_level: 0, take_count: 0}]
    const state = {tournament: {event_id: 990417, title: 'ログ表示検証', participant_count: 1, state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-09T12:00:00+09:00', me: players[0], players, hand: [], field: [], deck_count: 69, logs: [
        {id: 1, event: 'record_posted', actor_name: 'release_dummy', card_title: 'タイムカード', score_type: 'time', score: 83, rank: 1, created_at: '2026-10-09T12:00:00+09:00'},
        {id: 2, event: 'record_posted', actor_name: 'release_dummy', card_title: '点数カード', score_type: 'points', score: 123, rank: 1, created_at: '2026-10-09T12:00:00+09:00'}
    ]}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: 'release_dummy', role: 0}, expires: '2099-01-01T00:00:00.000Z'}
        else if (path === '/api/users') json = [{userId: 'release_dummy', name: '検証ユーザー'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('[data-tricks-log-toggle]').waitFor()
    if (!(await page.locator('[data-tricks-log-entry="1"]').isVisible())) await page.locator('[data-tricks-log-toggle]').click()
    const time = await page.locator('[data-tricks-log-entry="1"]').innerText()
    const points = await page.locator('[data-tricks-log-entry="2"]').innerText()
    if (!time.includes('01:23') || time.includes('83点')) throw new Error('タイムを秒から時間表示できていない')
    if (!points.includes('123点')) throw new Error('通常点数の表示が変わった')
    await page.screenshot({path: 'output/playwright/tricks-release-time-log.png'})
    const canvas = page.locator('canvas')
    if (!(await canvas.count())) throw new Error('canvas missing')
    await page.goto('about:blank')
    if (await page.locator('canvas').count()) throw new Error('canvas was not destroyed')
    return {time, points, canvasMountedAndRemoved: true}
}
