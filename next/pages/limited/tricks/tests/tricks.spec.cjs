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
            for (const page of pages) {
                const canvasCount = await page.locator("canvas").count()
                expect(canvasCount).toBeGreaterThanOrEqual(1)
                expect(canvasCount).toBeLessThanOrEqual(2)
            }
        } finally {
            await Promise.all(contexts.map((context) => context.close()))
            await fixture.cleanup()
        }
    })

    test("log panel shows newest entries first and slides behind its left title", async ({page, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            const beforeTake = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            const taken = await fixture.post(
                fixture.players[0],
                `/api/server/tricks/cards/${beforeTake.hand[0].id}/take`,
            )
            await fixture.post(fixture.admin, "/api/server/tricks/debug/time/advance", {minutes: 90})
            await page.goto("/limited/tricks")
            const state = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            const visibleEvents = new Set(["join", "take", "record_posted", "record_updated", "subsidy_paid", "collect"])
            const expectedStateLogIds = [...state.logs]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || Number(b.id) - Number(a.id))
                .map((log) => String(log.id))
            expect(state.logs.map((log) => String(log.id))).toEqual(expectedStateLogIds)
            const expectedLogIds = state.logs.filter((log) => visibleEvents.has(log.event)).map((log) => String(log.id))
            const logEntries = page.locator("[data-tricks-log-entry]")
            await expect(logEntries).toHaveCount(expectedLogIds.length)
            const displayedLogIds = await logEntries.evaluateAll((entries) => {
                return entries.map((entry) => entry.getAttribute("data-tricks-log-entry"))
            })
            expect(displayedLogIds).toEqual(expectedLogIds)
            const trashMessage = `${taken.card.title}がトラッシュされました`
            const displayedLogTexts = await page.locator("[data-tricks-log-entry]").allTextContents()
            expect(displayedLogTexts.some((text) => text.endsWith(` - ${trashMessage}`))).toBe(true)

            const wrapper = page.locator("[data-tricks-log-wrapper]")
            const region = page.locator("[data-tricks-log-region]")
            const toggle = page.locator("[data-tricks-log-toggle]")
            await expect(wrapper).toHaveCSS("position", "fixed")
            await expect(region).toHaveCSS("width", "400px")
            const openWrapperBox = await wrapper.boundingBox()
            const openRegionBox = await region.boundingBox()
            const openToggleBox = await toggle.boundingBox()
            expect(openWrapperBox).not.toBeNull()
            expect(openRegionBox).not.toBeNull()
            expect(openToggleBox).not.toBeNull()
            expect(page.viewportSize().height - openWrapperBox.y - openWrapperBox.height).toBeGreaterThanOrEqual(234)
            expect(openToggleBox.x).toBeLessThan(openRegionBox.x)

            await toggle.click()
            await expect(wrapper).toHaveAttribute("data-log-open", "false")
            await expect(toggle).toHaveAttribute("aria-expanded", "false")
            await page.waitForTimeout(300)
            const closedRegionBox = await region.boundingBox()
            const closedToggleBox = await toggle.boundingBox()
            expect(closedRegionBox.x).toBeGreaterThanOrEqual(page.viewportSize().width - 25)
            expect(closedToggleBox.x).toBeLessThan(page.viewportSize().width)

            await toggle.click()
            await expect(wrapper).toHaveAttribute("data-log-open", "true")
            await page.waitForTimeout(300)
            const reopenedRegionBox = await region.boundingBox()
            expect(Math.abs(reopenedRegionBox.x - openRegionBox.x)).toBeLessThanOrEqual(1)
        } finally {
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

    test("endgame cooldown exemption enables take while keeping other limits", async ({page, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL, {
            debugNow: "2026-09-20T20:00:00+09:00",
            startAt: "2026-09-20T19:00:00+09:00",
            endAt: "2026-09-20T23:59:00+09:00",
            players: [
                {name: `pw_end_a_${Date.now()}`, points: 20, hand_count: 3},
                {name: `pw_end_b_${Date.now()}`, points: 20, hand_count: 0},
                {name: `pw_end_c_${Date.now()}`, points: 20, hand_count: 0},
            ],
        })
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            const initial = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            await fixture.post(fixture.players[0], `/api/server/tricks/cards/${initial.hand[0].id}/take`)
            for (let index = 0; index < 4; index += 1) {
                await fixture.post(fixture.players[0], "/api/server/tricks/draw")
            }

            await page.goto("/limited/tricks")
            await page.locator(".tricks-dom-card-hand").first().click()
            await expect(page.getByRole("button", {name: "場に出す", exact: true})).toBeDisabled()
            await page.getByRole("button", {name: "キャンセル", exact: true}).click()

            await fixture.post(fixture.admin, "/api/server/tricks/debug/time/set", {
                now: "2026-09-20T21:29:00+09:00",
            })
            const endgameState = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            expect(endgameState.me.next_take_at).toBeNull()
            expect(endgameState.field).toHaveLength(1)
            expect(endgameState.hand).toHaveLength(4)

            await page.reload()
            await page.locator(".tricks-dom-card-hand").first().click()
            await expect(page.getByRole("button", {name: "場に出す", exact: true})).toBeEnabled()
        } finally {
            await fixture.cleanup()
        }
    })

    test("hand menu returns a card for 1P and disables return at 0P", async ({page, request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            await page.locator(".tricks-dom-card-hand").first().click()
            const actionButtons = page.locator(".tricks-hand-action")
            await expect(actionButtons).toHaveText(["場に出す", "山札に戻す", "キャンセル"])
            await expect(page.locator("[data-tricks-take-summary]")).toContainText("投稿コスト 1P")
            await expect(page.locator("[data-tricks-take-summary]")).toContainText("スタック数 3")
            await expect(page.locator("[data-tricks-take-summary]")).toHaveCSS("font-weight", "800")
            await expect(page.getByRole("button", {name: "山札に戻す", exact: true})).toBeEnabled()
            page.once("dialog", (dialog) => dialog.accept())
            await page.getByRole("button", {name: "山札に戻す", exact: true}).click()
            const returnMotion = page.locator('[data-tricks-motion="return-to-deck"]')
            await expect(returnMotion).toBeVisible()
            await expect(returnMotion).toHaveCSS("animation-name", "tricksReturnToDeck")
            const returnOpacities = await returnMotion.evaluate((element) => {
                const animation = element.getAnimations()[0]
                animation.pause()
                const values = [0, 160, 320, 610].map((time) => {
                    animation.currentTime = time
                    return getComputedStyle(element).opacity
                })
                animation.play()

                return values
            })
            expect(returnOpacities).toEqual(["1", "1", "1", "1"])
            await expect(page.getByText("P 19 / 手札 2", {exact: true})).toBeVisible()
            await expect(returnMotion).toHaveCount(0, {timeout: 2000})

            const state = await fixture.get(fixture.players[0], "/api/server/tricks/state")
            expect(state.deck_count).toBe(198)
            expect(state.logs.map((log) => log.event)).not.toContain("return_to_deck")
        } finally {
            await fixture.cleanup()
        }

        const zeroFixture = await createTricksFixture(request, baseURL, {
            players: [{name: `pw_zero_${Date.now()}`, points: 0, hand_count: 1}],
        })
        await page.unroute("**/api/server/tricks/**")
        await page.unroute("**/api/auth/session")
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: zeroFixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(zeroFixture.players[0], zeroFixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            await page.locator(".tricks-dom-card-hand").first().click()
            await expect(page.getByRole("button", {name: "山札に戻す", exact: true})).toBeDisabled()
        } finally {
            await zeroFixture.cleanup()
        }
    })

    test("draw motion hides the first card before a zero-card hand is rendered", async ({page, request, baseURL}) => {
        const eventKey = Date.now()
        const fixture = await createTricksFixture(request, baseURL, {
            players: [{name: `pw_empty_hand_${eventKey}`, points: 20, hand_count: 0}],
        })
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            await expect(page.locator(".tricks-dom-card-hand")).toHaveCount(0)
            await page.evaluate(() => {
                window.__TRICKS_DRAW_SEQUENCE__ = []
                const root = document.querySelector("[data-tricks-root]") || document.body
                window.__TRICKS_DRAW_OBSERVER__ = new MutationObserver(() => {
                    const cards = [...document.querySelectorAll(".tricks-dom-card-hand")]
                    if (cards.length === 0) return
                    window.__TRICKS_DRAW_SEQUENCE__.push({
                        ghost: Boolean(document.querySelector("[data-tricks-draw-motion]")),
                        opacities: cards.map((card) => getComputedStyle(card).opacity),
                    })
                })
                window.__TRICKS_DRAW_OBSERVER__.observe(root, {
                    attributes: true,
                    childList: true,
                    subtree: true,
                    attributeFilter: ["style"],
                })
            })

            await page.getByRole("button", {name: "ドロー", exact: true}).click()
            const ghost = page.locator("[data-tricks-draw-motion]")
            await expect(ghost).toBeVisible()
            await expect(page.locator(".tricks-dom-card-hand")).toHaveCount(1)
            await expect(page.locator(".tricks-dom-card-hand")).toHaveCSS("opacity", "0")
            const firstRenderedHand = await page.evaluate(() => {
                window.__TRICKS_DRAW_OBSERVER__?.disconnect()
                return window.__TRICKS_DRAW_SEQUENCE__?.[0]
            })
            expect(firstRenderedHand).toEqual({ghost: true, opacities: ["0"]})

            await expect(ghost).toHaveCount(0, {timeout: 2000})
            await expect(page.locator(".tricks-dom-card-hand")).toHaveCSS("opacity", "1")
        } finally {
            await fixture.cleanup()
        }
    })

    test("point spend immediately shows the subsidy flag and subsidy logs use recipient counts", async ({page, request, baseURL}) => {
        const eventKey = Date.now()
        const players = [
            {name: `pw_subsidy_a_${eventKey}`, points: 4, hand_count: 0},
            {name: `pw_subsidy_b_${eventKey}`, points: 4, hand_count: 0},
            {name: `pw_subsidy_c_${eventKey}`, points: 4, hand_count: 0},
            {name: `pw_subsidy_d_${eventKey}`, points: 4, hand_count: 0},
            {name: `pw_subsidy_e_${eventKey}`, points: 4, hand_count: 0},
        ]
        const fixture = await createTricksFixture(request, baseURL, {
            debugNow: "2026-09-20T20:10:00+09:00",
            startAt: "2026-09-20T19:00:00+09:00",
            endAt: "2026-09-20T23:59:00+09:00",
            players,
        })
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            const playerCard = page.locator(`[data-tricks-player="${fixture.players[0]}"]`)
            await expect(playerCard.locator("[data-tricks-subsidy-flag]"))
                .toHaveAttribute("data-tricks-subsidy-flag", "inactive")

            await page.getByRole("button", {name: "ドロー", exact: true}).click()
            const activePoints = playerCard.locator('[data-tricks-subsidy-flag="active"]')
            await expect(activePoints).toHaveText("P 3")
            await expect(activePoints).not.toContainText("'")
            await expect(activePoints).toHaveCSS("color", "rgb(216, 75, 140)")
            await expect(activePoints.locator("[data-tricks-points-label]")).toHaveCSS("text-decoration-line", "underline")

            await fixture.post(fixture.admin, "/api/server/tricks/debug/time/advance", {minutes: 20})
            await page.reload()
            await expect(playerCard.locator('[data-tricks-subsidy-flag="active"]')).toHaveText("P 4")
            await expect(page.getByText("5人にポイントが給付されました。", {exact: false})).toBeVisible()
        } finally {
            await fixture.cleanup()
        }
    })

    test("large hands use a shallow fan and drawn cards flip before following an arc", async ({page, request, baseURL}) => {
        const eventKey = Date.now()
        const fixture = await createTricksFixture(request, baseURL, {
            players: [{name: `pw_large_hand_${eventKey}`, points: 20, hand_count: 20}],
        })
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/server/tricks/**", async (route) => {
            await route.continue({
                headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
            })
        })
        try {
            await page.goto("/limited/tricks")
            const handCards = page.locator(".tricks-dom-card-hand")
            await expect(handCards).toHaveCount(20)
            const cardYPositions = await handCards.evaluateAll((cards) => cards.map((card) => {
                const match = card.style.transform.match(/translate3d\([^,]+,\s*([-\d.]+)px/)

                return match ? Number(match[1]) : Number.NaN
            }))
            expect(cardYPositions.every(Number.isFinite)).toBe(true)
            expect(Math.max(...cardYPositions) - Math.min(...cardYPositions)).toBeLessThanOrEqual(55)
            if (process.env.TRICKS_CAPTURE_UI === "1") {
                await page.screenshot({path: "pages/limited/tricks/output/playwright/large-hand-fan.png"})
            }

            await page.getByRole("button", {name: "ドロー", exact: true}).click()
            const ghost = page.locator("[data-tricks-draw-motion]")
            const flipper = page.locator("[data-tricks-draw-flipper]")
            await expect(ghost).toBeVisible()
            await expect(handCards).toHaveCount(21)
            await expect(handCards.last()).toHaveCSS("opacity", "0")
            if (process.env.TRICKS_CAPTURE_UI === "1") {
                await ghost.evaluate((element) => {
                    element.getAnimations({subtree: true}).forEach((animation) => {
                        animation.currentTime = 400
                        animation.pause()
                    })
                })
                await page.screenshot({path: "pages/limited/tricks/output/playwright/draw-face-hold.png"})
                await ghost.evaluate((element) => {
                    element.getAnimations({subtree: true}).forEach((animation) => {
                        animation.currentTime = 800
                    })
                })
                await page.screenshot({path: "pages/limited/tricks/output/playwright/draw-arc.png"})
                await ghost.evaluate((element) => {
                    element.getAnimations({subtree: true}).forEach((animation) => animation.play())
                })
            }
            await expect(ghost).toHaveCSS("animation-name", "tricksDrawToHand")
            await expect(flipper).toHaveCSS("animation-name", "tricksDrawFlip")
            await expect(ghost.locator(".tricks-dom-draw-face .tricks-dom-card-title")).not.toHaveText("Untitled")
            const drawOpacities = await ghost.evaluate((element) => {
                const animation = element.getAnimations()[0]
                animation.pause()
                const values = [0, 320, 520, 800, 1130].map((time) => {
                    animation.currentTime = time
                    return getComputedStyle(element).opacity
                })
                animation.play()

                return values
            })
            expect(drawOpacities).toEqual(["1", "1", "1", "1", "1"])

            await expect(ghost).toHaveCount(0, {timeout: 2000})
            await expect(handCards.last()).toHaveCSS("opacity", "1")
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
