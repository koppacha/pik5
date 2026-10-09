async (page) => {
    await page.unrouteAll()
    await page.setViewportSize({width: 1440, height: 1000})
    const results = []
    for (const path of ['/limited/tricks', '/limited/trick']) {
        await page.goto(`http://localhost:3005${path}`)
        await page.locator('[data-tricks-root]').waitFor()
        await page.getByText('第19回期間限定ランキング', {exact: true}).first().waitFor()
        const state = await page.evaluate(async () => {
            const response = await fetch('/api/server/tricks/state')
            if (!response.ok) throw new Error(`state HTTP ${response.status}`)
            const body = await response.json()
            const value = body.data ?? body
            return {event_id: value.tournament.event_id, title: value.tournament.title,
                available: value.tournament.available, start_at: value.tournament.start_at,
                end_at: value.tournament.end_at, debug: value.tournament.debug,
                test_mode: value.tournament.test_mode, deck: value.deck_count,
                participants: value.tournament.participant_count}
        })
        if (state.event_id !== 261009 || state.deck !== 160 || state.debug || state.test_mode
            || !state.start_at.startsWith('2026-10-09T20:00:00')
            || !state.end_at.startsWith('2026-10-11T19:59:00')) throw new Error(JSON.stringify(state))
        results.push({path, ...state})
    }
    await page.locator('canvas').waitFor({state: 'attached'})
    await page.screenshot({path: 'output/playwright/tricks-261009-live.png'})
    await page.goto('about:blank')
    return results
}
