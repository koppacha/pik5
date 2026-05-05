const {expect, test} = require("@playwright/test")

const sameOriginHeaders = (baseURL) => ({
    origin: baseURL,
    referer: `${baseURL}/limited/tricks`,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
})

test.describe("limited tricks prototype", () => {
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

    test("collect expired API is reachable and idempotent", async ({request, baseURL}) => {
        const res = await request.post("/api/server/tricks/maintenance/collect-expired", {
            headers: {
                ...sameOriginHeaders(baseURL),
                "content-type": "application/json",
            },
            data: {userId: "codex_playwright"},
        })

        expect(res.ok()).toBeTruthy()
        const body = await res.json()
        const payload = body.data || body

        expect(payload).toEqual(expect.objectContaining({
            collected: expect.any(Number),
        }))
    })

    test("page renders a non-empty Phaser canvas", async ({page}) => {
        await page.goto("/limited/tricks")

        await expect(page.locator("canvas")).toBeVisible()
        await expect(page.locator("body")).toContainText(/未参加|DP|読み込み中/)

        await page.waitForFunction(() => {
            const canvas = document.querySelector("canvas")
            if (!canvas || canvas.width < 100 || canvas.height < 100) return false

            const context = canvas.getContext("2d")
            if (!context) return false

            const points = [
                [Math.floor(canvas.width * 0.18), Math.floor(canvas.height * 0.22)],
                [Math.floor(canvas.width * 0.5), Math.floor(canvas.height * 0.5)],
                [Math.floor(canvas.width * 0.82), Math.floor(canvas.height * 0.78)],
            ]

            return points.some(([x, y]) => {
                const pixel = context.getImageData(x, y, 1, 1).data
                return pixel[3] > 0 && (pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0)
            })
        })
    })
})
