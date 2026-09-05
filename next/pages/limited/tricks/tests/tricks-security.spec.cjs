const {expect, test} = require("@playwright/test")
const {createTricksFixture, sameOriginHeaders, testIdentityHeaders} = require("./tricks-fixture")

test.describe("limited tricks security", () => {
    test("three browser sessions cannot select another player's private hand", async ({browser, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL, {
            players: [
                {name: "security_a", points: 20, hand_count: 3},
                {name: "security_b", points: 20, hand_count: 4},
                {name: "security_c", points: 20, hand_count: 5},
            ],
        })
        const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()])
        try {
            const pages = await Promise.all(contexts.map((context) => context.newPage()))
            await Promise.all(pages.map(async (page, index) => {
                const userId = fixture.players[index]
                await page.route("**/api/server/tricks/**", async (route) => {
                    await route.continue({
                        headers: {...route.request().headers(), ...testIdentityHeaders(userId, fixture.eventId)},
                    })
                })
                await page.goto("/limited/tricks")
                await expect(page.locator("canvas")).toBeVisible()
            }))

            const states = await Promise.all(pages.map((page, index) => page.evaluate(async (otherUser) => {
                const response = await fetch(`/api/server/tricks/state?userId=${encodeURIComponent(otherUser)}`)
                const body = await response.json()
                return body.data
            }, fixture.players[(index + 1) % fixture.players.length])))

            expect(states.map((state) => state.me.name)).toEqual(fixture.players)
            expect(states.map((state) => state.hand.length)).toEqual([3, 4, 5])
            for (const state of states) {
                expect(state.hand.every((card) => card.state === state.me.name)).toBe(true)
            }
        } finally {
            await Promise.all(contexts.map((context) => context.close()))
            await fixture.cleanup()
        }
    })

    test("generic proxy blocks record mutations and oversized bodies", async ({request, baseURL}) => {
        const headers = sameOriginHeaders(baseURL)
        const create = await request.post("/api/server/record", {
            headers,
            data: {user_id: "victim", editor_role: 10},
        })
        expect(create.status()).toBe(405)

        const methodOverride = await request.post("/api/server/record/123", {
            headers: {...headers, "content-type": "application/x-www-form-urlencoded"},
            data: "_method=DELETE&editor_role=10",
        })
        expect(methodOverride.status()).toBe(405)

        const oversized = await request.post("/api/server/tricks/join", {
            headers: {...headers, ...testIdentityHeaders("oversized", 999999)},
            data: {padding: "x".repeat(1024 * 1024 + 1)},
        })
        expect(oversized.status()).toBe(413)
    })
})
