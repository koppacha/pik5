const {expect, test} = require("@playwright/test")
const {createTricksFixture, testIdentityHeaders} = require("./tricks-fixture")

function uiState({me = null, players = [], subsidyFlag = false} = {}) {
    const playerList = players.map((player) => ({...player, subsidy_flag: subsidyFlag || player.subsidy_flag}))

    return {
        tournament: {
            event_id: 990401,
            title: "UI確認大会",
            start_at: "2026-09-15T10:00:00+09:00",
            end_at: "2026-09-15T23:00:00+09:00",
            state: "active",
            available: true,
            debug: false,
            test_mode: false,
            pot_points: 0,
        },
        server_now: "2026-09-15T12:00:00+09:00",
        me,
        players: playerList,
        hand: me ? [{
            id: 201,
            stage_id: 7201,
            title: "手札確認カード",
            rule_name: "テストルール",
            text: "手札表示確認用",
            difficulty: 1,
            rarity: 1,
        }] : [],
        field: [{
            id: 202,
            event_card_id: 1202,
            stage_id: 7202,
            title: "場札確認カード",
            rule_name: "テストルール",
            text: "場札表示確認用",
            difficulty: 1,
            rarity: 1,
            stack_count: 2,
            paid_points_total: 3,
            participant_count: 2,
            live_total_reward: 5,
            provisional_total_reward: 5,
            my_initial_post_cost: 1,
            limit_at: "2026-09-15T13:00:00+09:00",
            my_can_post: Boolean(me),
            my_can_extend: Boolean(me),
        }],
        deck_count: 198,
        trash_count: 0,
        collected_count: 3,
        logs: [],
    }
}

