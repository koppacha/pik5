const {expect, test} = require("@playwright/test")
const {createTricksFixture, testIdentityHeaders} = require("./tricks-fixture")

test.describe("limited tricks phase 6", () => {
    test("unauthenticated visitors cannot join or draw", async ({page}) => {
        await page.goto("/limited/tricks")
        await expect(page.getByText("ログインが必要です", {exact: true})).toBeVisible()
        await expect(page.getByRole("button", {name: "参加", exact: true})).toHaveCount(0)
        await expect(page.getByRole("button", {name: "ドロー", exact: true})).toBeDisabled()
    })

    test("fixture API creates 200 isolated cards and keeps player identities separate", async ({request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        try {
            expect(fixture.result.counts).toEqual(expect.objectContaining({
                events: 1,
                decks: 200,
                event_cards: 200,
                players: 2,
            }))
            const [alice, bob] = await Promise.all([
                fixture.get(fixture.players[0], "/api/server/tricks/state"),
                fixture.get(fixture.players[1], "/api/server/tricks/state"),
            ])
            expect(alice.tournament.event_id).toBe(fixture.eventId)
            expect(alice.me.name).toBe(fixture.players[0])
            expect(alice.hand).toHaveLength(3)
            expect(bob.me.name).toBe(fixture.players[1])
            expect(bob.hand).toHaveLength(0)
            expect(alice.deck_count).toBe(197)
        } finally {
            await fixture.cleanup()
        }
    })

    test("two browser sessions render the same event without sharing private hands", async ({browser, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        const contexts = await Promise.all([browser.newContext(), browser.newContext()])
        try {
            const pages = await Promise.all(contexts.map((context) => context.newPage()))
            for (let index = 0; index < pages.length; index += 1) {
                const userId = fixture.players[index]
                await pages[index].route("**/api/server/tricks/**", async (route) => {
                    await route.continue({headers: {...route.request().headers(), ...testIdentityHeaders(userId, fixture.eventId)}})
                })
            }
            await Promise.all(pages.map((page) => page.goto("/limited/tricks")))
            await Promise.all(pages.map((page) => expect(page.locator("canvas")).toBeVisible()))
            await expect(pages[0].getByText("P 20 / 手札 3", {exact: true})).toBeVisible()
            await expect(pages[1].getByText("P 20 / 手札 0", {exact: true})).toBeVisible()
            await expect(pages[0].getByText("P 20 / 手札 3 / 捨て札 0", {exact: true})).toHaveCount(0)
            await expect(pages[0].locator("[data-tricks-tournament-info]")).toBeVisible()
            await expect(pages[0].locator("[data-tricks-header-scroll] > div:last-child > *").first())
                .toHaveAttribute("data-tricks-tournament-info", "true")
            expect(await pages[0].locator("canvas").count()).toBe(1)
            expect(await pages[1].locator("canvas").count()).toBe(1)
        } finally {
            await Promise.all(contexts.map((context) => context.close()))
            await fixture.cleanup()
        }
    })

    test("controlled time advances through take expiry without natural waiting", async ({request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        try {
            const state = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            const selected = state.hand[0]
            const taken = await fixture.post(
                fixture.players[0],
                `/api/server/tricks/cards/${selected.id}/take`,
            )
            expect(taken.card.state).toBe("_field")
            expect(taken.card.stack_count).toBe(3)

            const advanced = await fixture.post(fixture.admin, "/api/server/tricks/debug/time/advance", {minutes: 90})
            expect(advanced.collected).toBeGreaterThanOrEqual(1)
            const after = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            expect(after.field).toHaveLength(0)
        } finally {
            await fixture.cleanup()
        }
    })

    test("field cards stay clipped below the header in a compact viewport", async ({page, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        await page.setViewportSize({width: 800, height: 720})
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            const state = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            await fixture.post(fixture.players[0], `/api/server/tricks/cards/${state.hand[0].id}/take`)
            await page.goto("/limited/tricks")

            const card = page.locator(".tricks-dom-card-field")
            await expect(card).toBeVisible()
            await page.mouse.move(300, 300)
            await page.mouse.wheel(0, 1000)
            await expect(page.getByRole("link", {name: "ホームに戻る"})).toBeVisible()
            const fieldCardInHeader = await page.evaluate(() => {
                return Boolean(document.elementFromPoint(30, 110)?.closest(".tricks-dom-card-field"))
            })
            expect(fieldCardInHeader).toBe(false)
        } finally {
            await fixture.cleanup()
        }
    })

    test("canvas remains idle and bounded during a 30 second observation", async ({page, request, baseURL}) => {
        test.setTimeout(60000)
        const fixture = await createTricksFixture(request, baseURL)
        const errors = []
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text())
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            await expect(page.locator("canvas")).toBeVisible()
            await page.waitForFunction(() => typeof window.__TRICKS_DEBUG_SNAPSHOT__ === "function")
            await page.waitForFunction(() => {
                const snapshot = window.__TRICKS_DEBUG_SNAPSHOT__?.()
                return snapshot?.canvasCount === 2
                    && Number.isFinite(snapshot?.phaserGameObjects)
                    && snapshot?.phaserLoopSleeping === true
            })
            const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
            await page.waitForTimeout(30000)
            const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())

            expect(after.canvasCount).toBe(before.canvasCount)
            expect(after.canvasCount).toBeLessThanOrEqual(2)
            expect(after.phaserGameObjects).toBe(before.phaserGameObjects)
            expect(after.domCards).toBe(before.domCards)
            expect(after.activeRaf).toBe(0)
            expect(after.activeTimers).toBe(0)
            expect(after.stateFetchCount - before.stateFetchCount).toBeLessThanOrEqual(11)
            expect(after.phaserRenderCount - before.phaserRenderCount).toBe(0)
            expect(errors).toEqual([])
        } finally {
            await fixture.cleanup()
        }
    })

    test("invalid test signature is rejected", async ({request, baseURL}) => {
        const eventId = 990099
        const response = await request.post("/api/server/tricks/debug/fixtures", {
            headers: {
                origin: baseURL,
                referer: `${baseURL}/limited/tricks`,
                "x-tricks-test-user": "mallory",
                "x-tricks-test-event": String(eventId),
                "x-tricks-test-timestamp": String(Math.floor(Date.now() / 1000)),
                "x-tricks-test-signature": "invalid",
            },
            data: {event_id: eventId},
        })
        expect(response.status()).toBe(401)
    })
})
