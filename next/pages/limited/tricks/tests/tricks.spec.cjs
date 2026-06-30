const {expect, test} = require("@playwright/test")
const {createTricksFixture} = require("./tricks-fixture")

const sameOriginHeaders = (baseURL) => ({
    origin: baseURL,
    referer: `${baseURL}/limited/tricks`,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
})

async function postApi(request, baseURL, path, data = {}) {
    return request.post(path, {
        headers: {...sameOriginHeaders(baseURL), "content-type": "application/json"},
        data,
    })
}

test.describe("limited tricks", () => {
    test("state API returns the normalized event snapshot", async ({request, baseURL}) => {
        const res = await request.get("/api/server/tricks/state?userId=codex_playwright", {
            headers: sameOriginHeaders(baseURL),
        })
        expect(res.ok()).toBeTruthy()
        const body = await res.json()
        const state = body.data || body
        expect(state.tournament).toEqual(expect.objectContaining({
            event_id: expect.any(Number),
            title: expect.any(String),
            available: expect.any(Boolean),
        }))
        expect(state).toEqual(expect.objectContaining({
            players: expect.any(Array),
            field: expect.any(Array),
            hand: expect.any(Array),
            deck_count: expect.any(Number),
            logs: expect.any(Array),
        }))
    })

    test("first post starts 90 minutes and the next eligible post extends 15 minutes", async ({request, baseURL}) => {
        const fixture = await createTricksFixture()
        try {
            await fixture.addRecord(fixture.playerA, 100, "NOW() - INTERVAL 2 MINUTE")
            const first = await postApi(request, baseURL, "/api/server/tricks/records/posted", {
                userId: fixture.playerA,
                stage_id: fixture.stageId,
            })
            expect(first.ok()).toBeTruthy()
            const firstLimit = new Date((await fixture.card()).limit_at).getTime()

            await fixture.addRecord(fixture.playerB, 200, "NOW() - INTERVAL 1 MINUTE")
            const second = await postApi(request, baseURL, "/api/server/tricks/records/posted", {
                userId: fixture.playerB,
                stage_id: fixture.stageId,
            })
            expect(second.ok()).toBeTruthy()
            const secondLimit = new Date((await fixture.card()).limit_at).getTime()
            expect(secondLimit - firstLimit).toBe(15 * 60 * 1000)
        } finally {
            await fixture.cleanup()
        }
    })

    test("a rank-improving non-last post grants DP once", async ({request, baseURL}) => {
        const fixture = await createTricksFixture({rarity: 2, stackCount: 3})
        try {
            await fixture.addRecord(fixture.playerA, 100, "NOW() - INTERVAL 3 MINUTE")
            await fixture.addRecord(fixture.playerB, 200, "NOW() - INTERVAL 2 MINUTE")
            await fixture.addRecord(fixture.playerA, 300, "NOW() - INTERVAL 1 MINUTE")

            const first = await postApi(request, baseURL, "/api/server/tricks/records/posted", {
                userId: fixture.playerA,
                stage_id: fixture.stageId,
            })
            expect(first.ok()).toBeTruthy()
            expect(Number((await fixture.player(fixture.playerA)).draw_points)).toBe(1)

            const duplicate = await postApi(request, baseURL, "/api/server/tricks/records/posted", {
                userId: fixture.playerA,
                stage_id: fixture.stageId,
            })
            expect(duplicate.ok()).toBeTruthy()
            expect(Number((await fixture.player(fixture.playerA)).draw_points)).toBe(1)
        } finally {
            await fixture.cleanup()
        }
    })

    test("collecting the same card twice does not duplicate points or logs", async ({request, baseURL}) => {
        const fixture = await createTricksFixture({difficulty: 3, stackCount: 3})
        try {
            await fixture.addRecord(fixture.playerA, 300, "NOW() - INTERVAL 2 MINUTE")
            await fixture.addRecord(fixture.playerB, 200, "NOW() - INTERVAL 1 MINUTE")

            const first = await postApi(request, baseURL, `/api/server/tricks/cards/${fixture.deckId}/collect`, {
                userId: fixture.playerA,
            })
            expect(first.ok()).toBeTruthy()
            const afterFirst = {
                a: await fixture.player(fixture.playerA),
                b: await fixture.player(fixture.playerB),
                logs: await fixture.collectionLogCount(),
            }

            const second = await postApi(request, baseURL, `/api/server/tricks/cards/${fixture.deckId}/collect`, {
                userId: fixture.playerA,
            })
            expect(second.ok()).toBeTruthy()
            const afterSecond = {
                a: await fixture.player(fixture.playerA),
                b: await fixture.player(fixture.playerB),
                logs: await fixture.collectionLogCount(),
            }

            expect((await fixture.card()).state).toBe("_collected")
            expect(afterSecond).toEqual(afterFirst)
            expect(afterSecond.logs).toBe(1)
        } finally {
            await fixture.cleanup()
        }
    })

    test("ended tournament hides the deck and hand while keeping collected cards visible", async ({page}) => {
        const endedState = {
            tournament: {
                event_id: 251227,
                title: "Playwright ended tournament",
                start_at: "2026-05-03T00:00:00+09:00",
                end_at: "2026-05-05T00:00:00+09:00",
                server_now: "2026-05-05T00:01:00+09:00",
                available: false,
                debug: false,
            },
            me: {name: "pw-ended", draw_points: 3, rank_points: 0, card_count: 1},
            players: [],
            deck_count: 4,
            trash_count: 2,
            hand: [{id: 8001, card_id: 8001, title: "Hidden hand", state: "pw-ended"}],
            field: [{
                id: 8002, card_id: 8002, stage_id: 9802,
                title: "Collected card", rule_name: "Rule", text: "Result",
                state: "_collected", difficulty: 1, rarity: 1, stack_count: 3,
                collected_at: "2026-05-05T00:00:00+09:00",
            }],
            logs: [],
        }
        let stateResponse = endedState
        await page.route("**/api/server/tricks/state**", async (route) => route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(stateResponse),
        }))
        await page.route("**/api/users", async (route) => route.fulfill({contentType: "application/json", body: "[]"}))
        await page.goto("/limited/tricks")

        await expect(page.locator("canvas")).toBeVisible()
        await page.waitForTimeout(500)
        const withPrivateCards = await page.locator("canvas").evaluate((canvas) => canvas.toDataURL())

        stateResponse = {...endedState, deck_count: 0, hand: [], me: {...endedState.me, card_count: 0}}
        await page.reload()
        await expect(page.locator("canvas")).toBeVisible()
        await page.waitForTimeout(500)
        const withoutPrivateCards = await page.locator("canvas").evaluate((canvas) => canvas.toDataURL())

        expect(withPrivateCards).toBe(withoutPrivateCards)
        await expect(page.getByRole("button", {name: "参加"})).toBeDisabled()
    })

    test("page renders a non-empty Phaser canvas", async ({page}) => {
        await page.goto("/limited/tricks")
        await expect(page.locator("canvas")).toBeVisible()
        await page.waitForFunction(() => {
            const canvas = document.querySelector("canvas")
            if (!canvas || canvas.width < 100 || canvas.height < 100) return false
            const context = canvas.getContext("2d")
            if (!context) return false
            return [[0.18, 0.22], [0.5, 0.5], [0.82, 0.78]].some(([x, y]) => {
                const pixel = context.getImageData(
                    Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1
                ).data
                return pixel[3] > 0 && (pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0)
            })
        })
    })
})
