const fs = require("fs")
const mysql = require("mysql2/promise")

const EVENT_ID = Number(process.env.TRICKS_EVENT_ID || 251227)
let recordSequence = 0

function databaseUrl() {
    if (process.env.TRICKS_E2E_DATABASE_URL) return process.env.TRICKS_E2E_DATABASE_URL
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL
    const host = fs.existsSync("/.dockerenv") ? "mysql" : "127.0.0.1"
    const port = process.env.DB_PORT || 3306
    const database = process.env.DB_NAME || "bowsprit"
    const user = process.env.DB_USER || "root"
    const password = process.env.DB_PASS || "root"
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

async function createTricksFixture(options = {}) {
    const db = await mysql.createConnection(databaseUrl())
    const token = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    const playerA = `pw_tricks_a_${token}`
    const playerB = `pw_tricks_b_${token}`
    const playerNames = [playerA, playerB]
    const rarity = options.rarity || 1
    const difficulty = options.difficulty || 3
    const stackCount = options.stackCount || 3
    let stageId

    for (let candidate = 9999; candidate >= 9000; candidate -= 1) {
        const [[row]] = await db.query(
            "SELECT EXISTS(SELECT 1 FROM decks WHERE stage_id = ?) OR EXISTS(SELECT 1 FROM stages WHERE stage_id = ?) AS used",
            [candidate, candidate]
        )
        if (!Number(row.used)) {
            stageId = candidate
            break
        }
    }
    if (!stageId) throw new Error("Playwright用stage_idを確保できません")

    await db.query(
        "INSERT INTO players (name, draw_points, rank_points, card_count, created_at, updated_at) VALUES (?, 0, 0, 0, NOW(), NOW()), (?, 0, 0, 0, NOW(), NOW())",
        playerNames
    )
    const [deckResult] = await db.query(`
        INSERT INTO decks (
            card_id, event_id, eventId, stage_id, stageId, origin_stage_id,
            title, rule_name, ruleName, state, text, difficulty, rarity,
            stack_count, rewards, creator, taker, top_player, topPlayer,
            post_count, count, limit_at, \`limit\`, taken_at, collected_at,
            stack_parent_id, drawn_order, created_at, updated_at
        ) VALUES (
            NULL, ?, ?, ?, 399, 399,
            ?, 'Playwright rule', 'Playwright rule', '_field', 'Playwright fixture', ?, ?,
            ?, ?, ?, ?, NULL, NULL,
            0, 0, ?, ?, NOW(), NULL,
            NULL, NULL, NOW(), NOW()
        )
    `, [
        EVENT_ID, EVENT_ID, stageId, `Playwright ${token}`, difficulty, rarity,
        stackCount, stackCount, playerA, playerA,
        options.limitAt || null, options.limitAt || null,
    ])
    const deckId = Number(deckResult.insertId)
    await db.query("UPDATE decks SET card_id = ? WHERE id = ?", [deckId, deckId])

    async function addRecord(userId, score, createdAtSql = "NOW()") {
        recordSequence += 1
        const uniqueId = Date.now() * 100 + recordSequence
        const [result] = await db.query(`
            INSERT INTO records (
                user_id, score, stage_id, rule, console, region, unique_id,
                post_comment, user_ip, user_host, user_agent, img_url,
                video_url, post_memo, flg, created_at, updated_at
            ) VALUES (?, ?, ?, 1, 1, '1', ?, 'Playwright', '127.0.0.1',
                'localhost', 'Playwright', '', '', '', '0', ${createdAtSql}, ${createdAtSql})
        `, [userId, score, stageId, uniqueId])
        return Number(result.insertId)
    }

    async function player(userId) {
        const [[row]] = await db.query(
            "SELECT name, draw_points, rank_points, card_count FROM players WHERE name = ?",
            [userId]
        )
        return row
    }

    async function card() {
        const [[row]] = await db.query(
            "SELECT id, state, limit_at, collected_at FROM decks WHERE id = ?",
            [deckId]
        )
        return row
    }

    async function collectionLogCount() {
        const [[row]] = await db.query(
            "SELECT COUNT(*) AS count FROM limit_logs WHERE event = 'collect' AND stage_id = ?",
            [stageId]
        )
        return Number(row.count)
    }

    async function cleanup() {
        await db.query("DELETE FROM limit_logs WHERE stage_id = ? OR actor_name IN (?, ?)", [stageId, ...playerNames])
        await db.query("DELETE FROM records WHERE stage_id = ?", [stageId])
        await db.query("DELETE FROM decks WHERE id = ?", [deckId])
        await db.query("DELETE FROM players WHERE name IN (?, ?)", playerNames)
        await db.end()
    }

    return {
        deckId, stageId, playerA, playerB,
        addRecord, player, card, collectionLogCount, cleanup,
    }
}

module.exports = {createTricksFixture}
