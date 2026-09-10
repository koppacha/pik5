async (page) => {
    await page.route("**/api/auth/session", route => route.fulfill({json: {user: {userId: "revision_test", role: 0}, expires: "2099-01-01"}}))
    await page.route("**/api/users", route => route.fulfill({json: []}))
    const now = Date.now()
    const me = {name: "revision_test", draw_points: 8, card_count: 0, rank_points: 0}
    const field = [
        {id: 1, title: "投稿済み・無料の場札", my_has_record: true, my_initial_post_cost: 0},
        {id: 2, title: "未投稿・無料の場札", my_has_record: false, my_initial_post_cost: 0},
        {id: 3, title: "未投稿・有料の場札", my_has_record: false, my_initial_post_cost: 2},
    ].map(card => ({
        ...card, state: "_field", stage_id: 399, rarity: 2, difficulty: 2, stack_count: 5,
        my_can_post: true, rule_name: "表示確認用ルール", text: "専用の合成データでマークの表示位置を検証します。",
        creator: "revision_test", taker: "revision_test", taken_at: new Date(now - 600000).toISOString(),
        limit_at: new Date(now + 3600000).toISOString(),
    }))
    const state = {
        tournament: {event_id: 999999, available: true, state: "active", debug: true,
            start_at: new Date(now - 3600000).toISOString(), end_at: new Date(now + 86400000).toISOString(), now: new Date(now).toISOString()},
        me, players: [me], field, hand: [], deck_count: 185, trash_count: 0, logs: [],
    }
    await page.route("**/api/server/tricks/**", route => route.fulfill({json: route.request().url().endsWith("/state") ? state : {}}))
    await page.setViewportSize({width: 1280, height: 900})
    await page.goto("http://localhost:3005/limited/tricks")
    await page.waitForTimeout(2500)
    const counts = {checks: await page.locator("[data-tricks-posted]").count(), free: await page.locator("[data-tricks-free]").count()}
    if (counts.checks !== 1 || counts.free !== 2) throw new Error(JSON.stringify(counts))
    await page.screenshot({path: "output/playwright/tricks-marks-desktop.png"})
    const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__?.())
    await page.waitForTimeout(30000)
    const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__?.())
    console.log({counts, before, after})
    await page.evaluate(result => { window.__REVISION_SMOKE__ = result }, {counts, before, after})
    field[0].my_has_record = false
    field[1].my_can_post = false
    await page.waitForTimeout(3500)
    if (await page.locator("[data-tricks-posted]").count() !== 0 || await page.locator("[data-tricks-free]").count() !== 1) throw new Error("polling state transition failed")
    await page.setViewportSize({width: 390, height: 844})
    await page.waitForTimeout(800)
    await page.screenshot({path: "output/playwright/tricks-marks-mobile.png"})
    console.log("marks and polling transitions passed")
}