test.describe("limited tricks phase 6", () => {
    test("ended tournament shows only holder cards and opens their final rankings", async ({page}) => {
        const player = {
            name: "pw_collected_holder",
            draw_points: 3,
            rank_points: 7,
            total_rank_points: 7,
            card_count: 0,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 1,
            subsidy_flag: false,
        }
        const state = uiState({me: player, players: [player]})
        state.tournament.state = "ended"
        state.field = []
        const collected = [
            {
                ...state.hand[0],
                id: 301,
                event_card_id: 1301,
                title: "ホルダーあり回収カード",
                stack_count: 4,
                taker: player.name,
                taken_at: "2026-09-15T10:00:00+09:00",
                collected_at: "2026-09-15T11:35:00+09:00",
                holders: [player.name],
                holder_label: player.name,
                rankings: [{user_id: player.name, rank: 1, score: 123, rps: 2}],
                rewards: [{points_delta: 9}],
                total_reward_points: 9,
            },
            {
                ...state.hand[0],
                id: 302,
                event_card_id: 1302,
                title: "ホルダーなし回収カード",
                holders: [],
                rankings: [],
            },
        ]
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: [{userId: player.name, name: "ホルダープレイヤー"}]}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.endsWith("/collected")) {
                return route.fulfill({json: collected})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.getByTestId("tricks-collected-card")).toHaveCount(1)
        await expect(page.getByText("ホルダーなし回収カード")).toHaveCount(0)
        const card = page.getByTestId("tricks-collected-card")
        await expect(card.locator("[data-tricks-card-holder]")).toContainText("ホルダープレイヤー")
        await expect(card.getByLabel("ホルダー")).toBeVisible()
        await expect(card.locator(".tricks-dom-stack-value")).toHaveText("4")
        await expect(card).toContainText("アクティブ時間 1:35")
        await card.getByRole("button").click()
        const detailPanel = page.locator(".tricks-collected-detail-panel")
        await expect(detailPanel).toContainText("回収時の総還元 9P / アクティブ時間 1:35")
        await expect(detailPanel).toHaveClass(/tricks-field-detail-panel-right/)
        await expect(page.locator(".tricks-collected-detail-panel")).not.toContainText("投稿コスト")
    })

    test("administrators can open collected-card statistics", async ({page}) => {
        const player = {
            name: "pw_collected_admin",
            draw_points: 3,
            rank_points: 7,
            total_rank_points: 7,
            card_count: 0,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 1,
            subsidy_flag: false,
        }
        const state = uiState({me: player, players: [player]})
        state.tournament.state = "ended"
        state.field = []
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 10},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: [{userId: player.name, name: "管理者表示名"}]}))
        await page.route("**/api/server/tricks/**", async (route) => {
            const path = new URL(route.request().url()).pathname
            if (path.endsWith("/admin-stats")) {
                return route.fulfill({json: [{
                    user_id: player.name,
                    total_rank_points: 7,
                    collected_card_count: 1,
                    take_count: 2,
                    draw_count: 3,
                    return_count: 1,
                    post_count: 4,
                    spent_points: 5,
                    creator_take_count: 2,
                }]})
            }
            if (path.endsWith("/collected")) return route.fulfill({json: []})
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.locator("[data-tricks-admin-stats]")).toHaveCount(0)
        await page.locator("[data-tricks-admin-stats-toggle]").click()
        const stats = page.locator("[data-tricks-admin-stats]")
        await expect(stats).toContainText("管理者表示名")
        await expect(stats.locator("[data-tricks-admin-stat=spent_points]")).toHaveText("5")
        await expect(stats.locator("[data-tricks-admin-stat=spent_points]")).toHaveCSS("background-color", "rgb(54, 83, 20)")
    })

    test("unauthenticated visitors can only use the login link", async ({page}) => {
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {}}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/state", async (route) => route.fulfill({json: uiState()}))
        await page.goto("/limited/tricks")
        await expect(page.getByText("このイベントに参加するにはログインが必要です")).toBeVisible()
        await expect(page.getByRole("link", {name: "ログイン", exact: true})).toHaveAttribute("href", "/auth/login")
        await expect(page.locator("[data-tricks-access-backdrop]")).toBeVisible()
        await expect(page.getByRole("button", {name: "ドロー", exact: true})).toBeDisabled()
        await expect(page.getByText("大会へ参加してください", {exact: true})).toHaveCount(0)

        const fieldBox = await page.locator(".tricks-dom-card-field").boundingBox()
        await page.mouse.click(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2)
        await expect(page.locator(".tricks-field-detail-panel")).toHaveCount(0)
    })

    test("logged-in non-participants join from the center gate and see the guide", async ({page}) => {
        const userId = "pw_join_ui"
        const player = {
            name: userId,
            draw_points: 5,
            rank_points: 0,
            total_rank_points: 0,
            card_count: 0,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 0,
        }
        let state = uiState()
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.endsWith("/join")) {
                state = uiState({me: player, players: [player]})
                return route.fulfill({json: {player}})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.getByText("第19回期間限定ランキングに参加する")).toBeVisible()
        await expect(page.getByRole("button", {name: "参加する", exact: true})).toBeEnabled()
        await expect(page.getByRole("button", {name: "参加", exact: true})).toHaveCount(0)
        await page.getByRole("button", {name: "参加する", exact: true}).click()
        await expect(page.getByRole("dialog")).toContainText("期間限定ランキングは、みんなが考えたルール")
        await expect(page.getByRole("dialog").getByRole("button", {name: "閉じる"})).toBeVisible()
    })

    test("join authentication failure shows its HTTP status inside the access gate", async ({page}) => {
        const userId = "pw_existing_join_error"
        const participant = {name: userId, draw_points: 5, rank_points: 0, card_count: 0}
        const state = uiState({players: [participant]})
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.endsWith("/join")) {
                return route.fulfill({status: 401, json: {error: true, status: 401, data: {message: "認証が必要です"}}})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await page.getByRole("button", {name: "参加する", exact: true}).click()
        await expect(page.locator("[data-tricks-join-error]")).toHaveText("HTTP 401: 認証が必要です")
        await expect(page.getByRole("button", {name: "参加する", exact: true})).toBeEnabled()
    })

    test("participant HUD, hand controls, guide, and focus layers follow the UI rules", async ({page}) => {
        const userId = "pw_participant_ui"
        const player = {
            name: userId,
            draw_points: 20,
            rank_points: 7,
            confirmed_rank_points: 5,
            provisional_rank_points: 2,
            total_rank_points: 7,
            card_count: 1,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 2,
            subsidy_flag: false,
        }
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        const participantState = uiState({me: player, players: [player]})
        participantState.tournament.debug = true
        await page.route("**/api/server/tricks/**", async (route) => route.fulfill({json: participantState}))

        await page.goto("/limited/tricks")
        await expect(page.locator("[data-tricks-collected-count]")).toHaveText("回収カード総数 3枚")
        await expect(page.locator("[data-tricks-player-collected-count]")).toHaveText("回収カード 2枚")
        await expect(page.getByText(/確定 5/)).toHaveCount(0)
        await expect(page.locator("[data-tricks-subsidy-remaining]")).toHaveCount(0)

        const handCard = page.locator(".tricks-dom-card-hand")
        await page.locator("[data-tricks-hand-toggle]").click()
        await expect(page.locator("[data-tricks-hand-toggle]")).toHaveText("手札を表示")
        await page.waitForTimeout(240)
        const hiddenBox = await handCard.boundingBox()
        expect(hiddenBox.y).toBeGreaterThanOrEqual(page.viewportSize().height)
        await page.locator("[data-tricks-hand-toggle]").click()
        await expect(page.locator("[data-tricks-hand-toggle]")).toHaveText("手札非表示")
        await page.waitForTimeout(240)
        const shownBox = await handCard.boundingBox()
        expect(shownBox.y).toBeLessThan(page.viewportSize().height)

        await page.locator("[data-tricks-how-to-play]").click()
        await expect(page.getByRole("dialog")).toContainText("まずはドローボタンを押してカードを３枚引きましょう。")
        await page.getByRole("dialog").getByRole("button", {name: "閉じる"}).click()

        await handCard.click()
        await expect(page.locator('[data-tricks-card-backdrop="hand"]')).toBeVisible()
        await expect(page.locator("[data-tricks-focus-backdrop]")).toBeVisible()
        await expect(page.locator("[data-tricks-game-layer]")).toHaveCSS("z-index", "30")
        await expect(page.locator(".tricks-dom-card-hand.is-selected")).toHaveCSS("z-index", "310")
        await page.getByRole("button", {name: "キャンセル", exact: true}).click()

        await page.locator(".tricks-dom-card-field").dispatchEvent("click")
        await expect(page.locator('[data-tricks-card-backdrop="field"]')).toBeVisible()
        await expect(page.locator(".tricks-dom-card-field.is-selected")).toHaveCount(1)
        await expect(page.locator(".tricks-field-detail-panel")).toBeVisible()
        await page.getByRole("button", {name: "閉じる", exact: true}).click()

        await page.waitForFunction(() => window.__TRICKS_DEBUG_SNAPSHOT__?.().phaserLoopSleeping === true)
        const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
        await page.waitForTimeout(3500)
        const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
        expect(after.phaserGameObjects).toBe(before.phaserGameObjects)
        expect(after.domCards).toBe(before.domCards)
        expect(after.activeRaf).toBe(0)
        expect(after.activeTimers).toBe(0)
        expect(after.phaserRenderCount).toBe(before.phaserRenderCount)
    })

    test("subsidy countdown is shown as soon as an eligible player appears", async ({page}) => {
        const player = {
            name: "pw_subsidy_ui",
            draw_points: 3,
            rank_points: 0,
            total_rank_points: 0,
            card_count: 1,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 0,
            subsidy_flag: true,
        }
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        const state = uiState({me: player, players: [player]})
        state.me.subsidy_flag = false
        state.players[0].subsidy_flag = false
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.endsWith("/draw")) {
                state.me.draw_points = 2
                state.me.subsidy_flag = true
                state.players[0].draw_points = 2
                state.players[0].subsidy_flag = true
                const card = {...state.hand[0], id: 203, title: "追加ドローカード"}
                state.hand.push(card)
                return route.fulfill({json: {card}})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.locator("[data-tricks-subsidy-remaining]")).toHaveCount(0)
        await page.getByRole("button", {name: "ドロー", exact: true}).click()
        await expect(page.locator("[data-tricks-subsidy-remaining]")).toContainText("次回給付")
    })

    test("failed subsidy shows HTTP 500 and retries at most once within thirty seconds", async ({page}) => {
        const userId = "pw_subsidy_error"
        const player = {name: userId, draw_points: 2, rank_points: 0, card_count: 0}
        const state = uiState({me: player, players: [player]})
        let subsidyCalls = 0
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.endsWith("/maintenance/subsidy")) {
                subsidyCalls += 1
                return route.fulfill({status: 500, body: "Internal Server Error"})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.getByText("HTTP 500: API request failed")).toBeVisible()
        await page.waitForTimeout(3500)
        expect(subsidyCalls).toBe(1)
    })

    test("tournament countdown changes its message and color at three hours, seventy minutes, and one hour", async ({page}) => {
        const player = {name: "pw_countdown_ui", draw_points: 2, rank_points: 0, card_count: 1}
        const state = uiState({me: player, players: [player]})
        state.tournament.end_at = "2026-09-15T15:00:00+09:00"
        state.tournament.debug = true
        state.debug_state = {frozen: true}
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => route.fulfill({json: state}))

        const remaining = page.locator("[data-tricks-tournament-remaining]")
        const alert = page.locator("[data-tricks-countdown-alert]")
        const cases = [
            ["2026-09-15T11:59:59+09:00", "normal", null, null],
            ["2026-09-15T12:00:00+09:00", "legendary", "レジェンダリー排出率10倍！", /rgb\(253, 224, 71\)|rgb\(161, 98, 7\)/],
            ["2026-09-15T13:50:00+09:00", "take-closing", "まもなくテイクできなくなります！", /rgb\(251, 146, 60\)|rgb\(194, 65, 12\)/],
            ["2026-09-15T14:00:00+09:00", "take-closed", "まもなく大会終了します。テイクはできません", /rgb\(248, 113, 113\)|rgb\(185, 28, 28\)/],
        ]
        for (const [serverNow, phase, message, color] of cases) {
            state.server_now = serverNow
            await page.goto("/limited/tricks")
            await expect(remaining).toHaveAttribute("data-tricks-countdown-phase", phase)
            if (message) {
                await expect(alert).toHaveText(message)
                await expect(remaining).toHaveCSS("color", color)
            } else {
                await expect(alert).toHaveCount(0)
            }
        }
        await page.waitForFunction(() => window.__TRICKS_DEBUG_SNAPSHOT__?.().phaserLoopSleeping === true)
        const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
        await page.waitForTimeout(3500)
        const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
        expect(after.phaserGameObjects).toBe(before.phaserGameObjects)
        expect(after.domCards).toBe(before.domCards)
        expect(after.activeRaf).toBe(0)
        expect(after.phaserRenderCount).toBe(before.phaserRenderCount)
    })

    test("new economy values are shown in the tournament player and field UI", async ({page}) => {
        const player = {
            name: "pw_economy_ui",
            draw_points: 11,
            rank_points: 0,
            total_rank_points: 0,
            card_count: 6,
            take_level: 0,
            take_cost: 2,
            hand_limit: 6,
            balance_tax_threshold: 10,
            balance_tax_eligible: true,
            collected_card_count: 0,
            subsidy_flag: false,
        }
        const state = uiState({me: player, players: [player]})
        state.tournament.pot_points = 4
        state.field[0].rarity = 3
        state.field[0].live_total_reward = 9
        state.field[0].provisional_total_reward = 13
        state.hand = Array.from({length: 6}, (_, index) => ({
            ...state.hand[0],
            id: 201 + index,
            stage_id: 7201 + index,
            title: `手札確認カード${index + 1}`,
        }))
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (new URL(route.request().url()).pathname.includes("/rankings")) {
                return route.fulfill({json: []})
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        await expect(page.locator("[data-tricks-tournament-info]")).toContainText("Pot 4P")
        await expect(page.locator("[data-tricks-tournament-info]")).toContainText("山札 198枚")
        await expect(page.locator("[data-tricks-tournament-info]")).toContainText("捨て札 0枚")
        await expect(page.locator("[data-tricks-balance-tax=active]")).toContainText("P 11")
        await expect(page.locator("[data-tricks-player='pw_economy_ui']")).toContainText("手札 6 / 6")
        await expect(page.getByRole("button", {name: "ドロー", exact: true})).toBeDisabled()
        await expect(page.locator(".tricks-command-window")).not.toContainText("捨て札")
        await expect(page.locator(".tricks-dom-card-field .tricks-dom-stack-value")).toHaveText("9")
        await expect(page.locator(".tricks-dom-card-field .tricks-dom-stack")).toHaveAttribute("title", "総還元P")

        await page.locator(".tricks-dom-card-field").dispatchEvent("click")
        await expect(page.locator(".tricks-field-detail-panel")).toContainText(
            "スタック 2 / 支払い総額 3P / 参加者 2人 / あなたの投稿コスト 1P",
        )
    })

    test("draw stays disabled while the deck is empty and re-enables after refill state arrives", async ({page}) => {
        const player = {
            name: "pw_deck_refill_ui",
            draw_points: 5,
            rank_points: 0,
            total_rank_points: 0,
            card_count: 1,
            take_level: 0,
            take_cost: 2,
            collected_card_count: 0,
            subsidy_flag: false,
        }
        const state = uiState({me: player, players: [player]})
        state.deck_count = 0
        state.trash_count = 3
        let refillAt = null
        await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
            user: {userId: player.name, role: 0},
            expires: "2099-01-01T00:00:00.000Z",
        }}))
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            if (refillAt === null) refillAt = Date.now() + 1200
            if (Date.now() >= refillAt) {
                state.deck_count = 3
                state.trash_count = 0
            }
            return route.fulfill({json: state})
        })

        await page.goto("/limited/tricks")
        const drawButton = page.getByRole("button", {name: "ドロー", exact: true})
        await expect(drawButton).toBeDisabled()
        await expect(page.getByText("山札を補充しています", {exact: true})).toBeVisible()
        await expect(drawButton).toBeEnabled({timeout: 7000})
        await expect(page.locator("[data-tricks-deck-count]")).toHaveText("山札 3枚")
    })

    test("fixture API creates 160 isolated cards and keeps player identities separate", async ({request, baseURL}) => {
        const fixture = await createTricksFixture(request, baseURL)
        try {
            expect(fixture.result.counts).toEqual(expect.objectContaining({
                events: 1,
                decks: 160,
                event_cards: 160,
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
            const trashMessage = `${taken.card.title}が除外されました。`
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

    test("player level is public and a field card can be extended for one point", async ({page}) => {
        const userId = "pw_extension_user"
        const previousLimit = new Date("2026-09-15T12:30:00+09:00").getTime()
        let extensionPayload = null
        const card = {
            id: 101,
            event_card_id: 1001,
            stage_id: 7101,
            card_id: 930001,
            title: "延長確認カード",
            rule_name: "テストルール",
            text: "画面確認用",
            difficulty: 2,
            rarity: 1,
            stack_count: 2,
            taker: userId,
            limit_at: new Date(previousLimit).toISOString(),
            taken_at: "2026-09-15T11:30:00+09:00",
            paid_points_total: 0,
            participant_count: 0,
            my_has_record: false,
            my_can_post: true,
            my_initial_payment_recorded: false,
            my_initial_post_cost: 2,
            my_can_extend: true,
        }
        const player = {
            name: userId,
            draw_points: 20,
            rank_points: 0,
            confirmed_rank_points: 0,
            provisional_rank_points: 0,
            total_rank_points: 0,
            card_count: 0,
            take_count: 1,
            take_level: 1,
            take_cost: 3,
            subsidy_flag: false,
            next_take_at: null,
        }
        const state = {
            tournament: {
                event_id: 990301,
                title: "UI確認大会",
                start_at: "2026-09-14T00:00:00+09:00",
                end_at: "2026-09-16T00:00:00+09:00",
                state: "active",
                available: true,
                debug: false,
                test_mode: false,
            },
            server_now: "2026-09-15T12:00:00+09:00",
            me: player,
            players: [player],
            hand: [],
            field: [card],
            logs: [],
            deck_count: 199,
            trash_count: 0,
        }
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({user: {userId, role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
            })
        })
        await page.route("**/api/users", async (route) => route.fulfill({json: []}))
        await page.route("**/api/server/tricks/**", async (route) => {
            const path = new URL(route.request().url()).pathname
            if (path.endsWith("/state")) return route.fulfill({json: state})
            if (path.endsWith("/scores")) return route.fulfill({json: []})
            if (path.endsWith("/extend")) {
                extensionPayload = route.request().postDataJSON()
                player.draw_points = 19
                card.limit_at = new Date(previousLimit + 15 * 60 * 1000).toISOString()
                card.paid_points_total = 1
                return route.fulfill({json: {
                    card,
                    player,
                    extended: true,
                    idempotent_replay: false,
                }})
            }

            return route.fulfill({json: {}})
        })

        await page.goto("/limited/tricks")
        const playerPanel = page.locator(`[data-tricks-player="${userId}"]`)
        await expect(playerPanel.locator("[data-tricks-take-level]")).toHaveText("Lv.1 / テイクコスト 3")
        await page.locator(".tricks-dom-card-field").dispatchEvent("click")
        const extendButton = page.locator("[data-tricks-extend-button]")
        await expect(extendButton).toBeEnabled()
        page.once("dialog", async (dialog) => {
            expect(dialog.message()).toBe("１点支払ってこのカードの期限を延長しますか？")
            await dialog.accept()
        })
        await extendButton.click()
        await expect(page.getByText("P 19 / 手札 0 / 9", {exact: true})).toBeVisible()
        expect(extensionPayload.idempotency_key).toMatch(/^(?:[0-9a-f-]{36}|extend-)/)
        await expect(page.getByText("支払い総額 1P", {exact: false})).toBeVisible()

        player.draw_points = 0
        await page.reload()
        await page.locator(".tricks-dom-card-field").dispatchEvent("click")
        await expect(page.locator("[data-tricks-extend-button]")).toBeDisabled()
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
